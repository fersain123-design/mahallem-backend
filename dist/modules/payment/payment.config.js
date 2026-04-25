"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redactSecret = exports.getPaymentConfig = void 0;
const errorHandler_1 = require("../../middleware/errorHandler");
const read = (key, fallback = '') => String(process.env[key] || fallback).trim();
const getPaymentConfig = () => {
    const enabled = read('IYZICO_ENABLED', 'true') !== 'false';
    const config = {
        currency: read('PAYMENT_CURRENCY', 'TRY'),
        locale: read('PAYMENT_DEFAULT_LOCALE', 'tr'),
        mockMode: read('IYZICO_MOCK_MODE', '0') === '1',
        iyzico: {
            enabled,
            apiKey: read('IYZICO_API_KEY'),
            secretKey: read('IYZICO_SECRET_KEY'),
            baseUrl: read('IYZICO_BASE_URL', 'https://sandbox-api.iyzipay.com'),
            callbackUrl: read('IYZICO_CALLBACK_URL'),
            webhookUrl: read('IYZICO_WEBHOOK_URL'),
            merchantName: read('IYZICO_MERCHANT_NAME', 'Mahallem'),
        },
    };
    if (enabled && !config.mockMode) {
        const missing = [];
        if (!config.iyzico.apiKey)
            missing.push('IYZICO_API_KEY');
        if (!config.iyzico.secretKey)
            missing.push('IYZICO_SECRET_KEY');
        if (!config.iyzico.callbackUrl)
            missing.push('IYZICO_CALLBACK_URL');
        if (!config.iyzico.webhookUrl)
            missing.push('IYZICO_WEBHOOK_URL');
        if (missing.length > 0) {
            throw new errorHandler_1.AppError(500, `Missing payment env values: ${missing.join(', ')}`);
        }
    }
    return config;
};
exports.getPaymentConfig = getPaymentConfig;
const redactSecret = (value) => {
    if (!value)
        return '';
    if (value.length <= 6)
        return '***';
    return `${value.slice(0, 2)}***${value.slice(-2)}`;
};
exports.redactSecret = redactSecret;
