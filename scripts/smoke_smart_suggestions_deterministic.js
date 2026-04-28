/*
 * Deterministic smoke test for smart suggestions endpoint.
 * Prepares isolated category/products/orders locally and validates both filled and empty states.
 * No external API dependency.
 */

const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4000/api';
const VENDOR_EMAIL = process.env.VENDOR_EMAIL || 'vendor@demo.com';
const VENDOR_PASSWORD = process.env.VENDOR_PASSWORD || 'Vendor123!';
const CUSTOMER_EMAIL = process.env.CUSTOMER_EMAIL || 'customer@demo.com';

const prisma = new PrismaClient();

const assert = (condition, message, details) => {
  if (!condition) {
    const error = new Error(message);
    error.details = details;
    throw error;
  }
};

const requestJson = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let parsed = {};
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }
  }

  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`);
    error.status = response.status;
    error.data = parsed;
    throw error;
  }

  return parsed;
};

const authHeaders = (token) => ({ Authorization: `Bearer ${token}` });

const login = async (email, password) => {
  const payload = await requestJson(`${BASE_URL}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  const token =
    payload?.data?.accessToken ||
    payload?.data?.access_token ||
    payload?.accessToken ||
    payload?.access_token;

  assert(token, `Login token missing for ${email}`, payload);
  return token;
};

const getVendorToken = async () => {
  try {
    return await login(VENDOR_EMAIL, VENDOR_PASSWORD);
  } catch (error) {
    const vendorUser =
      (await prisma.user.findUnique({
        where: { email: VENDOR_EMAIL },
        select: { id: true, role: true, isActive: true },
      })) ||
      (await prisma.user.findFirst({
        where: { role: 'VENDOR', isActive: true },
        orderBy: { createdAt: 'asc' },
        select: { id: true, role: true, isActive: true, email: true },
      }));

    assert(vendorUser?.id, 'Vendor user not found for JWT fallback', { email: VENDOR_EMAIL });
    assert(vendorUser?.role === 'VENDOR', 'JWT fallback user must be VENDOR', vendorUser);
    assert(vendorUser?.isActive !== false, 'JWT fallback vendor must be active', vendorUser);

    const secret = process.env.JWT_SECRET || 'your-secret-key';
    return jwt.sign({ userId: vendorUser.id, role: 'VENDOR' }, secret, { expiresIn: '30m' });
  }
};

(async () => {
  const createdProductIds = [];
  const createdOrderIds = [];

  try {
    const health = await requestJson('http://127.0.0.1:4000/health');
    assert(String(health?.status || '') === 'ok', 'Backend health check failed', health);

    const token = await getVendorToken();

    const vendorUser =
      (await prisma.user.findUnique({
        where: { email: VENDOR_EMAIL },
        select: { id: true, vendorProfile: { select: { id: true } } },
      })) ||
      (await prisma.user.findFirst({
        where: { role: 'VENDOR', isActive: true, vendorProfile: { isNot: null } },
        orderBy: { createdAt: 'asc' },
        select: { id: true, vendorProfile: { select: { id: true } }, email: true },
      }));

    const customerUser =
      (await prisma.user.findUnique({
        where: { email: CUSTOMER_EMAIL },
        select: { id: true },
      })) ||
      (await prisma.user.findFirst({
        where: { role: 'CUSTOMER', isActive: true },
        orderBy: { createdAt: 'asc' },
        select: { id: true, email: true },
      }));

    const vendorId = String(vendorUser?.vendorProfile?.id || '').trim();
    const customerId = String(customerUser?.id || '').trim();

    assert(vendorId, 'Vendor profile not found for smoke user', { email: VENDOR_EMAIL });
    assert(customerId, 'Customer user not found for smoke user', { email: CUSTOMER_EMAIL });

    const categoriesPayload = await requestJson(`${BASE_URL}/vendor/categories`, {
      method: 'GET',
      headers: authHeaders(token),
    });

    const categories = Array.isArray(categoriesPayload?.data?.categories)
      ? categoriesPayload.data.categories
      : [];
    const populatedCategory = categories[0] || null;
    const populatedSubCategory = Array.isArray(populatedCategory?.subCategories)
      ? populatedCategory.subCategories[0]
      : null;

    assert(populatedCategory?.id && populatedSubCategory?.id, 'No vendor category/subcategory found', {
      categoriesCount: categories.length,
    });

    const testTag = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const productSpecs = [
      { name: `Smoke Suggested A ${testTag}`, qty: 90000 },
      { name: `Smoke Suggested B ${testTag}`, qty: 80000 },
      { name: `Smoke Suggested C ${testTag}`, qty: 70000 },
    ];

    for (const spec of productSpecs) {
      const created = await requestJson(`${BASE_URL}/vendor/products`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({
          name: spec.name,
          categoryId: String(populatedCategory.id),
          categoryName: String(populatedCategory.name || 'Smoke Category'),
          subCategoryId: String(populatedSubCategory.id),
          subCategoryName: String(populatedSubCategory.name || 'Smoke Subcategory'),
          price: 19.9,
          stock: 20,
          unit: 'adet',
          status: 'active',
          images: [],
        }),
      });

      const productId = String(created?.data?.id || '').trim();
      assert(productId, 'Created product id missing', created);
      createdProductIds.push(productId);

      const order = await prisma.order.create({
        data: {
          customerId,
          totalPrice: Number(spec.qty),
          status: 'DELIVERED',
          paymentStatus: 'PAID',
          paymentMethod: 'CASH_ON_DELIVERY',
          orderType: 'DELIVERY',
        },
        select: { id: true },
      });
      createdOrderIds.push(order.id);

      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          productId,
          vendorId,
          quantity: spec.qty,
          unitPrice: 1,
          subtotal: Number(spec.qty),
          commissionRateSnapshot: 0,
          commissionAmount: 0,
          vendorNetAmount: Number(spec.qty),
        },
      });
    }

    const suggestionsPayload = await requestJson(
      `${BASE_URL}/vendor/products/smart-suggestions?categoryId=${encodeURIComponent(
        String(populatedCategory.id)
      )}&subCategoryId=${encodeURIComponent(String(populatedSubCategory.id))}&limit=6`,
      {
        method: 'GET',
        headers: authHeaders(token),
      }
    );

    assert(suggestionsPayload?.success === true, 'Smart suggestions should return success=true', suggestionsPayload);
    assert(Array.isArray(suggestionsPayload?.data), 'Smart suggestions data should be array', suggestionsPayload);

    const suggestionNames = new Set(
      (suggestionsPayload.data || []).map((item) => String(item?.name || '').trim()).filter(Boolean)
    );

    for (const spec of productSpecs) {
      assert(
        suggestionNames.has(spec.name),
        'Expected seeded product missing from smart suggestions',
        {
          expectedName: spec.name,
          returnedCount: suggestionsPayload?.data?.length || 0,
        }
      );
    }

    const impossibleSubCategoryId = `missing-sub-${Date.now()}`;
    const emptyPayload = await requestJson(
      `${BASE_URL}/vendor/products/smart-suggestions?categoryId=${encodeURIComponent(
        String(populatedCategory.id)
      )}&subCategoryId=${encodeURIComponent(impossibleSubCategoryId)}&limit=6`,
      {
        method: 'GET',
        headers: authHeaders(token),
      }
    );

    assert(emptyPayload?.success === true, 'Smart suggestions empty state should return success=true', emptyPayload);
    assert(Array.isArray(emptyPayload?.data), 'Smart suggestions empty state data should be array', emptyPayload);
    assert((emptyPayload?.data?.length || 0) === 0, 'Smart suggestions empty state should return empty array', emptyPayload);

    console.log('PASS smoke_smart_suggestions_deterministic');
    console.log(
      JSON.stringify(
        {
          populatedCategoryId: populatedCategory.id,
          populatedSubCategoryId: populatedSubCategory.id,
          populatedCount: suggestionsPayload?.data?.length || 0,
          emptyCount: emptyPayload?.data?.length || 0,
        },
        null,
        2
      )
    );
  } catch (error) {
    console.error('FAIL smoke_smart_suggestions_deterministic');
    console.error(error?.message || error);
    if (error?.details) {
      console.error(JSON.stringify(error.details, null, 2));
    }
    if (error?.data) {
      console.error(JSON.stringify(error.data, null, 2));
    }
    process.exitCode = 1;
  } finally {
    try {
      if (createdOrderIds.length) {
        await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } });
        await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
      }
    } catch {}

    try {
      if (createdProductIds.length) {
        await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
      }
    } catch {}
    await prisma.$disconnect();
  }
})();
