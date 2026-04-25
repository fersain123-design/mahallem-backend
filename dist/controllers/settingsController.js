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
exports.updateCommissionRate = exports.getCommissionRate = exports.updateSettings = exports.getSettings = void 0;
const settingsService = __importStar(require("../services/settingsService"));
const errorHandler_1 = require("../middleware/errorHandler");
const getSettings = async (req, res, next) => {
    try {
        if (!req.user) {
            throw new errorHandler_1.AppError(401, 'Unauthorized');
        }
        const settings = await settingsService.getSettings();
        res.status(200).json({ success: true, data: settings });
    }
    catch (error) {
        next(error);
    }
};
exports.getSettings = getSettings;
const updateSettings = async (req, res, next) => {
    try {
        if (!req.user) {
            throw new errorHandler_1.AppError(401, 'Unauthorized');
        }
        const settings = await settingsService.updateSettings(req.body);
        res.status(200).json({ success: true, data: settings });
    }
    catch (error) {
        next(error);
    }
};
exports.updateSettings = updateSettings;
const getCommissionRate = async (req, res, next) => {
    try {
        if (!req.user) {
            throw new errorHandler_1.AppError(401, 'Unauthorized');
        }
        const rate = await settingsService.getCommissionRate();
        res.status(200).json({ success: true, data: { commissionRate: rate } });
    }
    catch (error) {
        next(error);
    }
};
exports.getCommissionRate = getCommissionRate;
const updateCommissionRate = async (req, res, next) => {
    try {
        if (!req.user) {
            throw new errorHandler_1.AppError(401, 'Unauthorized');
        }
        const { rate } = req.body;
        if (typeof rate !== 'number') {
            throw new errorHandler_1.AppError(400, 'Commission rate must be a number');
        }
        const settings = await settingsService.updateCommissionRate(rate);
        res.status(200).json({ success: true, data: settings });
    }
    catch (error) {
        next(error);
    }
};
exports.updateCommissionRate = updateCommissionRate;
