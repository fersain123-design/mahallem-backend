"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveOrderItemFinancials = exports.clampCommissionRate = exports.toMoney = void 0;
const toMoney = (value) => {
    const amount = Number(value || 0);
    if (!Number.isFinite(amount))
        return 0;
    return Number(amount.toFixed(2));
};
exports.toMoney = toMoney;
const clampCommissionRate = (value) => {
    const rate = Number(value || 0);
    if (!Number.isFinite(rate))
        return 0;
    return Math.min(Math.max(rate, 0), 100);
};
exports.clampCommissionRate = clampCommissionRate;
const resolveOrderItemFinancials = (orderItem, fallbackCommissionRate = 0) => {
    const subtotal = (0, exports.toMoney)(orderItem?.subtotal);
    const storedRate = (0, exports.clampCommissionRate)(orderItem?.commissionRateSnapshot);
    const storedCommission = Number(orderItem?.commissionAmount);
    const storedVendorNet = Number(orderItem?.vendorNetAmount);
    const hasStoredFinancials = subtotal === 0 ||
        (Number.isFinite(storedCommission) && storedCommission > 0) ||
        (Number.isFinite(storedVendorNet) && storedVendorNet > 0) ||
        storedRate > 0;
    const rate = hasStoredFinancials ? storedRate : (0, exports.clampCommissionRate)(fallbackCommissionRate);
    const commissionAmount = hasStoredFinancials && Number.isFinite(storedCommission)
        ? (0, exports.toMoney)(storedCommission)
        : (0, exports.toMoney)(subtotal * (rate / 100));
    const vendorNetAmount = hasStoredFinancials && Number.isFinite(storedVendorNet) && storedVendorNet >= 0
        ? (0, exports.toMoney)(storedVendorNet)
        : (0, exports.toMoney)(subtotal - commissionAmount);
    return {
        subtotal,
        commissionRate: rate,
        commissionAmount,
        vendorNetAmount,
    };
};
exports.resolveOrderItemFinancials = resolveOrderItemFinancials;
