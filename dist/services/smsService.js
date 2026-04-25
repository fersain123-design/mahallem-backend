"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendLoginOtpSms = exports.sendPasswordResetOtpSms = void 0;
const phoneUtils_1 = require("../utils/phoneUtils");
const axios_1 = __importDefault(require("axios"));
const VATAN_SMS_URL = 'https://api.vatansms.net/sms/send';
const normalizeTurkishPhone = (rawPhone) => {
    const digits = String(rawPhone || '').replace(/\D/g, '');
    if (digits.startsWith('90') && digits.length === 12)
        return digits;
    if (digits.startsWith('0') && digits.length === 11)
        return `9${digits}`;
    if (digits.length === 10)
        return `90${digits}`;
    return digits;
};
const assertVatanSmsConfig = () => {
    const missing = ['VATANSMS_USER', 'VATANSMS_PASS', 'VATANSMS_HEADER'].filter((key) => !String(process.env[key] || '').trim());
    if (missing.length > 0) {
        throw new Error(`VatanSMS config eksik: ${missing.join(', ')}`);
    }
};
const sendOtpViaVatanSms = async (phone, otpCode) => {
    assertVatanSmsConfig();
    const gsm = normalizeTurkishPhone(phone);
    if (!/^90\d{10}$/.test(gsm)) {
        throw new Error(`Gecersiz telefon formati: ${phone}. Beklenen: 905XXXXXXXXX`);
    }
    const message = `Kodunuz: ${String(otpCode || '').trim()}`;
    if (!String(otpCode || '').trim()) {
        throw new Error('OTP kodu bos olamaz.');
    }
    try {
        const response = await axios_1.default.get(VATAN_SMS_URL, {
            params: {
                user: process.env.VATANSMS_USER,
                password: process.env.VATANSMS_PASS,
                gsm,
                message,
                sender: process.env.VATANSMS_HEADER,
            },
            timeout: 15000,
        });
        return {
            provider: 'vatansms',
            accepted: true,
            raw: response.data,
        };
    }
    catch (error) {
        const responseData = error?.response?.data;
        const status = error?.response?.status;
        const detail = responseData || error?.message || String(error);
        console.error('[SMS:VATANSMS] Gonderim hatasi', {
            phone: (0, phoneUtils_1.maskPhone)(phone),
            status,
            detail,
        });
        throw new Error(`VatanSMS gonderim basarisiz: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
    }
};
const sendPasswordResetOtpSms = async (params) => {
    const result = await sendOtpViaVatanSms(params.phone, params.otpCode);
    console.log(`[SMS:VATANSMS] Password reset OTP sent to ${(0, phoneUtils_1.maskPhone)(params.phone)} (expires ${params.expiresMinutes}m).`);
    return result;
};
exports.sendPasswordResetOtpSms = sendPasswordResetOtpSms;
const sendLoginOtpSms = async (params) => {
    const result = await sendOtpViaVatanSms(params.phone, params.otpCode);
    console.log(`[SMS:VATANSMS] Login OTP sent to ${(0, phoneUtils_1.maskPhone)(params.phone)} (expires ${params.expiresMinutes}m).`);
    return result;
};
exports.sendLoginOtpSms = sendLoginOtpSms;
