"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSubmerchant = exports.registerSubmerchant = exports.refundPayment = exports.getPaymentById = exports.initializePayment = void 0;
const payment_dto_1 = require("./payment.dto");
const payment_service_1 = require("./payment.service");
const errorHandler_1 = require("../../middleware/errorHandler");
const getAuth = (req) => {
    const auth = req.user;
    if (!auth) {
        throw new errorHandler_1.AppError(401, 'Unauthorized');
    }
    return { userId: auth.userId, role: auth.role };
};
const initializePayment = async (req, res, next) => {
    try {
        const auth = getAuth(req);
        const payload = payment_dto_1.InitializePaymentSchema.parse(req.body);
        const data = await payment_service_1.paymentService.initializePayment(auth.userId, payload, req.ip);
        res.status(200).json({ success: true, data });
    }
    catch (error) {
        next(error);
    }
};
exports.initializePayment = initializePayment;
const getPaymentById = async (req, res, next) => {
    try {
        const auth = getAuth(req);
        const { id } = req.params;
        const data = await payment_service_1.paymentService.getPaymentById(auth, id);
        res.status(200).json({ success: true, data });
    }
    catch (error) {
        next(error);
    }
};
exports.getPaymentById = getPaymentById;
const refundPayment = async (req, res, next) => {
    try {
        const auth = getAuth(req);
        const { id } = req.params;
        const payload = payment_dto_1.PaymentRefundSchema.parse(req.body || {});
        const data = await payment_service_1.paymentService.refundPayment(auth, id, payload);
        res.status(200).json({ success: true, data });
    }
    catch (error) {
        next(error);
    }
};
exports.refundPayment = refundPayment;
const registerSubmerchant = async (req, res, next) => {
    try {
        const auth = getAuth(req);
        const { vendorId } = req.params;
        const payload = payment_dto_1.SubmerchantRegisterSchema.parse(req.body || {});
        const data = await payment_service_1.paymentService.registerSubmerchant(auth, vendorId, payload);
        res.status(201).json({ success: true, data });
    }
    catch (error) {
        next(error);
    }
};
exports.registerSubmerchant = registerSubmerchant;
const updateSubmerchant = async (req, res, next) => {
    try {
        const auth = getAuth(req);
        const { vendorId } = req.params;
        const payload = payment_dto_1.SubmerchantUpdateSchema.parse(req.body || {});
        const data = await payment_service_1.paymentService.updateSubmerchant(auth, vendorId, payload);
        res.status(200).json({ success: true, data });
    }
    catch (error) {
        next(error);
    }
};
exports.updateSubmerchant = updateSubmerchant;
