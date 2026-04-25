"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertTransition = exports.canTransition = void 0;
const errorHandler_1 = require("../../middleware/errorHandler");
const transitions = {
    CREATED: ['INITIALIZED', 'FAILED', 'CANCELLED'],
    INITIALIZED: ['PENDING', 'PAID', 'FAILED', 'REVIEW', 'CANCELLED'],
    PENDING: ['PAID', 'FAILED', 'REVIEW', 'CANCELLED'],
    REVIEW: ['PAID', 'FAILED', 'CANCELLED'],
    PAID: ['REFUNDED'],
    REFUNDED: [],
    FAILED: [],
    CANCELLED: [],
};
const canTransition = (from, to) => {
    if (from === to)
        return true;
    return transitions[from].includes(to);
};
exports.canTransition = canTransition;
const assertTransition = (from, to) => {
    if (!(0, exports.canTransition)(from, to)) {
        throw new errorHandler_1.AppError(409, `Invalid payment status transition: ${from} -> ${to}`);
    }
};
exports.assertTransition = assertTransition;
