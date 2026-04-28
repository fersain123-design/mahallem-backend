"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateBarcode = exports.isValidEan13Checksum = exports.calculateEan13CheckDigit = exports.normalizeBarcodeInput = exports.BARCODE_INVALID_MESSAGE = void 0;
exports.BARCODE_INVALID_MESSAGE = 'Bu barkod geçerli görünmüyor. Lütfen tekrar okutun veya elle kontrol edin.';
const normalizeBarcodeInput = (value) => {
    return String(value ?? '')
        .replace(/\s+/g, '')
        .trim();
};
exports.normalizeBarcodeInput = normalizeBarcodeInput;
const isSupportedBarcodeLength = (value) => {
    const length = String(value || '').length;
    return length === 8 || length === 12 || length === 13 || length === 14;
};
const calculateEan13CheckDigit = (firstTwelveDigits) => {
    if (!/^\d{12}$/.test(firstTwelveDigits)) {
        return null;
    }
    let sum = 0;
    for (let idx = 0; idx < 12; idx += 1) {
        const digit = Number(firstTwelveDigits[idx]);
        sum += idx % 2 === 0 ? digit : digit * 3;
    }
    const mod = sum % 10;
    return mod === 0 ? 0 : 10 - mod;
};
exports.calculateEan13CheckDigit = calculateEan13CheckDigit;
const isValidEan13Checksum = (barcode) => {
    const normalized = (0, exports.normalizeBarcodeInput)(barcode);
    if (!/^\d{13}$/.test(normalized)) {
        return false;
    }
    const expected = (0, exports.calculateEan13CheckDigit)(normalized.slice(0, 12));
    if (expected === null) {
        return false;
    }
    return expected === Number(normalized[12]);
};
exports.isValidEan13Checksum = isValidEan13Checksum;
const validateBarcode = (value) => {
    const normalizedBarcode = (0, exports.normalizeBarcodeInput)(value);
    if (!normalizedBarcode) {
        return { normalizedBarcode, isValid: false, reason: 'empty' };
    }
    if (!/^\d+$/.test(normalizedBarcode)) {
        return { normalizedBarcode, isValid: false, reason: 'invalid_format' };
    }
    if (!isSupportedBarcodeLength(normalizedBarcode)) {
        return { normalizedBarcode, isValid: false, reason: 'invalid_length' };
    }
    if (normalizedBarcode.length === 13 && !(0, exports.isValidEan13Checksum)(normalizedBarcode)) {
        return { normalizedBarcode, isValid: false, reason: 'invalid_ean13_checksum' };
    }
    return { normalizedBarcode, isValid: true, reason: 'ok' };
};
exports.validateBarcode = validateBarcode;
