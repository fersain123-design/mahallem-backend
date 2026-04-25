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
exports.cancelCustomerOrder = exports.getOrderById = exports.updateOrderStatus = exports.getVendorOrders = exports.getCustomerOrders = exports.createOrder = void 0;
const orderService = __importStar(require("../services/orderService"));
const validationSchemas_1 = require("../utils/validationSchemas");
const createOrder = async (req, res, next) => {
    try {
        const authUser = req.user;
        if (!authUser) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const data = validationSchemas_1.CreateOrderSchema.parse(req.body);
        const order = await orderService.createOrder(authUser.userId, data);
        res.status(201).json({ success: true, data: order });
    }
    catch (error) {
        next(error);
    }
};
exports.createOrder = createOrder;
const getCustomerOrders = async (req, res, next) => {
    try {
        const authUser = req.user;
        if (!authUser) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const orders = await orderService.getCustomerOrders(authUser.userId);
        res.status(200).json({ success: true, data: orders });
    }
    catch (error) {
        next(error);
    }
};
exports.getCustomerOrders = getCustomerOrders;
const getVendorOrders = async (req, res, next) => {
    try {
        const authUser = req.user;
        if (!authUser) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const orders = await orderService.getVendorOrdersByUserId(authUser.userId);
        res.status(200).json({ success: true, data: orders });
    }
    catch (error) {
        next(error);
    }
};
exports.getVendorOrders = getVendorOrders;
const updateOrderStatus = async (req, res, next) => {
    try {
        const authUser = req.user;
        if (!authUser) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const { id } = req.params;
        const data = validationSchemas_1.UpdateOrderStatusSchema.parse(req.body);
        const order = await orderService.updateOrderStatus(id, authUser.userId, data.status);
        res.status(200).json({ success: true, data: order });
    }
    catch (error) {
        next(error);
    }
};
exports.updateOrderStatus = updateOrderStatus;
const getOrderById = async (req, res, next) => {
    try {
        const authUser = req.user;
        if (!authUser) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const { id } = req.params;
        const order = await orderService.getOrderById(id, authUser.userId);
        res.status(200).json({ success: true, data: order });
    }
    catch (error) {
        next(error);
    }
};
exports.getOrderById = getOrderById;
const cancelCustomerOrder = async (req, res, next) => {
    try {
        res.status(403).json({
            success: false,
            message: 'Sipariş iptali müşteri tarafından yapılamaz. İptal işlemi yalnızca satıcı veya admin tarafından yapılabilir.',
        });
    }
    catch (error) {
        next(error);
    }
};
exports.cancelCustomerOrder = cancelCustomerOrder;
