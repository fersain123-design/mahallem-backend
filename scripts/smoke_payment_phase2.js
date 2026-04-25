/* eslint-disable no-console */

const BASE = process.env.API_BASE_URL || 'http://127.0.0.1:4000/api';

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const error = new Error(`HTTP ${res.status} ${path}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data;
}

async function login(email, password) {
  const out = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  const token = out?.data?.accessToken;
  assert(token, `Token missing for ${email}`);
  return token;
}

async function getDemoContext(customerToken, adminToken) {
  const addresses = await request('/customer/addresses', {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  const addressList = addresses?.data || [];
  assert(addressList.length > 0, 'No customer addresses found');

  const vendors = await request('/admin/vendors?search=vendor@demo.com', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const vendorList = vendors?.data?.vendors || vendors?.data || [];
  const vendor = vendorList.find((v) => String(v?.user?.email || '').toLowerCase() === 'vendor@demo.com') || vendorList[0];
  let vendorId = String(vendor?.id || '').trim();
  assert(vendorId, 'Vendor profile not found for missing-submerchant scenario');

  const vendorDetail = await request(`/admin/vendors/${vendorId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const vendorData = vendorDetail?.data || vendorDetail;
  const minOrderAmount = Number(vendorData?.minimumOrderAmount || 0);

  const products = await request('/products?limit=200');
  const list = products?.data?.products || products?.products || [];

  const vendorProducts = list
    .filter((p) => {
      const pVendorId = String(p?.vendor_id || p?.vendorId || '').trim();
      const stock = Number(p?.stock || 0);
      const price = Number(p?.price || 0);
      return pVendorId === vendorId && stock > 0 && (p?.isActive ?? true) && price > 0;
    })
    .map((p) => ({
      id: String(p?._id || p?.id || '').trim(),
      price: Number(p?.price || 0),
      stock: Number(p?.stock || 0),
    }))
    .filter((p) => p.id && p.price > 0 && p.stock > 0)
    .sort((a, b) => b.price - a.price);

  let candidate = list.find((p) => {
    const pVendorId = String(p?.vendor_id || p?.vendorId || '').trim();
    const stock = Number(p?.stock || 0);
    const price = Number(p?.price || 0);
    return (
      pVendorId === vendorId &&
      stock > 0 &&
      (p?.isActive ?? true) &&
      price > 0 &&
      (minOrderAmount <= 0 || stock * price >= minOrderAmount)
    );
  });

  if (!candidate) {
    candidate = list.find((p) => Number(p?.stock || 0) > 0 && (p?.isActive ?? true));
    const fallbackVendorId = String(candidate?.vendor_id || candidate?.vendorId || '').trim();
    if (fallbackVendorId) {
      vendorId = fallbackVendorId;
    }
  }

  const productId = String(candidate?._id || candidate?.id || '').trim();
  const productPrice = Number(candidate?.price || 0);
  const productStock = Number(candidate?.stock || 0);
  assert(productId, 'No active in-stock product found');
  assert(productPrice > 0, 'Selected product price must be greater than zero');
  assert(productStock > 0, 'Selected product stock must be greater than zero');

  return {
    addressId: String(addressList[0].id),
    productId,
    productPrice,
    productStock,
    minOrderAmount,
    vendorProducts,
    vendorId,
  };
}

async function ensureVendorPaymentReady(ctx, adminToken, vendorToken) {
  try {
    await request(`/admin/vendors/${ctx.vendorId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: '{}',
    });
  } catch {
    // already approved or not required
  }

  const normalizeIbanState = async () => {
    const details = await request(`/admin/vendors/${ctx.vendorId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    return details?.data || details;
  };

  for (let i = 0; i < 5; i += 1) {
    const vendorState = await normalizeIbanState();
    const ibanStatus = String(vendorState?.ibanStatus || '').toUpperCase();

    if (ibanStatus === 'COMPLETED') {
      break;
    }

    if (ibanStatus === 'WAITING_APPROVAL') {
      await request(`/admin/vendors/${ctx.vendorId}/iban/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: '{}',
      });
      continue;
    }

    if (ibanStatus === 'CHANGE_OPEN') {
      try {
        await request('/vendor/bank-account', {
          method: 'PUT',
          headers: { Authorization: `Bearer ${vendorToken}` },
          body: JSON.stringify({
            iban: 'TR330006100519786457841326',
            bankName: 'Ziraat',
          }),
        });
      } catch (error) {
        const status = Number(error?.status || 0);
        if (status !== 403) {
          throw error;
        }
      }
      continue;
    }
  }

  const finalState = await normalizeIbanState();
  const finalIbanStatus = String(finalState?.ibanStatus || '').toUpperCase();
  assert(finalIbanStatus === 'COMPLETED', `Vendor IBAN not completed (status=${finalIbanStatus})`);

  await request('/vendor/profile', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${vendorToken}` },
    body: JSON.stringify({
      taxNumber: String(finalState?.taxNumber || '1234567890'),
      taxOffice: String(finalState?.taxOffice || 'Test Vergi Dairesi'),
      addressLine: String(finalState?.addressLine || finalState?.address || 'Test Adres Mahallem'),
      city: String(finalState?.city || 'Istanbul'),
      district: String(finalState?.district || 'Kadikoy'),
      neighborhood: String(finalState?.neighborhood || 'Merkez'),
      country: String(finalState?.country || 'TR'),
    }),
  });

  try {
    await request('/vendor/delivery-settings', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${vendorToken}` },
      body: JSON.stringify({
        minimumOrderAmount: 0,
      }),
    });
  } catch {
    // not critical for payment flow if seller cannot edit this field
  }

  await request(`/vendors/${ctx.vendorId}/submerchant/register`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({}),
  });
}

async function createOrderAndInitialize(customerToken, ctx) {
  let quantity = 1;
  let orderRes = null;
  let lastOrderError = null;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    await request('/customer/cart/clear', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: '{}',
    });

    const targetAmount = Math.max(Number(ctx.minOrderAmount || 0), Number(ctx.productPrice || 0));
    let remaining = targetAmount;
    const products = Array.isArray(ctx.vendorProducts) && ctx.vendorProducts.length > 0
      ? ctx.vendorProducts
      : [{ id: ctx.productId, price: Number(ctx.productPrice || 0), stock: Number(ctx.productStock || 1) }];

    for (const p of products) {
      if (remaining <= 0) break;
      const maxQtyByStock = Math.max(0, Number(p.stock || 0));
      const neededQty = Math.ceil(remaining / Number(p.price || 1));
      const qty = Math.min(maxQtyByStock, Math.max(1, neededQty));
      if (qty <= 0) continue;

      await request('/customer/cart/add', {
        method: 'POST',
        headers: { Authorization: `Bearer ${customerToken}` },
        body: JSON.stringify({ productId: p.id, quantity: qty }),
      });
      remaining -= qty * Number(p.price || 0);
    }

    if (remaining > 0) {
      throw new Error('Unable to build cart for minimum order with available vendor stock');
    }

    try {
      orderRes = await request('/customer/orders', {
        method: 'POST',
        headers: { Authorization: `Bearer ${customerToken}` },
        body: JSON.stringify({
          orderType: 'pickup',
          paymentMethod: 'test_card',
        }),
      });
      break;
    } catch (error) {
      lastOrderError = error;
      const message = String(error?.data?.message || '');
      const minMatch = message.match(/Minimum order amount is\s+(\d+(?:\.\d+)?)\s*TRY/i);
      if (!minMatch) {
        throw error;
      }

      const minAmount = Number(minMatch[1]);
      const needed = Math.ceil(minAmount / Number(ctx.productPrice || 1));
      quantity = Math.min(Number(ctx.productStock || needed), Math.max(quantity + 1, needed));
      ctx.minOrderAmount = Math.max(Number(ctx.minOrderAmount || 0), minAmount);
    }
  }

  if (!orderRes && lastOrderError) {
    throw lastOrderError;
  }
  assert(orderRes, 'Order could not be created after minimum amount retries');

  const orderId = String(orderRes?.data?.id || orderRes?.id || '').trim();
  assert(orderId, 'Order ID missing after create');

  const initRes = await request('/payments/initialize', {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
    body: JSON.stringify({ orderId }),
  });

  const payment = initRes?.data || {};
  const paymentSessionId = String(payment.paymentSessionId || '').trim();
  const token = String(payment.token || '').trim();
  assert(paymentSessionId, 'paymentSessionId missing');
  assert(token, 'payment token missing');

  return {
    orderId,
    paymentSessionId,
    token,
  };
}

async function getOrder(customerToken, orderId) {
  const out = await request(`/customer/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  return out?.data || out;
}

async function getPayment(customerToken, paymentSessionId) {
  const out = await request(`/payments/${paymentSessionId}`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  return out?.data || out;
}

async function callbackSuccess(token) {
  return request('/payments/callback', {
    method: 'POST',
    body: JSON.stringify({ token, conversationId: 'force-success' }),
  });
}

async function callbackWithHint(token, hint) {
  return request('/payments/callback', {
    method: 'POST',
    body: JSON.stringify({ token, conversationId: hint }),
  });
}

async function refund(adminToken, paymentId, amount) {
  const payload = amount == null ? {} : { amount };
  return request(`/payments/${paymentId}/refund`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify(payload),
  });
}

async function run() {
  console.log(`[smoke] base=${BASE}`);

  const adminToken = await login('admin@demo.com', 'Admin123!');
  const customerToken = await login('customer@demo.com', 'Customer123!');
  const vendorToken = await login('vendor@demo.com', 'Vendor123!');

  const ctx = await getDemoContext(customerToken, adminToken);
  await ensureVendorPaymentReady(ctx, adminToken, vendorToken);

  const results = {};

  // 1) successful payment + order status sync
  const successFlow = await createOrderAndInitialize(customerToken, ctx);
  const initializedPayment = await getPayment(customerToken, successFlow.paymentSessionId);
  assert(String(initializedPayment.orderId) === String(successFlow.orderId), 'Payment orderId mismatch');
  assert(String(initializedPayment.status) === 'INITIALIZED', 'Expected payment status INITIALIZED after initialize');
  assert(Array.isArray(initializedPayment.items) && initializedPayment.items.length > 0, 'Payment items missing after initialize');
  results.payment_initialize_record = 'ok';

  const paymentBeforeCallback = await getPayment(customerToken, successFlow.paymentSessionId);
  const updatedAtBeforeFirstCallback = String(paymentBeforeCallback.updatedAt || '');

  const callbackOk = await callbackSuccess(successFlow.token);
  assert(callbackOk?.success === true, 'Successful callback did not return success');

  const paidOrder = await getOrder(customerToken, successFlow.orderId);
  assert(String(paidOrder.paymentStatus) === 'PAID', 'Expected order paymentStatus=PAID');
  assert(String(paidOrder.status) === 'PREPARING', 'Expected order status=PREPARING after paid sync');
  const paidPayment = await getPayment(customerToken, successFlow.paymentSessionId);
  assert(String(paidPayment.status) === 'PAID', 'Expected payment status PAID after callback');
  const updatedAtAfterFirstCallback = String(paidPayment.updatedAt || '');
  assert(updatedAtAfterFirstCallback !== updatedAtBeforeFirstCallback, 'Expected callback to mutate payment once');
  results.successful_payment = 'ok';
  results.order_status_sync = 'ok';

  // 2) duplicate callback
  const dup = await callbackSuccess(successFlow.token);
  const dupData = dup?.data || {};
  assert(dupData.duplicate === true, 'Expected duplicate callback flag');
  const paymentAfterDuplicate = await getPayment(customerToken, successFlow.paymentSessionId);
  assert(String(paymentAfterDuplicate.updatedAt || '') === updatedAtAfterFirstCallback, 'Duplicate callback should not mutate payment state');
  results.duplicate_callback = 'ok';

  // 3) full refund
  const fullRefundRes = await refund(adminToken, successFlow.paymentSessionId);
  assert(fullRefundRes?.success === true, 'Full refund failed');
  const refundedOrder = await getOrder(customerToken, successFlow.orderId);
  assert(String(refundedOrder.paymentStatus) === 'REFUNDED', 'Expected REFUNDED after full refund');
  const refundedPayment = await getPayment(customerToken, successFlow.paymentSessionId);
  assert(String(refundedPayment.status) === 'REFUNDED', 'Expected payment REFUNDED after full refund');
  assert(Array.isArray(refundedPayment.refunds) && refundedPayment.refunds.length > 0, 'Refund record missing after full refund');
  results.full_refund = 'ok';

  // 4) partial refund on fresh paid order
  const partialFlow = await createOrderAndInitialize(customerToken, ctx);
  await callbackSuccess(partialFlow.token);
  const partialRefundRes = await refund(adminToken, partialFlow.paymentSessionId, 1.0);
  assert(partialRefundRes?.success === true, 'Partial refund failed');
  const partialPayment = await getPayment(customerToken, partialFlow.paymentSessionId);
  assert(Array.isArray(partialPayment.refunds) && partialPayment.refunds.length > 0, 'Partial refund record missing');
  results.partial_refund = 'ok';

  // 5) failed payment
  const failedFlow = await createOrderAndInitialize(customerToken, ctx);
  await callbackWithHint(failedFlow.token, 'force-fail');
  const failedOrder = await getOrder(customerToken, failedFlow.orderId);
  assert(String(failedOrder.paymentStatus) === 'FAILED', 'Expected FAILED payment status');
  results.failed_payment = 'ok';

  // 6) invalid signature / webhook
  let invalidSigWorked = false;
  try {
    await request('/payments/webhook', {
      method: 'POST',
      headers: {
        'x-iyzi-signature': 'invalid-signature',
      },
      body: JSON.stringify({ token: failedFlow.token, eventType: 'mock_event' }),
    });
  } catch (error) {
    invalidSigWorked = Number(error?.status || 0) === 401;
  }
  assert(invalidSigWorked, 'Invalid webhook signature should return 401');
  results.invalid_signature_webhook = 'ok';

  // 7) missing submerchant
  try {
    await request(`/admin/vendors/${ctx.vendorId}/iban/open-change`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
  } catch (error) {
    if (Number(error?.status || 0) !== 400) {
      throw error;
    }
  }

  let missingSubmerchantBlocked = false;
  try {
    await createOrderAndInitialize(customerToken, ctx);
  } catch (error) {
    const message = String(error?.data?.message || '').toLowerCase();
    missingSubmerchantBlocked = message.includes('submerchant') || Number(error?.status || 0) === 409;
    assert(message.includes('reason:'), 'Missing submerchant error should include readiness reason');
  }
  assert(missingSubmerchantBlocked, 'Missing submerchant scenario did not block initialize');
  results.missing_submerchant = 'ok';

  console.log(JSON.stringify({ success: true, results }, null, 2));
}

run().catch((error) => {
  console.error(JSON.stringify({
    success: false,
    message: String(error?.message || error),
    status: error?.status,
    data: error?.data,
  }, null, 2));
  process.exit(1);
});
