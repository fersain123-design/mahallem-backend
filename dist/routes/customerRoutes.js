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
const customerController = __importStar(require("../controllers/customerController"));
const orderController = __importStar(require("../controllers/orderController"));
const promotionController = __importStar(require("../controllers/promotionController"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const requireRole_1 = require("../middleware/requireRole");
const router = (0, express_1.Router)();
// Public catalog (no auth)
router.get('/categories', customerController.getCategories);
router.get('/products', customerController.getProducts);
router.get('/products/:id', customerController.getProductById);
router.get('/vendors', customerController.getVendors);
router.get('/vendors/all', customerController.getVendors); // Alias for mobile app
// Profile
router.get('/profile', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['CUSTOMER']), customerController.getProfile);
router.put('/profile', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['CUSTOMER']), customerController.updateProfile);
router.get('/notifications', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['CUSTOMER']), customerController.getNotifications);
router.put('/notifications/:id/read', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['CUSTOMER']), customerController.markNotificationAsRead);
router.put('/notifications/read-all', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['CUSTOMER']), customerController.markAllNotificationsAsRead);
router.post('/push-token', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['CUSTOMER']), customerController.registerPushToken);
router.delete('/push-token', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['CUSTOMER']), customerController.unregisterPushToken);
router.post('/notifications/test-push', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['CUSTOMER']), customerController.sendTestPushNotification);
router.get('/push-status', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['CUSTOMER']), customerController.getPushStatus);
// Addresses
router.get('/addresses', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['CUSTOMER']), customerController.getAddresses);
router.get('/addresses/:id', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['CUSTOMER']), customerController.getAddressById);
router.post('/addresses', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['CUSTOMER']), customerController.addAddress);
router.put('/addresses/:id', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['CUSTOMER']), customerController.updateAddress);
router.delete('/addresses/:id', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['CUSTOMER']), customerController.deleteAddress);
router.post('/addresses/:id/set-default', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['CUSTOMER']), customerController.setDefaultAddress);
// Cart
router.get('/cart', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['CUSTOMER']), customerController.getCart);
router.post('/cart/add', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['CUSTOMER']), customerController.addToCart);
router.post('/cart/update', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['CUSTOMER']), customerController.updateCartItem);
router.post('/cart/remove', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['CUSTOMER']), customerController.removeFromCart);
router.post('/cart/clear', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['CUSTOMER']), customerController.clearCart);
router.get('/cart/delivery-estimate', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['CUSTOMER']), customerController.getCartDeliveryEstimate);
// Orders
router.post('/orders', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['CUSTOMER']), customerController.createOrder);
router.get('/orders', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['CUSTOMER']), orderController.getCustomerOrders);
router.get('/orders/:id', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['CUSTOMER']), orderController.getOrderById);
router.get('/orders/:id/rating', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['CUSTOMER']), customerController.getOrderSellerRating);
router.post('/orders/:id/rating', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['CUSTOMER']), customerController.createOrderSellerRating);
router.put('/orders/:id/rating', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['CUSTOMER']), customerController.updateOrderSellerRating);
router.post('/orders/:id/cancel', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['CUSTOMER']), orderController.cancelCustomerOrder);
// Promotions
router.get('/promotions', promotionController.getActivePromotions);
exports.default = router;
