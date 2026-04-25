import { PaymentProvider, PaymentRecordStatus, Prisma } from '@prisma/client';
import prisma from '../../config/db';

export const paymentRepository = {
  async getOrderForInitialize(orderId: string, userId: string) {
    return prisma.order.findFirst({
      where: { id: orderId, customerId: userId },
      include: {
        customer: true,
        shippingAddress: true,
        items: {
          include: {
            product: {
              include: {
                category: true,
              },
            },
            vendor: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    });
  },

  async getSubmerchantsByVendorIds(vendorIds: string[]) {
    return prisma.submerchant.findMany({
      where: {
        vendorId: { in: vendorIds },
        provider: 'IYZICO',
      },
    });
  },

  async findSubmerchantByVendorId(vendorId: string) {
    return prisma.submerchant.findFirst({
      where: {
        vendorId,
        provider: 'IYZICO',
      },
    });
  },

  async createPaymentSession(input: {
    orderId: string;
    userId: string;
    vendorId?: string;
    conversationId: string;
    price: number;
    paidPrice: number;
    currency: string;
    provider: PaymentProvider;
    paymentGroup: 'PRODUCT';
    token?: string;
    rawInitResponse?: Prisma.InputJsonValue;
    items: Array<{
      orderItemId: string;
      vendorId: string;
      submerchantId?: string;
      subMerchantKey?: string;
      subMerchantPrice: number;
      itemPrice: number;
      commissionAmount: number;
      payoutAmount: number;
    }>;
  }) {
    return prisma.payment.create({
      data: {
        orderId: input.orderId,
        userId: input.userId,
        vendorId: input.vendorId,
        provider: input.provider,
        conversationId: input.conversationId,
        paymentGroup: input.paymentGroup,
        status: 'INITIALIZED',
        price: input.price,
        paidPrice: input.paidPrice,
        currency: input.currency,
        token: input.token,
        rawInitResponse: input.rawInitResponse,
        items: {
          create: input.items,
        },
      },
      include: { items: true },
    });
  },

  async createAttempt(input: {
    paymentId: string;
    idempotencyKey?: string;
    requestType: string;
    requestPayload?: Prisma.InputJsonValue;
    responsePayload?: Prisma.InputJsonValue;
    providerConversationId?: string;
    statusCode?: number;
    success: boolean;
    errorCode?: string;
    errorMessage?: string;
  }) {
    return prisma.paymentAttempt.create({
      data: input,
    });
  },

  async markOrderPaymentPending(orderId: string) {
    return prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus: 'PENDING' },
    });
  },

  async findPaymentById(paymentId: string) {
    return prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        order: true,
        items: true,
        refunds: true,
        webhookLogs: {
          orderBy: { receivedAt: 'desc' },
          take: 20,
        },
      },
    });
  },

  async findPaymentByToken(token: string) {
    return prisma.payment.findFirst({
      where: { token },
      include: {
        order: true,
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async updatePaymentFromRetrieve(input: {
    paymentId: string;
    status: PaymentRecordStatus;
    providerPaymentId?: string;
    paidPrice?: number;
    fraudStatus?: number;
    rawRetrieveResponse?: Prisma.InputJsonValue;
    transactions: Array<{
      basketItemId: string;
      paymentTransactionId?: string;
    }>;
  }) {
    return prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: input.paymentId },
        include: { items: true },
      });

      if (!payment) {
        return null;
      }

      const updated = await tx.payment.update({
        where: { id: input.paymentId },
        data: {
          status: input.status,
          providerPaymentId: input.providerPaymentId,
          paidPrice: input.paidPrice ?? payment.paidPrice,
          fraudStatus: input.fraudStatus,
          rawRetrieveResponse: input.rawRetrieveResponse,
          paidAt: input.status === 'PAID' ? new Date() : payment.paidAt,
        },
      });

      for (const trx of input.transactions) {
        await tx.paymentItem.updateMany({
          where: {
            paymentId: input.paymentId,
            orderItemId: trx.basketItemId,
          },
          data: {
            paymentTransactionId: trx.paymentTransactionId,
          },
        });
      }

      await tx.order.update({
        where: { id: payment.orderId },
        data: {
          ...(input.status === 'PAID' ? { status: 'PREPARING' } : {}),
          paymentStatus:
            input.status === 'PAID'
              ? 'PAID'
              : input.status === 'FAILED'
                ? 'FAILED'
                : 'PENDING',
        },
      });

      return updated;
    });
  },

  async createWebhookLog(input: {
    paymentId?: string;
    provider: PaymentProvider;
    eventType?: string;
    signature?: string;
    isValidSignature: boolean;
    callbackToken?: string;
    conversationId?: string;
    payload?: Prisma.InputJsonValue;
    providerResponse?: Prisma.InputJsonValue;
    processStatus?: string;
    processError?: string;
    isDuplicate?: boolean;
  }) {
    return prisma.paymentWebhookLog.create({ data: input });
  },

  async hasProcessedCallbackToken(token: string) {
    const existing = await prisma.paymentWebhookLog.findFirst({
      where: {
        callbackToken: token,
        processStatus: 'processed',
      },
    });
    return Boolean(existing);
  },

  async createRefund(input: {
    paymentId: string;
    paymentItemId?: string;
    orderId: string;
    providerRefundId?: string;
    amount: number;
    reason?: string;
    status: 'REQUESTED' | 'SUCCEEDED' | 'FAILED';
    rawProviderResponse?: Prisma.InputJsonValue;
    createdById?: string;
  }) {
    return prisma.refund.create({
      data: input,
    });
  },

  async updateOrderAfterRefund(orderId: string, isFull: boolean) {
    return prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: 'REFUNDED',
        ...(isFull ? { status: 'CANCELLED' } : {}),
      },
    });
  },

  async markPaymentRefunded(paymentId: string) {
    return prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'REFUNDED',
        refundedAt: new Date(),
      },
    });
  },

  async upsertSubmerchant(input: {
    vendorId: string;
    provider: PaymentProvider;
    subMerchantKey?: string;
    merchantType?: string;
    iban: string;
    identityNumber?: string;
    taxNumber?: string;
    contactName?: string;
    status: 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'FAILED';
    readinessReason?: string;
    readinessCheckedAt?: Date;
    rawProviderResponse?: Prisma.InputJsonValue;
  }) {
    return prisma.submerchant.upsert({
      where: {
        vendorId_provider: {
          vendorId: input.vendorId,
          provider: input.provider,
        },
      },
      create: input,
      update: {
        subMerchantKey: input.subMerchantKey,
        merchantType: input.merchantType,
        iban: input.iban,
        identityNumber: input.identityNumber,
        taxNumber: input.taxNumber,
        contactName: input.contactName,
        status: input.status,
        readinessReason: input.readinessReason,
        readinessCheckedAt: input.readinessCheckedAt,
        rawProviderResponse: input.rawProviderResponse,
      },
    });
  },

  async findVendorById(vendorId: string) {
    return prisma.vendorProfile.findUnique({
      where: { id: vendorId },
      include: { user: true },
    });
  },
};
