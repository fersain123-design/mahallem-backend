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
exports.upsertPlatformNeighborhoodDeliverySetting = exports.getPlatformNeighborhoodDeliverySettings = exports.updateVendorDeliverySettings = exports.rejectVendorDeliveryCoverageChange = exports.approveVendorDeliveryCoverageChange = exports.getVendorDeliveryOverview = void 0;
const adminService = __importStar(require("../services/adminService"));
const validationSchemas_1 = require("../utils/validationSchemas");
const getVendorDeliveryOverview = async (req, res, next) => {
    try {
        const data = await adminService.getVendorDeliveryOverview();
        res.status(200).json({ success: true, data });
    }
    catch (error) {
        next(error);
    }
};
exports.getVendorDeliveryOverview = getVendorDeliveryOverview;
const approveVendorDeliveryCoverageChange = async (req, res, next) => {
    try {
        const vendorProfileId = String(req.params.id || '').trim();
        const updated = await adminService.approveVendorDeliveryCoverageChange(vendorProfileId);
        res.status(200).json({ success: true, data: updated });
    }
    catch (error) {
        next(error);
    }
};
exports.approveVendorDeliveryCoverageChange = approveVendorDeliveryCoverageChange;
const rejectVendorDeliveryCoverageChange = async (req, res, next) => {
    try {
        const vendorProfileId = String(req.params.id || '').trim();
        const updated = await adminService.rejectVendorDeliveryCoverageChange(vendorProfileId);
        res.status(200).json({ success: true, data: updated });
    }
    catch (error) {
        next(error);
    }
};
exports.rejectVendorDeliveryCoverageChange = rejectVendorDeliveryCoverageChange;
const updateVendorDeliverySettings = async (req, res, next) => {
    try {
        const vendorProfileId = String(req.params.id || '').trim();
        const raw = req.body || {};
        const payload = {};
        if (raw.deliveryMode !== undefined) {
            const mode = String(raw.deliveryMode || '').trim().toLowerCase();
            if (mode !== 'seller' && mode !== 'platform') {
                res.status(400).json({ success: false, message: 'deliveryMode must be seller or platform' });
                return;
            }
            payload.deliveryMode = mode;
        }
        if (raw.flatDeliveryFee !== undefined) {
            payload.flatDeliveryFee =
                raw.flatDeliveryFee === null || raw.flatDeliveryFee === ''
                    ? null
                    : Number(raw.flatDeliveryFee);
        }
        if (raw.freeOverAmount !== undefined) {
            payload.freeOverAmount =
                raw.freeOverAmount === null || raw.freeOverAmount === ''
                    ? null
                    : Number(raw.freeOverAmount);
        }
        if (raw.isActive !== undefined) {
            payload.isActive = Boolean(raw.isActive);
        }
        const updated = await adminService.updateVendorDeliverySettingsByAdmin(vendorProfileId, payload);
        res.status(200).json({ success: true, data: updated });
    }
    catch (error) {
        next(error);
    }
};
exports.updateVendorDeliverySettings = updateVendorDeliverySettings;
const getPlatformNeighborhoodDeliverySettings = async (req, res, next) => {
    try {
        const query = String(req.query.q || '').trim();
        const data = await adminService.getPlatformNeighborhoodDeliverySettings(query || undefined);
        res.status(200).json({ success: true, data });
    }
    catch (error) {
        next(error);
    }
};
exports.getPlatformNeighborhoodDeliverySettings = getPlatformNeighborhoodDeliverySettings;
const upsertPlatformNeighborhoodDeliverySetting = async (req, res, next) => {
    try {
        const payload = validationSchemas_1.AdminNeighborhoodDeliverySettingSchema.parse(req.body);
        const data = await adminService.savePlatformNeighborhoodDeliverySetting(payload);
        res.status(200).json({ success: true, data });
    }
    catch (error) {
        next(error);
    }
};
exports.upsertPlatformNeighborhoodDeliverySetting = upsertPlatformNeighborhoodDeliverySetting;
