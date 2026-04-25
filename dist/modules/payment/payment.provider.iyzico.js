"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapIyzicoRefundStatus = exports.mapIyzicoSubmerchantStatus = exports.IyzicoPaymentProvider = void 0;
const axios_1 = __importDefault(require("axios"));
const errorHandler_1 = require("../../middleware/errorHandler");
const payment_config_1 = require("./payment.config");
const iyzico_auth_1 = require("./providers/iyzico.auth");
const iyzico_signature_1 = require("./providers/iyzico.signature");
const STATUS_MAP = {
    success: 'PAID',
    failure: 'FAILED',
    pending: 'PENDING',
    init_threeds: 'PENDING',
    callback_three_ds: 'PENDING',
};
class IyzicoPaymentProvider {
    constructor() {
        this.provider = 'IYZICO';
        this.config = (0, payment_config_1.getPaymentConfig)();
        this.client = axios_1.default.create({
            baseURL: this.config.iyzico.baseUrl,
            timeout: 20000,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    async createSubmerchant(payload) {
        if (this.config.mockMode) {
            return {
                key: `mock_subm_${payload.vendorId}`,
                status: 'ACTIVE',
                raw: { status: 'success', subMerchantKey: `mock_subm_${payload.vendorId}` },
            };
        }
        const body = {
            locale: this.config.locale,
            conversationId: `subm-${payload.vendorId}-${Date.now()}`,
            subMerchantExternalId: payload.vendorId,
            subMerchantType: payload.merchantType || 'PRIVATE_COMPANY',
            address: payload.address,
            taxOffice: 'N/A',
            legalCompanyTitle: payload.name,
            email: payload.email,
            gsmNumber: payload.gsmNumber,
            name: payload.name,
            iban: payload.iban,
            identityNumber: payload.identityNumber,
            taxNumber: payload.taxNumber,
            contactName: payload.contactName || payload.name,
            currency: this.config.currency,
        };
        const response = await this.post('/onboarding/submerchant', body);
        const key = String(response?.subMerchantKey || '').trim();
        if (!key) {
            throw new errorHandler_1.AppError(502, 'Iyzico submerchant key could not be created');
        }
        return {
            key,
            status: String(response?.status || '').toLowerCase() === 'success' ? 'ACTIVE' : 'PENDING',
            raw: response,
        };
    }
    async updateSubmerchant(subMerchantKey, payload) {
        if (this.config.mockMode) {
            return {
                key: subMerchantKey,
                status: 'ACTIVE',
                raw: { status: 'success', subMerchantKey, vendorId: payload.vendorId },
            };
        }
        const body = {
            locale: this.config.locale,
            conversationId: `subm-update-${payload.vendorId}-${Date.now()}`,
            subMerchantKey,
            iban: payload.iban,
            address: payload.address,
            contactName: payload.contactName || payload.name,
            email: payload.email,
            gsmNumber: payload.gsmNumber,
        };
        const response = await this.post('/onboarding/submerchant', body);
        return {
            key: subMerchantKey,
            status: String(response?.status || '').toLowerCase() === 'success' ? 'ACTIVE' : 'PENDING',
            raw: response,
        };
    }
    async initializeCheckout(payload) {
        if (this.config.mockMode) {
            const token = `mock_tok_${payload.basketId}_${Date.now()}`;
            return {
                conversationId: payload.conversationId,
                token,
                paymentPageUrl: `https://sandbox.iyzico.mock/checkout/${token}`,
                status: 'INITIALIZED',
                raw: {
                    status: 'success',
                    token,
                    paymentPageUrl: `https://sandbox.iyzico.mock/checkout/${token}`,
                    conversationId: payload.conversationId,
                },
            };
        }
        const response = await this.post('/payment/iyzipos/checkoutform/initialize/auth/ecom', payload);
        const token = String(response?.token || '').trim();
        const paymentPageUrl = String(response?.paymentPageUrl || '').trim();
        if (!token || !paymentPageUrl) {
            throw new errorHandler_1.AppError(502, 'Iyzico initialize response is missing token or paymentPageUrl');
        }
        return {
            conversationId: String(response?.conversationId || payload.conversationId),
            token,
            paymentPageUrl,
            status: 'INITIALIZED',
            raw: response,
        };
    }
    async retrieveCheckoutResult(token, conversationId) {
        if (this.config.mockMode) {
            const lowered = String(token || '').toLowerCase();
            const hint = String(conversationId || '').toLowerCase();
            const mockedStatus = lowered.includes('fail') || hint.includes('fail')
                ? 'FAILED'
                : lowered.includes('review') || hint.includes('review')
                    ? 'REVIEW'
                    : lowered.includes('pending') || hint.includes('pending')
                        ? 'PENDING'
                        : 'PAID';
            const fraudStatus = mockedStatus === 'REVIEW' ? 0 : 1;
            return {
                conversationId: conversationId || `mock-retrieve-${Date.now()}`,
                token,
                providerPaymentId: `mock_pay_${Date.now()}`,
                paymentStatus: mockedStatus,
                fraudStatus,
                paidPrice: undefined,
                currency: this.config.currency,
                transactions: [],
                raw: {
                    status: mockedStatus === 'FAILED' ? 'failure' : 'success',
                    paymentStatus: mockedStatus.toLowerCase(),
                    fraudStatus,
                },
            };
        }
        const body = {
            locale: this.config.locale,
            conversationId: conversationId || `retrieve-${Date.now()}`,
            token,
        };
        const response = await this.post('/payment/iyzipos/checkoutform/auth/ecom/detail', body);
        const transactions = Array.isArray(response?.itemTransactions)
            ? response.itemTransactions.map((item) => ({
                basketItemId: String(item?.itemId || ''),
                paymentTransactionId: item?.paymentTransactionId ? String(item.paymentTransactionId) : undefined,
                paidPrice: item?.paidPrice == null || Number.isNaN(Number(item.paidPrice))
                    ? undefined
                    : Number(item.paidPrice),
            }))
            : [];
        const providerStatus = String(response?.paymentStatus || response?.status || 'failure');
        const fraudStatus = response?.fraudStatus == null || Number.isNaN(Number(response.fraudStatus))
            ? undefined
            : Number(response.fraudStatus);
        return {
            conversationId: response?.conversationId ? String(response.conversationId) : undefined,
            token,
            providerPaymentId: response?.paymentId ? String(response.paymentId) : undefined,
            paymentStatus: this.mapProviderStatus(providerStatus, fraudStatus),
            fraudStatus,
            paidPrice: response?.paidPrice == null || Number.isNaN(Number(response.paidPrice))
                ? undefined
                : Number(response.paidPrice),
            currency: response?.currency ? String(response.currency) : undefined,
            transactions,
            raw: response,
        };
    }
    async approvePaymentIfNeeded(paymentId) {
        if (this.config.mockMode) {
            return;
        }
        const body = {
            locale: this.config.locale,
            conversationId: `approve-${paymentId}-${Date.now()}`,
            paymentId,
        };
        await this.post('/payment/iyzipos/approve', body);
    }
    async refundPayment(args) {
        if (this.config.mockMode) {
            return {
                status: 'SUCCEEDED',
                providerRefundId: `mock_refund_${args.paymentId}_${Date.now()}`,
                raw: { status: 'success', conversationId: args.conversationId },
            };
        }
        const body = {
            locale: this.config.locale,
            conversationId: args.conversationId,
            paymentTransactionId: args.paymentTransactionId,
            price: args.amount,
            ip: '127.0.0.1',
            currency: args.currency,
        };
        const response = await this.post('/payment/refund', body);
        const ok = String(response?.status || '').toLowerCase() === 'success';
        return {
            status: ok ? 'SUCCEEDED' : 'FAILED',
            providerRefundId: response?.paymentTransactionId
                ? String(response.paymentTransactionId)
                : undefined,
            raw: response,
        };
    }
    async validateCallback(payload, signature) {
        if (this.config.mockMode) {
            if (!signature || signature !== 'mock-signature-ok') {
                return { isValid: false, reason: 'Invalid mock signature' };
            }
            return { isValid: true };
        }
        const valid = (0, iyzico_signature_1.validateIyzicoSignature)({
            payload,
            signatureHeader: signature,
            secretKey: this.config.iyzico.secretKey,
        });
        if (!valid) {
            return { isValid: false, reason: 'Invalid iyzico signature' };
        }
        return { isValid: true };
    }
    mapProviderStatus(status, fraudStatus) {
        const base = STATUS_MAP[String(status || '').toLowerCase()] || 'FAILED';
        if (base === 'PAID' && fraudStatus != null && Number(fraudStatus) !== 1) {
            return 'REVIEW';
        }
        return base;
    }
    async post(path, body) {
        const bodyText = JSON.stringify(body || {});
        const { authorization } = (0, iyzico_auth_1.generateIyzicoAuthorizationHeader)({
            apiKey: this.config.iyzico.apiKey,
            secretKey: this.config.iyzico.secretKey,
            uriPath: path,
            requestBody: bodyText,
        });
        try {
            const response = await this.client.post(path, body, {
                headers: {
                    Authorization: authorization,
                    'x-iyzi-client-version': 'mahallem-backend-1.0',
                },
            });
            return response.data;
        }
        catch (error) {
            const message = String(error?.response?.data?.errorMessage || error?.message || 'Iyzico request failed');
            throw new errorHandler_1.AppError(502, `Iyzico error: ${message}`);
        }
    }
}
exports.IyzicoPaymentProvider = IyzicoPaymentProvider;
const mapIyzicoSubmerchantStatus = (statusText) => {
    const lowered = String(statusText || '').toLowerCase();
    if (lowered === 'active' || lowered === 'success')
        return 'ACTIVE';
    if (lowered === 'inactive')
        return 'INACTIVE';
    if (lowered === 'failed' || lowered === 'failure')
        return 'FAILED';
    return 'PENDING';
};
exports.mapIyzicoSubmerchantStatus = mapIyzicoSubmerchantStatus;
const mapIyzicoRefundStatus = (statusText) => {
    const lowered = String(statusText || '').toLowerCase();
    if (lowered === 'success' || lowered === 'succeeded')
        return 'SUCCEEDED';
    if (lowered === 'failed' || lowered === 'failure')
        return 'FAILED';
    return 'REQUESTED';
};
exports.mapIyzicoRefundStatus = mapIyzicoRefundStatus;
