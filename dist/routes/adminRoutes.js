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
const express_1 = require("express");
const adminController = __importStar(require("../controllers/adminController"));
const adminSupportController = __importStar(require("../controllers/adminSupportController"));
const promotionController = __importStar(require("../controllers/promotionController"));
const adminSettingsController = __importStar(require("../controllers/adminSettingsController"));
const adminDeliveryFeesController = __importStar(require("../controllers/adminDeliveryFeesController"));
const adminVendorDeliveryController = __importStar(require("../controllers/adminVendorDeliveryController"));
const sellerCampaignController = __importStar(require("../controllers/sellerCampaignController"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const requireRole_1 = require("../middleware/requireRole");
const router = (0, express_1.Router)();
// Dashboard
router.get('/dashboard', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), adminController.getDashboard);
// Settings
router.get('/settings', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), adminSettingsController.getSettings);
router.put('/settings/:key', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), adminSettingsController.updateSettingByKey);
// Delivery fee bands
router.get('/delivery-fees', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), adminDeliveryFeesController.getDeliveryFeeBands);
router.put('/delivery-fees', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), adminDeliveryFeesController.updateDeliveryFeeBands);
// Delivery / Vendor shipping
router.get('/vendor-delivery', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), adminVendorDeliveryController.getVendorDeliveryOverview);
router.get('/vendor-delivery/neighborhood-settings', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), adminVendorDeliveryController.getPlatformNeighborhoodDeliverySettings);
router.put('/vendor-delivery/neighborhood-settings', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), adminVendorDeliveryController.upsertPlatformNeighborhoodDeliverySetting);
router.post('/vendor-delivery/:id/approve', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), adminVendorDeliveryController.approveVendorDeliveryCoverageChange);
router.post('/vendor-delivery/:id/reject', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), adminVendorDeliveryController.rejectVendorDeliveryCoverageChange);
router.put('/vendor-delivery/:id', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), adminVendorDeliveryController.updateVendorDeliverySettings);
// Vendors
router.get('/vendors', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), adminController.getVendors);
router.get('/vendors/:id', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), adminController.getVendorById);
router.post('/vendors/:id/approve', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), adminController.approveVendor);
router.post('/vendors/:id/reject', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), adminController.rejectVendor);
router.post('/vendors/:id/documents/review', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), adminController.reviewVendorDocument);
router.post('/vendors/:id/iban/approve', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), adminController.approveVendorIban);
router.post('/vendors/:id/iban/open-change', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), adminController.openVendorIbanChange);
router.post('/vendors/:id/deactivate', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), adminController.deactivateVendor);
router.post('/vendors/:id/suspend', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), adminController.suspendVendor);
router.post('/vendors/:id/unsuspend', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), adminController.unsuspendVendor);
// Vendor Violations
router.get('/vendors/:id/violations', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), adminController.getVendorViolations);
router.post('/vendors/:id/violations', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), adminController.createVendorViolation);
// Users
router.get('/users', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), adminController.getUsers);
router.get('/users/:id', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), adminController.getUserById);
router.post('/users/:id/suspend', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), adminController.suspendUser);
router.post('/users/:id/unsuspend', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), adminController.unsuspendUser);
// Customers (alias for users?role=CUSTOMER)
router.get('/customers', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), adminController.getCustomers);
// Products
router.get('/products', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), adminController.getProducts);
router.get('/products/uncategorized', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), adminController.getUncategorizedProducts);
router.post('/products/bulk-assign-subcategory', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), adminController.bulkAssignProductSubCategories);
router.put('/products/:id/toggle-active', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), adminController.toggleProductActive);
router.put('/products/:id/active', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), adminController.setProductActive);
router.post('/products/:id/reject-pricing', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), adminController.rejectProductForPricing);
router.delete('/products/:id', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), adminController.deleteProduct);
// Orders
router.get('/orders', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), adminController.getOrders);
router.get('/orders/:id', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), adminController.getOrderById);
router.put('/orders/:id/status', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), adminController.updateOrderStatus);
// Payouts
router.get('/payouts', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), adminController.getPayouts);
router.get('/payouts/:id', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), adminController.getPayoutById);
router.post('/payouts/:id/mark-paid', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), adminController.markPayoutAsPaid);
// Support Chat
router.get('/support/conversations', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), adminSupportController.listConversations);
router.get('/support/conversations/:id', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), adminSupportController.getConversationById);
router.post('/support/conversations/:id/messages', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), adminSupportController.postAdminMessage);
router.post('/support/conversations/:id/close', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), adminSupportController.closeConversation);
// Notifications
router.get('/notifications', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), adminController.getNotifications);
router.post('/notifications', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), adminController.createNotification);
router.put('/notifications/:id/read', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), adminController.markNotificationAsRead);
// Promotions
router.get('/promotions/pending', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), promotionController.getPendingPromotions);
router.post('/promotions/:promotionId/approve', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), promotionController.approvePromotion);
router.post('/promotions/:promotionId/reject', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), promotionController.rejectPromotion);
// Seller campaigns (basket-based)
router.get('/seller-campaigns', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), sellerCampaignController.getAdminSellerCampaigns);
router.put('/seller-campaigns/:id/status', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['ADMIN']), sellerCampaignController.updateAdminSellerCampaignStatus);
exports.default = router;
