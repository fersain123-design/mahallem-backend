"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.maskPhone = exports.buildPhoneLookupCandidates = exports.normalizePhoneToE164 = void 0;
const normalizePhoneToE164 = (value) => {
    const raw = String(value || '').trim();
    if (!raw)
        return null;
    let digits = raw.replace(/\D/g, '');
    if (digits.startsWith('00')) {
        digits = digits.slice(2);
    }
    if (digits.startsWith('90') && digits.length === 12) {
        return `+${digits}`;
    }
    if (digits.startsWith('0') && digits.length === 11) {
        return `+90${digits.slice(1)}`;
    }
    if (digits.length === 10) {
        return `+90${digits}`;
    }
    return null;
};
exports.normalizePhoneToE164 = normalizePhoneToE164;
const buildPhoneLookupCandidates = (value) => {
    const raw = String(value || '').trim();
    const digits = raw.replace(/\D/g, '');
    const candidates = new Set();
    if (raw)
        candidates.add(raw);
    if (digits)
        candidates.add(digits);
    if (digits.startsWith('0')) {
        candidates.add(digits.slice(1));
    }
    else if (digits.length > 0) {
        candidates.add(`0${digits}`);
    }
    if (digits.startsWith('90') && digits.length === 12) {
        candidates.add(digits.slice(2));
        candidates.add(`0${digits.slice(2)}`);
        candidates.add(`+${digits}`);
    }
    return Array.from(candidates).filter(Boolean);
};
exports.buildPhoneLookupCandidates = buildPhoneLookupCandidates;
const maskPhone = (value) => {
    const digits = String(value || '').replace(/\D/g, '');
    if (digits.length < 4)
        return '***';
    return `***${digits.slice(-4)}`;
};
exports.maskPhone = maskPhone;
