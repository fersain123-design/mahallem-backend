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
exports.updateAdminSellerCampaignStatus = exports.getAdminSellerCampaigns = exports.deleteVendorSellerCampaign = exports.updateVendorSellerCampaign = exports.createVendorSellerCampaign = exports.getVendorSellerCampaigns = void 0;
const validationSchemas_1 = require("../utils/validationSchemas");
const sellerCampaignService = __importStar(require("../services/sellerCampaignService"));
const getVendorSellerCampaigns = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const data = await sellerCampaignService.getVendorCampaigns(req.user.userId);
        res.status(200).json({ success: true, data });
    }
    catch (error) {
        next(error);
    }
};
exports.getVendorSellerCampaigns = getVendorSellerCampaigns;
const createVendorSellerCampaign = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const body = validationSchemas_1.SellerCampaignSchema.parse(req.body);
        const data = await sellerCampaignService.createVendorCampaign(req.user.userId, body);
        res.status(201).json({ success: true, data });
    }
    catch (error) {
        next(error);
    }
};
exports.createVendorSellerCampaign = createVendorSellerCampaign;
const updateVendorSellerCampaign = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const campaignId = String(req.params.id || '').trim();
        if (!campaignId) {
            res.status(400).json({ success: false, message: 'Campaign id is required' });
            return;
        }
        const body = validationSchemas_1.SellerCampaignSchema.parse(req.body);
        const data = await sellerCampaignService.updateVendorCampaign(req.user.userId, campaignId, body);
        res.status(200).json({ success: true, data });
    }
    catch (error) {
        next(error);
    }
};
exports.updateVendorSellerCampaign = updateVendorSellerCampaign;
const deleteVendorSellerCampaign = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const campaignId = String(req.params.id || '').trim();
        if (!campaignId) {
            res.status(400).json({ success: false, message: 'Campaign id is required' });
            return;
        }
        await sellerCampaignService.deleteVendorCampaign(req.user.userId, campaignId);
        res.status(200).json({ success: true, data: { id: campaignId } });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteVendorSellerCampaign = deleteVendorSellerCampaign;
const getAdminSellerCampaigns = async (req, res, next) => {
    try {
        const status = typeof req.query.status === 'string' ? req.query.status : undefined;
        const endingInDays = typeof req.query.endingInDays === 'string'
            ? Number(req.query.endingInDays)
            : undefined;
        const data = await sellerCampaignService.getAdminCampaigns({ status, endingInDays });
        res.status(200).json({ success: true, data });
    }
    catch (error) {
        next(error);
    }
};
exports.getAdminSellerCampaigns = getAdminSellerCampaigns;
const updateAdminSellerCampaignStatus = async (req, res, next) => {
    try {
        const campaignId = String(req.params.id || '').trim();
        if (!campaignId) {
            res.status(400).json({ success: false, message: 'Campaign id is required' });
            return;
        }
        const body = validationSchemas_1.AdminCampaignStatusSchema.parse(req.body);
        const data = await sellerCampaignService.updateAdminCampaignStatus({
            campaignId,
            status: body.status,
            rejectReason: body.rejectReason,
        });
        res.status(200).json({ success: true, data });
    }
    catch (error) {
        next(error);
    }
};
exports.updateAdminSellerCampaignStatus = updateAdminSellerCampaignStatus;
