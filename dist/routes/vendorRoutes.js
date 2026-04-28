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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const vendorController = __importStar(require("../controllers/vendorController"));
const orderController = __importStar(require("../controllers/orderController"));
const promotionController = __importStar(require("../controllers/promotionController"));
const sellerCampaignController = __importStar(require("../controllers/sellerCampaignController"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const requireRole_1 = require("../middleware/requireRole");
const multer_1 = __importDefault(require("multer"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const vendorControllerAny = vendorController;
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
const uploadRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 10 * 60 * 1000,
    max: Math.max(5, Number(process.env.VENDOR_UPLOAD_RATE_LIMIT_MAX || 30)),
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Cok fazla yukleme denemesi. Lutfen daha sonra tekrar deneyin.',
    },
});
const router = (0, express_1.Router)();
// Profile
router.get('/profile', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['VENDOR']), vendorController.getProfile);
router.put('/profile', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['VENDOR']), vendorController.updateProfile);
// Storefront (Mahallem Mağazam)
router.get('/storefront', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['VENDOR']), vendorController.getStorefront);
router.put('/storefront', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['VENDOR']), vendorController.updateStorefront);
router.post('/storefront/images', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['VENDOR']), upload.single('file'), vendorController.uploadStoreImage);
router.delete('/storefront/images/:id', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['VENDOR']), vendorController.deleteStoreImage);
// Bank Account
router.get('/bank-account', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['VENDOR']), vendorController.getBankAccount);
router.put('/bank-account', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['VENDOR']), vendorController.updateBankAccount);
router.post('/iban/change-request', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['VENDOR']), vendorControllerAny.requestIbanChange);
// Delivery coverage (admin approval required after registration)
router.post('/delivery-coverage/change-request', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['VENDOR']), vendorController.requestDeliveryCoverageChange);
router.get('/delivery-settings', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['VENDOR']), vendorController.getDeliverySettings);
router.put('/delivery-settings', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['VENDOR']), vendorController.updateDeliverySettings);
// Payouts
router.get('/payouts', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['VENDOR']), vendorController.getPayouts);
router.post('/payouts/request', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['VENDOR']), vendorController.createPayoutRequest);
router.get('/payouts/:id', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['VENDOR']), vendorController.getPayoutById);
// Products
router.get('/products', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['VENDOR']), vendorController.getProducts);
router.post('/products/lookup-barcode', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['VENDOR']), vendorControllerAny.lookupProductByBarcode);
router.get('/products/smart-suggestions', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['VENDOR']), vendorController.getCategorySmartSuggestions);
router.get('/products/:id', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['VENDOR']), vendorController.getProductById);
router.post('/products', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['VENDOR']), vendorController.createProduct);
router.get('/categories', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['VENDOR']), vendorController.getCategories);
router.post('/categories', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['VENDOR']), vendorController.createCategory);
router.put('/categories/:id', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['VENDOR']), vendorController.updateCategory);
router.delete('/categories/:id', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['VENDOR']), vendorController.deleteCategory);
router.put('/products/:id', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['VENDOR']), vendorController.updateProduct);
router.delete('/products/:id', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['VENDOR']), vendorController.deleteProduct);
router.get('/products/:id/reviews', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['VENDOR']), vendorController.getProductReviews);
router.post('/products/:id/reviews/:reviewId/reply', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['VENDOR']), vendorController.replyToProductReview);
// Orders
router.get('/orders', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['VENDOR']), vendorController.getOrders);
router.get('/orders/:id', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['VENDOR']), vendorController.getOrderById);
router.put('/orders/:id/status', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['VENDOR']), vendorController.updateOrderStatus);
// Dashboard
router.get('/dashboard', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['VENDOR']), vendorController.getDashboard);
// Notifications
router.get('/notifications', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['VENDOR']), vendorController.getNotifications);
router.put('/notifications/:id/read', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['VENDOR']), vendorController.markNotificationAsRead);
// Documents
router.post('/upload-tax-sheet', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['VENDOR']), uploadRateLimit, vendorController.uploadTaxSheet);
router.post('/upload-document', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['VENDOR']), uploadRateLimit, vendorController.uploadDocument);
router.post('/upload-image', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['VENDOR']), uploadRateLimit, upload.single('file'), vendorController.uploadImage);
// Orders
router.get('/orders', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['VENDOR']), orderController.getVendorOrders);
router.put('/orders/:id/status', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['VENDOR']), orderController.updateOrderStatus);
router.get('/orders/:id', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['VENDOR']), orderController.getOrderById);
// Campaigns
router.post('/campaigns', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['VENDOR']), vendorController.createCampaign);
router.get('/campaigns', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['VENDOR']), vendorController.getCampaigns);
router.put('/campaigns/:id', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['VENDOR']), vendorController.updateCampaign);
// Seller campaigns (basket-based)
router.get('/seller-campaigns', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['VENDOR']), sellerCampaignController.getVendorSellerCampaigns);
router.post('/seller-campaigns', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['VENDOR']), sellerCampaignController.createVendorSellerCampaign);
router.put('/seller-campaigns/:id', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['VENDOR']), sellerCampaignController.updateVendorSellerCampaign);
router.delete('/seller-campaigns/:id', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['VENDOR']), sellerCampaignController.deleteVendorSellerCampaign);
router.delete('/campaigns/:id', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['VENDOR']), vendorController.deleteCampaign);
// Promotions
router.post('/promotions', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['VENDOR']), upload.single('image'), promotionController.createPromotion);
router.get('/promotions', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['VENDOR']), promotionController.getVendorPromotions);
router.delete('/promotions/:promotionId', authMiddleware_1.authMiddleware, (0, requireRole_1.requireRole)(['VENDOR']), promotionController.deletePromotion);
exports.default = router;
