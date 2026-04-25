import { PaymentProvider, Prisma, UserRole } from '@prisma/client';
import { AppError } from '../../middleware/errorHandler';
import { assertTransition } from './payment.state-machine';
import {
  InitializePaymentInput,
  PaymentCallbackInput,
  PaymentRefundInput,
  PaymentWebhookInput,
  SubmerchantRegisterInput,
  SubmerchantUpdateInput,
} from './payment.dto';
import { getPaymentConfig } from './payment.config';
import { paymentRepository } from './payment.repository';
import { IyzicoPaymentProvider, mapIyzicoSubmerchantStatus } from './payment.provider.iyzico';
import { PaymentProviderContract } from './payment.types';

const toMoney = (value: number): number => Number(Number(value || 0).toFixed(2));

const providerResolver = (): PaymentProviderContract => {
  const cfg = getPaymentConfig();
  if (!cfg.iyzico.enabled) {
    throw new AppError(503, 'Payment provider is currently disabled');
  }
  return new IyzicoPaymentProvider();
};

const requireOrderAccess = (args: {
  role: UserRole;
  userId: string;
  orderCustomerId: string;
}): void => {
  if (args.role === 'ADMIN') return;
  if (args.role === 'CUSTOMER' && args.userId === args.orderCustomerId) return;
  throw new AppError(403, 'Bu odeme kaydi icin yetkiniz yok');
};

const recomputeOrderTotal = (order: any): number => {
  const itemTotal = (order.items || []).reduce(
    (sum: number, item: any) => sum + Number(item?.subtotal || 0),
    0
  );
  const deliveryFee = Number(order?.deliveryFee || 0);
  const campaignDiscount = Number(order?.campaignDiscount || 0);
  return toMoney(itemTotal - campaignDiscount + deliveryFee);
};

const resolveVendorPaymentReadinessReason = (vendor: any): string | null => {
  if (!vendor) return 'vendor_not_found';
  if (String(vendor.status || '') !== 'APPROVED') return 'vendor_not_approved';
  if (!String(vendor.iban || '').trim()) return 'missing_iban';
  if (String(vendor.ibanStatus || '') !== 'COMPLETED') return 'iban_not_approved';
  if (!String(vendor.addressLine || vendor.address || '').trim()) return 'missing_address';
  if (!String(vendor.shopName || '').trim()) return 'missing_shop_name';
  if (!String(vendor.tcKimlik || '').trim() && !String(vendor.taxNumber || '').trim()) {
    return 'missing_identity_or_tax_number';
  }
  return null;
};

const buildAddressText = (address: any): string => {
  if (!address) return 'Adres bilgisi girilmedi';
  return [address.addressLine, address.neighborhood, address.district, address.city]
    .filter(Boolean)
    .join(' ')
    .trim();
};

export const paymentService = {
  async initializePayment(userId: string, input: InitializePaymentInput, ip?: string) {
    const order = await paymentRepository.getOrderForInitialize(input.orderId, userId);
    if (!order) {
      throw new AppError(404, 'Siparis bulunamadi');
    }

    if (!Array.isArray(order.items) || order.items.length === 0) {
      throw new AppError(409, 'Bos siparis icin odeme baslatilamaz');
    }

    const backendTotal = recomputeOrderTotal(order);
    if (Math.abs(backendTotal - Number(order.totalPrice || 0)) > 0.01) {
      throw new AppError(409, 'Siparis tutari dogrulama hatasi');
    }

    const vendorIds = [...new Set(order.items.map((item: any) => String(item.vendorId)))];
    const submerchants = await paymentRepository.getSubmerchantsByVendorIds(vendorIds);
    const submerchantByVendorId = new Map(submerchants.map((sm) => [sm.vendorId, sm]));

    const missingVendor = vendorIds.find((vendorId) => {
      const submerchant = submerchantByVendorId.get(vendorId);
      return !submerchant || !submerchant.subMerchantKey || submerchant.status !== 'ACTIVE';
    });
    if (missingVendor) {
      await this.syncVendorSubmerchantReadiness(missingVendor, 'checkout_initialize');
      const refreshed = await paymentRepository.findSubmerchantByVendorId(missingVendor);
      const reason = String(refreshed?.readinessReason || 'submerchant_not_ready');
      throw new AppError(
        409,
        `Submerchant kaydi eksik olan satici icin odeme baslatilamaz (reason: ${reason})`
      );
    }

    const cfg = getPaymentConfig();
    const provider = providerResolver();
    const conversationId = `ord-${order.id}-${Date.now()}`;

    const basketItems = order.items.map((item: any) => {
      const submerchant = submerchantByVendorId.get(item.vendorId);
      if (!submerchant?.subMerchantKey) {
        throw new AppError(409, 'Submerchant key bulunamadi');
      }

      return {
        id: item.id,
        name: String(item?.product?.name || 'Urun'),
        category1: String(item?.product?.category?.name || 'Genel'),
        itemType: 'PHYSICAL' as const,
        price: toMoney(item.subtotal).toFixed(2),
        subMerchantKey: submerchant.subMerchantKey,
        subMerchantPrice: toMoney(item.vendorNetAmount || item.subtotal).toFixed(2),
      };
    });

    const addressText = buildAddressText(order.shippingAddress);
    const buyerName = String(order.customer?.name || 'Musteri').trim();
    const [firstName, ...rest] = buyerName.split(' ');

    const initPayload = {
      conversationId,
      price: toMoney(order.totalPrice).toFixed(2),
      paidPrice: toMoney(order.totalPrice).toFixed(2),
      currency: cfg.currency,
      basketId: order.id,
      paymentGroup: 'PRODUCT' as const,
      callbackUrl: cfg.iyzico.callbackUrl,
      locale: cfg.locale,
      buyer: {
        id: order.customerId,
        name: firstName || buyerName,
        surname: rest.join(' ') || 'Musteri',
        gsmNumber: order.customer?.phone || undefined,
        email: order.customer?.email || 'unknown@mahallem.local',
        registrationAddress: addressText,
        city: order.shippingAddress?.city || undefined,
        country: order.shippingAddress?.country || 'TR',
        ip: ip || '127.0.0.1',
      },
      shippingAddress: {
        contactName: buyerName,
        city: order.shippingAddress?.city || undefined,
        country: order.shippingAddress?.country || 'TR',
        address: addressText,
      },
      billingAddress: {
        contactName: buyerName,
        city: order.shippingAddress?.city || undefined,
        country: order.shippingAddress?.country || 'TR',
        address: addressText,
      },
      basketItems,
    };

    const initialized = await provider.initializeCheckout(initPayload);

    const payment = await paymentRepository.createPaymentSession({
      orderId: order.id,
      userId: order.customerId,
      vendorId: vendorIds.length === 1 ? vendorIds[0] : undefined,
      conversationId: initialized.conversationId,
      price: toMoney(order.totalPrice),
      paidPrice: toMoney(order.totalPrice),
      currency: cfg.currency,
      provider: 'IYZICO',
      paymentGroup: 'PRODUCT',
      token: initialized.token,
      rawInitResponse: initialized.raw as Prisma.InputJsonValue,
      items: order.items.map((item: any) => {
        const submerchant = submerchantByVendorId.get(item.vendorId);
        return {
          orderItemId: item.id,
          vendorId: item.vendorId,
          submerchantId: submerchant?.id,
          subMerchantKey: submerchant?.subMerchantKey || undefined,
          subMerchantPrice: toMoney(item.vendorNetAmount || item.subtotal),
          itemPrice: toMoney(item.subtotal),
          commissionAmount: toMoney(item.commissionAmount || 0),
          payoutAmount: toMoney(item.vendorNetAmount || item.subtotal),
        };
      }),
    });

    await paymentRepository.markOrderPaymentPending(order.id);

    await paymentRepository.createAttempt({
      paymentId: payment.id,
      requestType: 'checkout_initialize',
      requestPayload: initPayload as Prisma.InputJsonValue,
      responsePayload: initialized.raw as Prisma.InputJsonValue,
      providerConversationId: initialized.conversationId,
      success: true,
    });

    return {
      paymentSessionId: payment.id,
      token: initialized.token,
      paymentPageUrl: initialized.paymentPageUrl,
      status: initialized.status,
    };
  },

  async handleCallback(input: PaymentCallbackInput) {
    return this.retrieveAndFinalize(input.token, input.conversationId, 'callback');
  },

  async handleWebhook(input: PaymentWebhookInput, signature?: string) {
    const provider = providerResolver();
    const validation = await provider.validateCallback(input, signature);

    const paymentToken = String(input.token || input.payload?.token || '').trim();
    if (!paymentToken) {
      await paymentRepository.createWebhookLog({
        provider: 'IYZICO',
        eventType: input.eventType,
        signature,
        isValidSignature: validation.isValid,
        callbackToken: undefined,
        conversationId: input.conversationId,
        payload: input as Prisma.InputJsonValue,
        processStatus: 'rejected',
        processError: 'token_missing',
      });
      throw new AppError(400, 'Webhook token bilgisi eksik');
    }

    if (!validation.isValid) {
      await paymentRepository.createWebhookLog({
        provider: 'IYZICO',
        eventType: input.eventType,
        signature,
        isValidSignature: false,
        callbackToken: paymentToken,
        conversationId: input.conversationId,
        payload: input as Prisma.InputJsonValue,
        processStatus: 'rejected',
        processError: validation.reason,
      });
      throw new AppError(401, 'Webhook signature dogrulanamadi');
    }

    return this.retrieveAndFinalize(paymentToken, input.conversationId, 'webhook', input, signature);
  },

  async getPaymentById(auth: { userId: string; role: UserRole }, paymentId: string) {
    const payment = await paymentRepository.findPaymentById(paymentId);
    if (!payment) {
      throw new AppError(404, 'Odeme bulunamadi');
    }

    requireOrderAccess({
      role: auth.role,
      userId: auth.userId,
      orderCustomerId: payment.order.customerId,
    });

    return payment;
  },

  async refundPayment(
    auth: { userId: string; role: UserRole },
    paymentId: string,
    input: PaymentRefundInput
  ) {
    const payment = await paymentRepository.findPaymentById(paymentId);
    if (!payment) {
      throw new AppError(404, 'Odeme bulunamadi');
    }

    if (auth.role === 'CUSTOMER') {
      throw new AppError(403, 'Iade islemi icin yetkiniz bulunmuyor');
    }

    if (payment.status !== 'PAID' && payment.status !== 'REVIEW') {
      throw new AppError(409, 'Bu odeme durumunda iade baslatilamaz');
    }

    const provider = providerResolver();
    const amount = toMoney(input.amount ?? payment.paidPrice ?? payment.price);
    const isFull = amount >= toMoney(payment.paidPrice ?? payment.price);
    const transactionId = input.paymentItemId
      ? payment.items.find((item) => item.id === input.paymentItemId)?.paymentTransactionId
      : payment.items.find((item) => Boolean(item.paymentTransactionId))?.paymentTransactionId;

    const refundResult = await provider.refundPayment({
      paymentId: String(payment.providerPaymentId || payment.id),
      paymentTransactionId: transactionId || undefined,
      amount,
      currency: payment.currency,
      conversationId: `refund-${payment.id}-${Date.now()}`,
    });

    const refund = await paymentRepository.createRefund({
      paymentId: payment.id,
      paymentItemId: input.paymentItemId,
      orderId: payment.orderId,
      providerRefundId: refundResult.providerRefundId,
      amount,
      reason: input.reason,
      status: refundResult.status,
      rawProviderResponse: refundResult.raw as Prisma.InputJsonValue,
      createdById: auth.userId,
    });

    if (refundResult.status === 'SUCCEEDED') {
      await paymentRepository.markPaymentRefunded(payment.id);
      await paymentRepository.updateOrderAfterRefund(payment.orderId, isFull);
    }

    return {
      refund,
      isFull,
      status: refundResult.status,
    };
  },

  async registerSubmerchant(
    auth: { userId: string; role: UserRole },
    vendorId: string,
    input: SubmerchantRegisterInput
  ) {
    const vendor = await paymentRepository.findVendorById(vendorId);
    if (!vendor) {
      throw new AppError(404, 'Satici bulunamadi');
    }

    if (auth.role === 'VENDOR' && vendor.userId !== auth.userId) {
      throw new AppError(403, 'Bu satici icin islem yetkiniz yok');
    }

    if (!vendor.iban || vendor.ibanStatus !== 'COMPLETED') {
      throw new AppError(409, 'IBAN bilgisi onayli degil');
    }

    if (!vendor.tcKimlik && !vendor.taxNumber) {
      throw new AppError(409, 'Identity veya tax numarasi olmadan submerchant olusturulamaz');
    }

    const provider = providerResolver();
    const response = await provider.createSubmerchant({
      vendorId: vendor.id,
      merchantType: input.merchantType,
      contactName: input.contactName || vendor.shopName,
      iban: vendor.iban,
      identityNumber: vendor.tcKimlik || undefined,
      taxNumber: vendor.taxNumber || undefined,
      email: vendor.user?.email || undefined,
      gsmNumber: vendor.user?.phone || undefined,
      name: vendor.shopName,
      address: vendor.addressLine || vendor.address || 'Adres girilmedi',
    });

    return paymentRepository.upsertSubmerchant({
      vendorId: vendor.id,
      provider: 'IYZICO',
      subMerchantKey: response.key,
      merchantType: input.merchantType,
      iban: vendor.iban,
      identityNumber: vendor.tcKimlik || undefined,
      taxNumber: vendor.taxNumber || undefined,
      contactName: input.contactName || vendor.shopName,
      status: mapIyzicoSubmerchantStatus(String((response.raw as any)?.status || response.status)),
      readinessReason: undefined,
      readinessCheckedAt: new Date(),
      rawProviderResponse: response.raw as Prisma.InputJsonValue,
    });
  },

  async updateSubmerchant(
    auth: { userId: string; role: UserRole },
    vendorId: string,
    input: SubmerchantUpdateInput
  ) {
    const vendor = await paymentRepository.findVendorById(vendorId);
    if (!vendor) {
      throw new AppError(404, 'Satici bulunamadi');
    }

    if (auth.role === 'VENDOR' && vendor.userId !== auth.userId) {
      throw new AppError(403, 'Bu satici icin islem yetkiniz yok');
    }

    const submerchants = await paymentRepository.getSubmerchantsByVendorIds([vendorId]);
    const submerchant = submerchants[0];
    if (!submerchant?.subMerchantKey) {
      throw new AppError(404, 'Guncellenecek submerchant kaydi bulunamadi');
    }

    const provider = providerResolver();
    const response = await provider.updateSubmerchant(submerchant.subMerchantKey, {
      vendorId: vendor.id,
      merchantType: input.merchantType || submerchant.merchantType || undefined,
      contactName: input.contactName || submerchant.contactName || vendor.shopName,
      iban: input.iban || vendor.iban,
      identityNumber: vendor.tcKimlik || undefined,
      taxNumber: vendor.taxNumber || undefined,
      email: vendor.user?.email || undefined,
      gsmNumber: vendor.user?.phone || undefined,
      name: vendor.shopName,
      address: vendor.addressLine || vendor.address || 'Adres girilmedi',
    });

    return paymentRepository.upsertSubmerchant({
      vendorId: vendor.id,
      provider: 'IYZICO',
      subMerchantKey: response.key,
      merchantType: input.merchantType || submerchant.merchantType || undefined,
      iban: input.iban || vendor.iban,
      identityNumber: vendor.tcKimlik || undefined,
      taxNumber: vendor.taxNumber || undefined,
      contactName: input.contactName || vendor.shopName,
      status: mapIyzicoSubmerchantStatus(String((response.raw as any)?.status || response.status)),
      readinessReason: undefined,
      readinessCheckedAt: new Date(),
      rawProviderResponse: response.raw as Prisma.InputJsonValue,
    });
  },

  async syncVendorSubmerchantReadiness(
    vendorId: string,
    trigger: 'admin_approve' | 'iban_approve' | 'vendor_profile_update' | 'checkout_initialize'
  ) {
    const vendor = await paymentRepository.findVendorById(vendorId);
    if (!vendor) {
      throw new AppError(404, 'Satici bulunamadi');
    }

    const readinessReason = resolveVendorPaymentReadinessReason(vendor);
    const existing = await paymentRepository.findSubmerchantByVendorId(vendorId);

    if (readinessReason) {
      const fallbackKey = existing?.subMerchantKey;
      return paymentRepository.upsertSubmerchant({
        vendorId,
        provider: 'IYZICO',
        subMerchantKey: fallbackKey || undefined,
        merchantType: existing?.merchantType || undefined,
        iban: String(vendor.iban || '').trim(),
        identityNumber: vendor.tcKimlik || undefined,
        taxNumber: vendor.taxNumber || undefined,
        contactName: existing?.contactName || vendor.shopName,
        status: 'FAILED',
        readinessReason: `${trigger}:${readinessReason}`,
        readinessCheckedAt: new Date(),
        rawProviderResponse: existing?.rawProviderResponse as Prisma.InputJsonValue,
      });
    }

    const provider = providerResolver();
    if (!existing?.subMerchantKey) {
      const created = await provider.createSubmerchant({
        vendorId: vendor.id,
        merchantType: existing?.merchantType || undefined,
        contactName: existing?.contactName || vendor.shopName,
        iban: vendor.iban,
        identityNumber: vendor.tcKimlik || undefined,
        taxNumber: vendor.taxNumber || undefined,
        email: vendor.user?.email || undefined,
        gsmNumber: vendor.user?.phone || undefined,
        name: vendor.shopName,
        address: vendor.addressLine || vendor.address || 'Adres girilmedi',
      });

      return paymentRepository.upsertSubmerchant({
        vendorId,
        provider: 'IYZICO',
        subMerchantKey: created.key,
        merchantType: existing?.merchantType || undefined,
        iban: vendor.iban,
        identityNumber: vendor.tcKimlik || undefined,
        taxNumber: vendor.taxNumber || undefined,
        contactName: existing?.contactName || vendor.shopName,
        status: mapIyzicoSubmerchantStatus(String((created.raw as any)?.status || created.status)),
        readinessReason: undefined,
        readinessCheckedAt: new Date(),
        rawProviderResponse: created.raw as Prisma.InputJsonValue,
      });
    }

    const updated = await provider.updateSubmerchant(existing.subMerchantKey, {
      vendorId: vendor.id,
      merchantType: existing.merchantType || undefined,
      contactName: existing.contactName || vendor.shopName,
      iban: vendor.iban,
      identityNumber: vendor.tcKimlik || undefined,
      taxNumber: vendor.taxNumber || undefined,
      email: vendor.user?.email || undefined,
      gsmNumber: vendor.user?.phone || undefined,
      name: vendor.shopName,
      address: vendor.addressLine || vendor.address || 'Adres girilmedi',
    });

    return paymentRepository.upsertSubmerchant({
      vendorId,
      provider: 'IYZICO',
      subMerchantKey: updated.key,
      merchantType: existing.merchantType || undefined,
      iban: vendor.iban,
      identityNumber: vendor.tcKimlik || undefined,
      taxNumber: vendor.taxNumber || undefined,
      contactName: existing.contactName || vendor.shopName,
      status: mapIyzicoSubmerchantStatus(String((updated.raw as any)?.status || updated.status)),
      readinessReason: undefined,
      readinessCheckedAt: new Date(),
      rawProviderResponse: updated.raw as Prisma.InputJsonValue,
    });
  },

  async retrieveAndFinalize(
    token: string,
    conversationId: string | undefined,
    source: 'callback' | 'webhook',
    payload?: unknown,
    signature?: string
  ) {
    const payment = await paymentRepository.findPaymentByToken(token);
    if (!payment) {
      await paymentRepository.createWebhookLog({
        provider: 'IYZICO',
        eventType: source,
        signature,
        isValidSignature: Boolean(signature) || source === 'callback',
        callbackToken: token,
        conversationId,
        payload: payload as Prisma.InputJsonValue,
        processStatus: 'not_found',
      });
      throw new AppError(404, 'Token icin odeme kaydi bulunamadi');
    }

    const isDuplicate = await paymentRepository.hasProcessedCallbackToken(token);
    if (isDuplicate && (payment.status === 'PAID' || payment.status === 'FAILED' || payment.status === 'REFUNDED')) {
      await paymentRepository.createWebhookLog({
        paymentId: payment.id,
        provider: payment.provider,
        eventType: source,
        signature,
        isValidSignature: true,
        callbackToken: token,
        conversationId,
        payload: payload as Prisma.InputJsonValue,
        processStatus: 'processed',
        isDuplicate: true,
      });
      return {
        paymentId: payment.id,
        status: payment.status,
        duplicate: true,
      };
    }

    const provider = providerResolver();
    const retrieve = await provider.retrieveCheckoutResult(token, conversationId);

    assertTransition(payment.status, retrieve.paymentStatus);

    const updated = await paymentRepository.updatePaymentFromRetrieve({
      paymentId: payment.id,
      status: retrieve.paymentStatus,
      providerPaymentId: retrieve.providerPaymentId,
      paidPrice: retrieve.paidPrice,
      fraudStatus: retrieve.fraudStatus,
      rawRetrieveResponse: retrieve.raw as Prisma.InputJsonValue,
      transactions: retrieve.transactions.map((trx) => ({
        basketItemId: trx.basketItemId,
        paymentTransactionId: trx.paymentTransactionId,
      })),
    });

    await paymentRepository.createAttempt({
      paymentId: payment.id,
      requestType: `checkout_retrieve_${source}`,
      requestPayload: { token, conversationId } as Prisma.InputJsonValue,
      responsePayload: retrieve.raw as Prisma.InputJsonValue,
      providerConversationId: retrieve.conversationId,
      success: retrieve.paymentStatus === 'PAID',
    });

    await paymentRepository.createWebhookLog({
      paymentId: payment.id,
      provider: payment.provider,
      eventType: source,
      signature,
      isValidSignature: source === 'callback' ? true : Boolean(signature),
      callbackToken: token,
      conversationId,
      payload: payload as Prisma.InputJsonValue,
      providerResponse: retrieve.raw as Prisma.InputJsonValue,
      processStatus: 'processed',
      isDuplicate: false,
    });

    return {
      paymentId: payment.id,
      status: updated?.status || retrieve.paymentStatus,
      duplicate: false,
    };
  },
};
