"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.attachOrderCodeList = exports.attachOrderCode = exports.toOrderCode = void 0;
const toOrderCode = (orderId) => {
    const raw = String(orderId || '').trim();
    if (!raw)
        return '';
    return raw.slice(-6).toUpperCase();
};
exports.toOrderCode = toOrderCode;
const attachOrderCode = (order) => {
    const code = (0, exports.toOrderCode)(String(order?.id || ''));
    return {
        ...order,
        orderCode: code,
        order_code: code,
    };
};
exports.attachOrderCode = attachOrderCode;
const attachOrderCodeList = (orders) => {
    return orders.map((item) => (0, exports.attachOrderCode)(item));
};
exports.attachOrderCodeList = attachOrderCodeList;
