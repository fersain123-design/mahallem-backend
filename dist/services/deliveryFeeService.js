"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateDeliveryFeeOrThrow = exports.calculateDeliveryFee = exports.updateDeliveryFeeBands = exports.getDeliveryFeeBands = exports.validateBands = void 0;
const db_1 = __importDefault(require("../config/db"));
const errorHandler_1 = require("../middleware/errorHandler");
const MIN_DELIVERY_FEE = 18;
const DEFAULT_BANDS = [
    { minKm: 0, maxKm: 1, fee: MIN_DELIVERY_FEE },
    { minKm: 1, maxKm: 3, fee: MIN_DELIVERY_FEE },
    { minKm: 3, maxKm: 5, fee: MIN_DELIVERY_FEE },
];
const normalize = (bands) => {
    const sorted = [...bands].sort((a, b) => a.minKm - b.minKm || a.maxKm - b.maxKm);
    return sorted.map((b) => ({
        minKm: Number(b.minKm),
        maxKm: Number(b.maxKm),
        fee: Number(b.fee),
    }));
};
const validateBands = (bands) => {
    if (!Array.isArray(bands) || bands.length === 0) {
        throw new errorHandler_1.AppError(400, 'Delivery fee bands are required');
    }
    const normalized = normalize(bands);
    for (const b of normalized) {
        if (!Number.isFinite(b.minKm) || !Number.isFinite(b.maxKm) || !Number.isFinite(b.fee)) {
            throw new errorHandler_1.AppError(400, 'Invalid delivery fee band values');
        }
        if (b.minKm < 0 || b.maxKm <= 0)
            throw new errorHandler_1.AppError(400, 'Km values must be > 0');
        if (b.maxKm <= b.minKm)
            throw new errorHandler_1.AppError(400, 'maxKm must be greater than minKm');
        if (b.fee < MIN_DELIVERY_FEE) {
            throw new errorHandler_1.AppError(400, `Fee must be >= ${MIN_DELIVERY_FEE}`);
        }
    }
    // Prevent overlaps
    for (let i = 1; i < normalized.length; i++) {
        const prev = normalized[i - 1];
        const cur = normalized[i];
        if (cur.minKm < prev.maxKm) {
            throw new errorHandler_1.AppError(400, 'Delivery fee bands must not overlap');
        }
    }
    return normalized;
};
exports.validateBands = validateBands;
const getDeliveryFeeBands = async () => {
    const settings = await db_1.default.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
    try {
        const parsed = JSON.parse(String(settings.deliveryFeeBands ?? '[]'));
        const bands = (0, exports.validateBands)(parsed);
        return bands;
    }
    catch (_e) {
        // Self-heal to defaults if corrupted
        const bands = DEFAULT_BANDS;
        await db_1.default.settings.update({
            where: { id: 1 },
            data: { deliveryFeeBands: JSON.stringify(bands) },
        });
        return bands;
    }
};
exports.getDeliveryFeeBands = getDeliveryFeeBands;
const updateDeliveryFeeBands = async (bands) => {
    const validated = (0, exports.validateBands)(bands);
    const updated = await db_1.default.settings.update({
        where: { id: 1 },
        data: { deliveryFeeBands: JSON.stringify(validated) },
    });
    return updated;
};
exports.updateDeliveryFeeBands = updateDeliveryFeeBands;
const calculateDeliveryFee = async (distanceKm) => {
    if (!Number.isFinite(distanceKm) || distanceKm < 0) {
        throw new errorHandler_1.AppError(400, 'distanceKm must be >= 0');
    }
    const bands = await (0, exports.getDeliveryFeeBands)();
    const match = bands.find((b) => distanceKm >= b.minKm && distanceKm <= b.maxKm);
    if (!match)
        return 0;
    return Math.max(MIN_DELIVERY_FEE, match.fee);
};
exports.calculateDeliveryFee = calculateDeliveryFee;
const calculateDeliveryFeeOrThrow = async (distanceKm) => {
    if (!Number.isFinite(distanceKm) || distanceKm < 0) {
        throw new errorHandler_1.AppError(400, 'distanceKm must be >= 0');
    }
    const bands = await (0, exports.getDeliveryFeeBands)();
    const match = bands.find((b) => distanceKm >= b.minKm && distanceKm <= b.maxKm);
    if (!match) {
        const maxKm = bands.reduce((m, b) => (b.maxKm > m ? b.maxKm : m), 0);
        throw new errorHandler_1.AppError(400, `Delivery is not available for this distance (max ${maxKm} km)`);
    }
    return Math.max(MIN_DELIVERY_FEE, match.fee);
};
exports.calculateDeliveryFeeOrThrow = calculateDeliveryFeeOrThrow;
