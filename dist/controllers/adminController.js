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
exports.markNotificationAsRead = exports.createNotification = exports.getNotifications = exports.markPayoutAsPaid = exports.getPayoutById = exports.getPayouts = exports.updateOrderStatus = exports.getOrderById = exports.getOrders = exports.rejectProductForPricing = exports.deleteProduct = exports.setProductActive = exports.toggleProductActive = exports.bulkAssignProductSubCategories = exports.getUncategorizedProducts = exports.getProducts = exports.getCustomers = exports.unsuspendUser = exports.suspendUser = exports.getUserById = exports.getUsers = exports.createVendorViolation = exports.getVendorViolations = exports.reviewVendorDocument = exports.unsuspendVendor = exports.suspendVendor = exports.deactivateVendor = exports.rejectVendor = exports.approveVendor = exports.getVendorById = exports.openVendorIbanChange = exports.approveVendorIban = exports.getVendors = exports.getDashboard = void 0;
const adminService = __importStar(require("../services/adminService"));
const validationSchemas_1 = require("../utils/validationSchemas");
const getDashboard = async (req, res, next) => {
    try {
        const dashboard = await adminService.getAdminDashboard();
        res.status(200).json({ success: true, data: dashboard });
    }
    catch (error) {
        next(error);
    }
};
exports.getDashboard = getDashboard;
// Vendors
const getVendors = async (req, res, next) => {
    try {
        const { status, search, page, limit, ibanStatusIn } = req.query;
        const ibanStatuses = (() => {
            if (!ibanStatusIn)
                return undefined;
            if (Array.isArray(ibanStatusIn))
                return ibanStatusIn.map(String).filter(Boolean);
            return String(ibanStatusIn)
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
        })();
        const result = await adminService.getVendors(status, search, ibanStatuses, page ? parseInt(page) : 1, limit ? parseInt(limit) : 20);
        res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
};
exports.getVendors = getVendors;
const approveVendorIban = async (req, res, next) => {
    try {
        const { id } = req.params;
        const vendor = await adminService.approveVendorIban(id);
        res.status(200).json({ success: true, data: vendor });
    }
    catch (error) {
        next(error);
    }
};
exports.approveVendorIban = approveVendorIban;
const openVendorIbanChange = async (req, res, next) => {
    try {
        const { id } = req.params;
        const vendor = await adminService.openVendorIbanChange(id);
        res.status(200).json({ success: true, data: vendor });
    }
    catch (error) {
        next(error);
    }
};
exports.openVendorIbanChange = openVendorIbanChange;
const getVendorById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const vendor = await adminService.getVendorById(id);
        res.status(200).json({ success: true, data: vendor });
    }
    catch (error) {
        next(error);
    }
};
exports.getVendorById = getVendorById;
const approveVendor = async (req, res, next) => {
    try {
        const { id } = req.params;
        console.log('📝 Vendor approval request, ID:', id);
        const vendor = await adminService.approveVendor(id);
        console.log('✅ Vendor approved successfully:', vendor.id);
        res.status(200).json({ success: true, data: vendor });
    }
    catch (error) {
        console.error('❌ Vendor approval error:', error);
        next(error);
    }
};
exports.approveVendor = approveVendor;
const rejectVendor = async (req, res, next) => {
    try {
        const { id } = req.params;
        const data = validationSchemas_1.RejectVendorSchema.parse(req.body);
        console.log('📝 Vendor rejection request, ID:', id, 'Reason:', data.rejectionReason);
        const vendor = await adminService.rejectVendor(id, data.rejectionReason);
        console.log('✅ Vendor rejected successfully:', vendor.id);
        res.status(200).json({ success: true, data: vendor });
    }
    catch (error) {
        console.error('❌ Vendor rejection error:', error);
        next(error);
    }
};
exports.rejectVendor = rejectVendor;
const deactivateVendor = async (req, res, next) => {
    try {
        const { id } = req.params;
        const data = validationSchemas_1.DeactivateVendorSchema.parse(req.body);
        const result = await adminService.deactivateVendor(id, data.reason);
        res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
};
exports.deactivateVendor = deactivateVendor;
const suspendVendor = async (req, res, next) => {
    try {
        const { id } = req.params;
        const data = validationSchemas_1.DeactivateVendorSchema.parse(req.body);
        const result = await adminService.suspendVendor(id, data.reason);
        res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
};
exports.suspendVendor = suspendVendor;
const unsuspendVendor = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await adminService.unsuspendVendor(id);
        res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
};
exports.unsuspendVendor = unsuspendVendor;
const reviewVendorDocument = async (req, res, next) => {
    try {
        const { id } = req.params;
        const data = validationSchemas_1.ReviewVendorDocumentSchema.parse(req.body);
        const updated = await adminService.reviewVendorDocument(id, data);
        res.status(200).json({ success: true, data: updated });
    }
    catch (error) {
        next(error);
    }
};
exports.reviewVendorDocument = reviewVendorDocument;
const getVendorViolations = async (req, res, next) => {
    try {
        const { id } = req.params;
        const violations = await adminService.getVendorViolations(id);
        res.status(200).json({ success: true, data: violations });
    }
    catch (error) {
        next(error);
    }
};
exports.getVendorViolations = getVendorViolations;
const createVendorViolation = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const { id } = req.params;
        const data = validationSchemas_1.CreateVendorViolationSchema.parse(req.body);
        const created = await adminService.createVendorViolation(req.user.userId, id, data);
        res.status(201).json({ success: true, data: created });
    }
    catch (error) {
        next(error);
    }
};
exports.createVendorViolation = createVendorViolation;
// Users
const getUsers = async (req, res, next) => {
    try {
        const { role, search, page, limit } = req.query;
        const result = await adminService.getUsers(role, search, page ? parseInt(page) : 1, limit ? parseInt(limit) : 20);
        res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
};
exports.getUsers = getUsers;
const getUserById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = await adminService.getUserById(id);
        res.status(200).json({ success: true, data: user });
    }
    catch (error) {
        next(error);
    }
};
exports.getUserById = getUserById;
const suspendUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        const data = validationSchemas_1.DeactivateVendorSchema.parse(req.body);
        const user = await adminService.suspendUser(id, data.reason);
        res.status(200).json({ success: true, data: user });
    }
    catch (error) {
        next(error);
    }
};
exports.suspendUser = suspendUser;
const unsuspendUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = await adminService.unsuspendUser(id);
        res.status(200).json({ success: true, data: user });
    }
    catch (error) {
        next(error);
    }
};
exports.unsuspendUser = unsuspendUser;
// Customers (sadece CUSTOMER rolündeki kullanıcıları getirir)
const getCustomers = async (req, res, next) => {
    try {
        const { search, page, limit } = req.query;
        const result = await adminService.getCustomers(search, page ? parseInt(page) : 1, limit ? parseInt(limit) : 20);
        res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
};
exports.getCustomers = getCustomers;
// Products
const getProducts = async (req, res, next) => {
    try {
        const { isActive, approvalStatus, categorySlug, search, page, limit } = req.query;
        const normalizedApprovalStatus = typeof approvalStatus === 'string'
            ? approvalStatus.toUpperCase()
            : undefined;
        const result = await adminService.getProducts(isActive ? isActive === 'true' : undefined, normalizedApprovalStatus, categorySlug, search, page ? parseInt(page) : 1, limit ? parseInt(limit) : 20);
        res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
};
exports.getProducts = getProducts;
const getUncategorizedProducts = async (req, res, next) => {
    try {
        const { search, page, limit } = req.query;
        const result = await adminService.getUncategorizedProducts(search, page ? parseInt(page) : 1, limit ? parseInt(limit) : 20);
        res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
};
exports.getUncategorizedProducts = getUncategorizedProducts;
const bulkAssignProductSubCategories = async (req, res, next) => {
    try {
        const { productIds, subCategoryId, autoMatch } = req.body || {};
        const result = await adminService.bulkAssignProductSubCategories({
            productIds,
            subCategoryId,
            autoMatch,
        });
        res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
};
exports.bulkAssignProductSubCategories = bulkAssignProductSubCategories;
const toggleProductActive = async (req, res, next) => {
    try {
        const { id } = req.params;
        const product = await adminService.toggleProductActive(id);
        res.status(200).json({ success: true, data: product });
    }
    catch (error) {
        next(error);
    }
};
exports.toggleProductActive = toggleProductActive;
const setProductActive = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;
        if (typeof isActive !== 'boolean') {
            res.status(400).json({ success: false, message: 'isActive must be a boolean' });
            return;
        }
        const product = await adminService.setProductActive(id, isActive);
        res.status(200).json({ success: true, data: product });
    }
    catch (error) {
        next(error);
    }
};
exports.setProductActive = setProductActive;
const deleteProduct = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await adminService.deleteProductByAdmin(id);
        res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteProduct = deleteProduct;
const rejectProductForPricing = async (req, res, next) => {
    try {
        const { id } = req.params;
        const payload = validationSchemas_1.RejectProductForPricingSchema.parse(req.body || {});
        const product = await adminService.rejectProductForPricing(id, payload.reasonMessage, payload.reasonTitle);
        res.status(200).json({ success: true, data: product });
    }
    catch (error) {
        next(error);
    }
};
exports.rejectProductForPricing = rejectProductForPricing;
// Orders
const getOrders = async (req, res, next) => {
    try {
        const { status, vendorId, customerId, cancelReason, paymentStatus, page, limit } = req.query;
        const result = await adminService.getOrders(status, vendorId, customerId, cancelReason, paymentStatus, page ? parseInt(page) : 1, limit ? parseInt(limit) : 20);
        res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
};
exports.getOrders = getOrders;
const getOrderById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const order = await adminService.getOrderById(id);
        res.status(200).json({ success: true, data: order });
    }
    catch (error) {
        next(error);
    }
};
exports.getOrderById = getOrderById;
const updateOrderStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const data = validationSchemas_1.UpdateOrderStatusSchema.parse(req.body);
        const order = await adminService.updateOrderStatus(id, data.status);
        res.status(200).json({ success: true, data: order });
    }
    catch (error) {
        next(error);
    }
};
exports.updateOrderStatus = updateOrderStatus;
// Payouts
const getPayouts = async (req, res, next) => {
    try {
        const { status, page, limit } = req.query;
        const result = await adminService.getPayouts(status, page ? parseInt(page) : 1, limit ? parseInt(limit) : 20);
        res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
};
exports.getPayouts = getPayouts;
const getPayoutById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const payout = await adminService.getPayoutById(id);
        res.status(200).json({ success: true, data: payout });
    }
    catch (error) {
        next(error);
    }
};
exports.getPayoutById = getPayoutById;
const markPayoutAsPaid = async (req, res, next) => {
    try {
        const { id } = req.params;
        const payout = await adminService.markPayoutAsPaid(id);
        res.status(200).json({ success: true, data: payout });
    }
    catch (error) {
        next(error);
    }
};
exports.markPayoutAsPaid = markPayoutAsPaid;
// Notifications
const getNotifications = async (req, res, next) => {
    try {
        const { page, limit } = req.query;
        const userId = req.user.userId;
        const notifications = await adminService.getNotifications(userId, page ? parseInt(page) : 1, limit ? parseInt(limit) : 20);
        res.status(200).json({ success: true, data: notifications });
    }
    catch (error) {
        next(error);
    }
};
exports.getNotifications = getNotifications;
const createNotification = async (req, res, next) => {
    try {
        const { title, message, type, targetUsers, targetAudience, target_audience } = req.body;
        const userId = req.user.userId;
        const notification = await adminService.createNotification(userId, title, message, type, targetUsers, targetAudience || target_audience);
        res.status(201).json({ success: true, data: notification });
    }
    catch (error) {
        next(error);
    }
};
exports.createNotification = createNotification;
const markNotificationAsRead = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        const notification = await adminService.markNotificationAsRead(id, userId);
        res.status(200).json({ success: true, data: notification });
    }
    catch (error) {
        next(error);
    }
};
exports.markNotificationAsRead = markNotificationAsRead;
