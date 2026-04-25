"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSettingByKey = exports.getSettings = void 0;
const settingsService = __importStar(require("../services/settingsService"));
const errorHandler_1 = require("../middleware/errorHandler");
const toKeyValueList = (settings) => {
    const list = [
        { key: 'commission_rate', value: String(settings?.commissionRate ?? '') },
        { key: 'min_order_amount', value: String(settings?.minOrderAmount ?? '') },
        { key: 'platform_min_basket_amount', value: String(settings?.minOrderAmount ?? '') },
        { key: 'max_order_amount', value: String(settings?.maxOrderAmount ?? '') },
        { key: 'currency', value: String(settings?.currency ?? '') },
        { key: 'default_store_fee', value: String(settings?.defaultStoreFee ?? '') },
        { key: 'platform_delivery_fee', value: String(settings?.defaultStoreFee ?? '') },
        {
            key: 'platform_delivery_enabled',
            value: String(Boolean(settings?.platformDeliveryEnabled ?? false)),
        },
    ];
    return list;
};
const getSettings = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, 'Unauthorized');
        const settings = await settingsService.getSettings();
        res.status(200).json({ success: true, data: { settings: toKeyValueList(settings) } });
    }
    catch (error) {
        next(error);
    }
};
exports.getSettings = getSettings;
const updateSettingByKey = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, 'Unauthorized');
        const keyRaw = String(req.params.key || '').trim();
        const value = req.body?.value;
        if (!keyRaw)
            throw new errorHandler_1.AppError(400, 'Setting key is required');
        // Only allow known keys; the admin UI currently sends values as strings.
        const key = keyRaw;
        if (key === 'commission_rate') {
            const commissionRate = typeof value === 'number' ? value : Number(String(value).trim());
            const updated = await settingsService.updateSettings({ commissionRate });
            res.status(200).json({ success: true, data: { key, value: String(updated.commissionRate) } });
            return;
        }
        if (key === 'min_order_amount' || key === 'platform_min_basket_amount') {
            const minOrderAmount = typeof value === 'number' ? value : Number(String(value).trim());
            const updated = await settingsService.updateSettings({ minOrderAmount });
            res.status(200).json({ success: true, data: { key, value: String(updated.minOrderAmount) } });
            return;
        }
        if (key === 'max_order_amount') {
            const maxOrderAmount = typeof value === 'number' ? value : Number(String(value).trim());
            const updated = await settingsService.updateSettings({ maxOrderAmount });
            res.status(200).json({ success: true, data: { key, value: String(updated.maxOrderAmount) } });
            return;
        }
        if (key === 'currency') {
            const currency = String(value ?? '').trim();
            const updated = await settingsService.updateSettings({ currency });
            res.status(200).json({ success: true, data: { key, value: String(updated.currency) } });
            return;
        }
        if (key === 'default_store_fee' || key === 'platform_delivery_fee') {
            const defaultStoreFee = typeof value === 'number' ? value : Number(String(value).trim());
            const updated = await settingsService.updateSettings({ defaultStoreFee });
            res
                .status(200)
                .json({ success: true, data: { key, value: String(updated.defaultStoreFee) } });
            return;
        }
        if (key === 'platform_delivery_enabled') {
            const normalized = String(value ?? '').trim().toLowerCase();
            const platformDeliveryEnabled = typeof value === 'boolean'
                ? value
                : normalized === 'true' || normalized === '1' || normalized === 'yes';
            const updated = await settingsService.updateSettings({ platformDeliveryEnabled });
            res.status(200).json({
                success: true,
                data: { key, value: String(Boolean(updated.platformDeliveryEnabled)) },
            });
            return;
        }
        throw new errorHandler_1.AppError(400, `Unknown setting key: ${keyRaw}`);
    }
    catch (error) {
        next(error);
    }
};
exports.updateSettingByKey = updateSettingByKey;
