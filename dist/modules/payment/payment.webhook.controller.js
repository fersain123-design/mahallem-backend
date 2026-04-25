"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentWebhook = exports.paymentCallback = void 0;
const payment_dto_1 = require("./payment.dto");
const payment_service_1 = require("./payment.service");
const resolveSignature = (req) => {
    const signature = req.header('x-iyzi-signature') || req.header('x-iyzico-signature');
    return signature ? String(signature) : undefined;
};
const paymentCallback = async (req, res, next) => {
    try {
        const payload = payment_dto_1.PaymentCallbackSchema.parse(req.body || {});
        const data = await payment_service_1.paymentService.handleCallback(payload);
        res.status(200).json({ success: true, data });
    }
    catch (error) {
        next(error);
    }
};
exports.paymentCallback = paymentCallback;
const paymentWebhook = async (req, res, next) => {
    try {
        const payload = payment_dto_1.PaymentWebhookSchema.parse(req.body || {});
        const signature = resolveSignature(req);
        const data = await payment_service_1.paymentService.handleWebhook(payload, signature);
        res.status(200).json({ success: true, data });
    }
    catch (error) {
        next(error);
    }
};
exports.paymentWebhook = paymentWebhook;
