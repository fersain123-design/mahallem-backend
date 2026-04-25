import { Router } from 'express';
import * as vendorController from '../controllers/vendorController';
import * as orderController from '../controllers/orderController';
import * as promotionController from '../controllers/promotionController';
import * as sellerCampaignController from '../controllers/sellerCampaignController';
import { authMiddleware } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/requireRole';
import multer from 'multer';
import rateLimit from 'express-rate-limit';

const vendorControllerAny: any = vendorController;

const upload = multer({ storage: multer.memoryStorage() });
const uploadRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: Math.max(5, Number(process.env.VENDOR_UPLOAD_RATE_LIMIT_MAX || 30)),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Cok fazla yukleme denemesi. Lutfen daha sonra tekrar deneyin.',
  },
});

const router = Router();

// Profile
router.get(
  '/profile',
  authMiddleware,
  requireRole(['VENDOR']),
  vendorController.getProfile
);
router.put(
  '/profile',
  authMiddleware,
  requireRole(['VENDOR']),
  vendorController.updateProfile
);

// Storefront (Mahallem Mağazam)
router.get(
  '/storefront',
  authMiddleware,
  requireRole(['VENDOR']),
  vendorController.getStorefront
);
router.put(
  '/storefront',
  authMiddleware,
  requireRole(['VENDOR']),
  vendorController.updateStorefront
);
router.post(
  '/storefront/images',
  authMiddleware,
  requireRole(['VENDOR']),
  upload.single('file'),
  vendorController.uploadStoreImage
);
router.delete(
  '/storefront/images/:id',
  authMiddleware,
  requireRole(['VENDOR']),
  vendorController.deleteStoreImage
);

// Bank Account
router.get(
  '/bank-account',
  authMiddleware,
  requireRole(['VENDOR']),
  vendorController.getBankAccount
);
router.put(
  '/bank-account',
  authMiddleware,
  requireRole(['VENDOR']),
  vendorController.updateBankAccount
);

router.post(
  '/iban/change-request',
  authMiddleware,
  requireRole(['VENDOR']),
  vendorControllerAny.requestIbanChange
);

// Delivery coverage (admin approval required after registration)
router.post(
  '/delivery-coverage/change-request',
  authMiddleware,
  requireRole(['VENDOR']),
  vendorController.requestDeliveryCoverageChange
);

router.get(
  '/delivery-settings',
  authMiddleware,
  requireRole(['VENDOR']),
  vendorController.getDeliverySettings
);

router.put(
  '/delivery-settings',
  authMiddleware,
  requireRole(['VENDOR']),
  vendorController.updateDeliverySettings
);

// Payouts
router.get(
  '/payouts',
  authMiddleware,
  requireRole(['VENDOR']),
  vendorController.getPayouts
);
router.post(
  '/payouts/request',
  authMiddleware,
  requireRole(['VENDOR']),
  vendorController.createPayoutRequest
);
router.get(
  '/payouts/:id',
  authMiddleware,
  requireRole(['VENDOR']),
  vendorController.getPayoutById
);

// Products
router.get(
  '/products',
  authMiddleware,
  requireRole(['VENDOR']),
  vendorController.getProducts
);
router.get(
  '/products/:id',
  authMiddleware,
  requireRole(['VENDOR']),
  vendorController.getProductById
);
router.post(
  '/products/lookup-barcode',
  authMiddleware,
  requireRole(['VENDOR']),
  vendorControllerAny.lookupProductByBarcode
);
router.post(
  '/products',
  authMiddleware,
  requireRole(['VENDOR']),
  vendorController.createProduct
);
router.get(
  '/categories',
  authMiddleware,
  requireRole(['VENDOR']),
  vendorController.getCategories
);
router.post(
  '/categories',
  authMiddleware,
  requireRole(['VENDOR']),
  vendorController.createCategory
);
router.put(
  '/categories/:id',
  authMiddleware,
  requireRole(['VENDOR']),
  vendorController.updateCategory
);
router.delete(
  '/categories/:id',
  authMiddleware,
  requireRole(['VENDOR']),
  vendorController.deleteCategory
);
router.put(
  '/products/:id',
  authMiddleware,
  requireRole(['VENDOR']),
  vendorController.updateProduct
);
router.delete(
  '/products/:id',
  authMiddleware,
  requireRole(['VENDOR']),
  vendorController.deleteProduct
);
router.get(
  '/products/:id/reviews',
  authMiddleware,
  requireRole(['VENDOR']),
  vendorController.getProductReviews
);
router.post(
  '/products/:id/reviews/:reviewId/reply',
  authMiddleware,
  requireRole(['VENDOR']),
  vendorController.replyToProductReview
);

// Orders
router.get(
  '/orders',
  authMiddleware,
  requireRole(['VENDOR']),
  vendorController.getOrders
);
router.get(
  '/orders/:id',
  authMiddleware,
  requireRole(['VENDOR']),
  vendorController.getOrderById
);
router.put(
  '/orders/:id/status',
  authMiddleware,
  requireRole(['VENDOR']),
  vendorController.updateOrderStatus
);

// Dashboard
router.get(
  '/dashboard',
  authMiddleware,
  requireRole(['VENDOR']),
  vendorController.getDashboard
);

// Notifications
router.get(
  '/notifications',
  authMiddleware,
  requireRole(['VENDOR']),
  vendorController.getNotifications
);
router.put(
  '/notifications/:id/read',
  authMiddleware,
  requireRole(['VENDOR']),
  vendorController.markNotificationAsRead
);

// Documents
router.post(
  '/upload-tax-sheet',
  authMiddleware,
  requireRole(['VENDOR']),
  uploadRateLimit,
  vendorController.uploadTaxSheet
);

router.post(
  '/upload-document',
  authMiddleware,
  requireRole(['VENDOR']),
  uploadRateLimit,
  vendorController.uploadDocument
);

router.post(
  '/upload-image',
  authMiddleware,
  requireRole(['VENDOR']),
  uploadRateLimit,
  upload.single('file'),
  vendorController.uploadImage
);

// Orders
router.get(
  '/orders',
  authMiddleware,
  requireRole(['VENDOR']),
  orderController.getVendorOrders
);
router.put(
  '/orders/:id/status',
  authMiddleware,
  requireRole(['VENDOR']),
  orderController.updateOrderStatus
);
router.get(
  '/orders/:id',
  authMiddleware,
  requireRole(['VENDOR']),
  orderController.getOrderById
);

// Campaigns
router.post(
  '/campaigns',
  authMiddleware,
  requireRole(['VENDOR']),
  vendorController.createCampaign
);
router.get(
  '/campaigns',
  authMiddleware,
  requireRole(['VENDOR']),
  vendorController.getCampaigns
);
router.put(
  '/campaigns/:id',
  authMiddleware,
  requireRole(['VENDOR']),
  vendorController.updateCampaign
);

// Seller campaigns (basket-based)
router.get(
  '/seller-campaigns',
  authMiddleware,
  requireRole(['VENDOR']),
  sellerCampaignController.getVendorSellerCampaigns
);
router.post(
  '/seller-campaigns',
  authMiddleware,
  requireRole(['VENDOR']),
  sellerCampaignController.createVendorSellerCampaign
);
router.put(
  '/seller-campaigns/:id',
  authMiddleware,
  requireRole(['VENDOR']),
  sellerCampaignController.updateVendorSellerCampaign
);
router.delete(
  '/seller-campaigns/:id',
  authMiddleware,
  requireRole(['VENDOR']),
  sellerCampaignController.deleteVendorSellerCampaign
);
router.delete(
  '/campaigns/:id',
  authMiddleware,
  requireRole(['VENDOR']),
  vendorController.deleteCampaign
);

// Promotions
router.post(
  '/promotions',
  authMiddleware,
  requireRole(['VENDOR']),
  upload.single('image'),
  promotionController.createPromotion
);
router.get(
  '/promotions',
  authMiddleware,
  requireRole(['VENDOR']),
  promotionController.getVendorPromotions
);
router.delete(
  '/promotions/:promotionId',
  authMiddleware,
  requireRole(['VENDOR']),
  promotionController.deletePromotion
);

export default router;
