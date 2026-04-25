"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPaymentModule = void 0;
const express_1 = require("express");
const payment_routes_1 = __importDefault(require("./payment.routes"));
const createPaymentModule = () => {
    const router = (0, express_1.Router)();
    router.use('/', payment_routes_1.default);
    return router;
};
exports.createPaymentModule = createPaymentModule;
