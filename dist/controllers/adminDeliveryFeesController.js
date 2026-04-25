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
exports.updateDeliveryFeeBands = exports.getDeliveryFeeBands = void 0;
const errorHandler_1 = require("../middleware/errorHandler");
const deliveryFeeService = __importStar(require("../services/deliveryFeeService"));
const validationSchemas_1 = require("../utils/validationSchemas");
const getDeliveryFeeBands = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, 'Unauthorized');
        const bands = await deliveryFeeService.getDeliveryFeeBands();
        res.status(200).json({ success: true, data: { bands } });
    }
    catch (error) {
        next(error);
    }
};
exports.getDeliveryFeeBands = getDeliveryFeeBands;
const updateDeliveryFeeBands = async (req, res, next) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, 'Unauthorized');
        const parsed = validationSchemas_1.UpdateDeliveryFeeBandsSchema.parse(req.body);
        await deliveryFeeService.updateDeliveryFeeBands(parsed.bands);
        const bands = await deliveryFeeService.getDeliveryFeeBands();
        res.status(200).json({ success: true, data: { bands } });
    }
    catch (error) {
        next(error);
    }
};
exports.updateDeliveryFeeBands = updateDeliveryFeeBands;
