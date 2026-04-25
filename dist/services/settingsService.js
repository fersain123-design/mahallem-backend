"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateCommissionRate = exports.getCommissionRate = exports.updateSettings = exports.getSettings = void 0;
const db_1 = __importDefault(require("../config/db"));
const errorHandler_1 = require("../middleware/errorHandler");
const SETTINGS_ID = 1;
const ensureSettingsRow = async () => {
    return db_1.default.settings.upsert({
        where: { id: SETTINGS_ID },
        create: { id: SETTINGS_ID },
        update: {},
    });
};
const getSettings = async () => {
    return ensureSettingsRow();
};
exports.getSettings = getSettings;
const updateSettings = async (data) => {
    await ensureSettingsRow();
    if (data.commissionRate !== undefined &&
        (typeof data.commissionRate !== 'number' ||
            Number.isNaN(data.commissionRate) ||
            data.commissionRate < 0 ||
            data.commissionRate > 100)) {
        throw new errorHandler_1.AppError(400, 'Commission rate must be between 0 and 100');
    }
    if (data.platformFee !== undefined &&
        (typeof data.platformFee !== 'number' ||
            Number.isNaN(data.platformFee) ||
            data.platformFee < 0)) {
        throw new errorHandler_1.AppError(400, 'Platform fee must be >= 0');
    }
    if (data.minOrderAmount !== undefined &&
        (typeof data.minOrderAmount !== 'number' ||
            Number.isNaN(data.minOrderAmount) ||
            data.minOrderAmount < 0)) {
        throw new errorHandler_1.AppError(400, 'Min order amount must be >= 0');
    }
    if (data.maxOrderAmount !== undefined &&
        (typeof data.maxOrderAmount !== 'number' ||
            Number.isNaN(data.maxOrderAmount) ||
            data.maxOrderAmount < 0)) {
        throw new errorHandler_1.AppError(400, 'Max order amount must be >= 0');
    }
    if (data.minOrderAmount !== undefined &&
        data.maxOrderAmount !== undefined &&
        data.minOrderAmount > data.maxOrderAmount) {
        throw new errorHandler_1.AppError(400, 'Min order amount must be <= max order amount');
    }
    if (data.currency !== undefined) {
        const cur = String(data.currency || '').trim();
        if (!cur)
            throw new errorHandler_1.AppError(400, 'Currency is required');
        if (cur.length > 10)
            throw new errorHandler_1.AppError(400, 'Currency is too long');
        data.currency = cur;
    }
    if (data.defaultStoreFee !== undefined &&
        (typeof data.defaultStoreFee !== 'number' ||
            Number.isNaN(data.defaultStoreFee) ||
            data.defaultStoreFee < 0)) {
        throw new errorHandler_1.AppError(400, 'Default store delivery fee must be >= 0');
    }
    if (data.platformDeliveryEnabled !== undefined &&
        typeof data.platformDeliveryEnabled !== 'boolean') {
        throw new errorHandler_1.AppError(400, 'Platform delivery enabled must be a boolean');
    }
    const updated = await db_1.default.settings.update({
        where: { id: SETTINGS_ID },
        data,
    });
    return updated;
};
exports.updateSettings = updateSettings;
const getCommissionRate = async () => {
    const settings = await ensureSettingsRow();
    return settings.commissionRate;
};
exports.getCommissionRate = getCommissionRate;
const updateCommissionRate = async (rate) => {
    if (typeof rate !== 'number' || Number.isNaN(rate)) {
        throw new errorHandler_1.AppError(400, 'Commission rate must be a number');
    }
    if (rate < 0 || rate > 100) {
        throw new errorHandler_1.AppError(400, 'Commission rate must be between 0 and 100');
    }
    const updated = await db_1.default.settings.upsert({
        where: { id: SETTINGS_ID },
        create: { id: SETTINGS_ID, commissionRate: rate },
        update: { commissionRate: rate },
    });
    return updated;
};
exports.updateCommissionRate = updateCommissionRate;
