"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentRepository = void 0;
const db_1 = __importDefault(require("../../config/db"));
exports.paymentRepository = {
    async getOrderForInitialize(orderId, userId) {
        return db_1.default.order.findFirst({
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
    async getSubmerchantsByVendorIds(vendorIds) {
        return db_1.default.submerchant.findMany({
            where: {
                vendorId: { in: vendorIds },
                provider: 'IYZICO',
            },
        });
    },
    async findSubmerchantByVendorId(vendorId) {
        return db_1.default.submerchant.findFirst({
            where: {
                vendorId,
                provider: 'IYZICO',
            },
        });
    },
    async createPaymentSession(input) {
        return db_1.default.payment.create({
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
    async createAttempt(input) {
        return db_1.default.paymentAttempt.create({
            data: input,
        });
    },
    async markOrderPaymentPending(orderId) {
        return db_1.default.order.update({
            where: { id: orderId },
            data: { paymentStatus: 'PENDING' },
        });
    },
    async findPaymentById(paymentId) {
        return db_1.default.payment.findUnique({
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
    async findPaymentByToken(token) {
        return db_1.default.payment.findFirst({
            where: { token },
            include: {
                order: true,
                items: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    },
    async updatePaymentFromRetrieve(input) {
        return db_1.default.$transaction(async (tx) => {
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
                    paymentStatus: input.status === 'PAID'
                        ? 'PAID'
                        : input.status === 'FAILED'
                            ? 'FAILED'
                            : 'PENDING',
                },
            });
            return updated;
        });
    },
    async createWebhookLog(input) {
        return db_1.default.paymentWebhookLog.create({ data: input });
    },
    async hasProcessedCallbackToken(token) {
        const existing = await db_1.default.paymentWebhookLog.findFirst({
            where: {
                callbackToken: token,
                processStatus: 'processed',
            },
        });
        return Boolean(existing);
    },
    async createRefund(input) {
        return db_1.default.refund.create({
            data: input,
        });
    },
    async updateOrderAfterRefund(orderId, isFull) {
        return db_1.default.order.update({
            where: { id: orderId },
            data: {
                paymentStatus: 'REFUNDED',
                ...(isFull ? { status: 'CANCELLED' } : {}),
            },
        });
    },
    async markPaymentRefunded(paymentId) {
        return db_1.default.payment.update({
            where: { id: paymentId },
            data: {
                status: 'REFUNDED',
                refundedAt: new Date(),
            },
        });
    },
    async upsertSubmerchant(input) {
        return db_1.default.submerchant.upsert({
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
    async findVendorById(vendorId) {
        return db_1.default.vendorProfile.findUnique({
            where: { id: vendorId },
            include: { user: true },
        });
    },
};
