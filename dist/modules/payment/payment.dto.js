"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubmerchantUpdateSchema = exports.SubmerchantRegisterSchema = exports.PaymentRefundSchema = exports.PaymentWebhookSchema = exports.PaymentCallbackSchema = exports.InitializePaymentSchema = void 0;
const zod_1 = require("zod");
exports.InitializePaymentSchema = zod_1.z.object({
    orderId: zod_1.z.string().cuid(),
});
exports.PaymentCallbackSchema = zod_1.z.object({
    token: zod_1.z.string().min(1),
    conversationId: zod_1.z.string().optional(),
});
exports.PaymentWebhookSchema = zod_1.z.object({
    eventType: zod_1.z.string().optional(),
    conversationId: zod_1.z.string().optional(),
    token: zod_1.z.string().optional(),
    paymentId: zod_1.z.string().optional(),
    status: zod_1.z.string().optional(),
    payload: zod_1.z.record(zod_1.z.any()).optional(),
});
exports.PaymentRefundSchema = zod_1.z.object({
    amount: zod_1.z.number().positive().optional(),
    reason: zod_1.z.string().trim().max(300).optional(),
    paymentItemId: zod_1.z.string().cuid().optional(),
});
exports.SubmerchantRegisterSchema = zod_1.z.object({
    merchantType: zod_1.z.string().trim().min(2).max(100).optional(),
    contactName: zod_1.z.string().trim().min(2).max(140).optional(),
});
exports.SubmerchantUpdateSchema = zod_1.z.object({
    merchantType: zod_1.z.string().trim().min(2).max(100).optional(),
    iban: zod_1.z.string().trim().min(10).max(50).optional(),
    contactName: zod_1.z.string().trim().min(2).max(140).optional(),
});
