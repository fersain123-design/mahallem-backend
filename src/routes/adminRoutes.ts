import { Router } from 'express';
import * as adminController from '../controllers/adminController';
import * as adminSupportController from '../controllers/adminSupportController';
import * as promotionController from '../controllers/promotionController';
import * as adminSettingsController from '../controllers/adminSettingsController';
import * as adminDeliveryFeesController from '../controllers/adminDeliveryFeesController';
import * as adminVendorDeliveryController from '../controllers/adminVendorDeliveryController';
import * as sellerCampaignController from '../controllers/sellerCampaignController';
import { authMiddleware } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/requireRole';

const router = Router();

// Dashboard
router.get(
  '/dashboard',
  authMiddleware,
  requireRole(['ADMIN']),
  adminController.getDashboard
);

// Settings
router.get(
  '/settings',
  authMiddleware,
  requireRole(['ADMIN']),
  adminSettingsController.getSettings
);
router.put(
  '/settings/:key',
  authMiddleware,
  requireRole(['ADMIN']),
  adminSettingsController.updateSettingByKey
);

// Delivery fee bands
router.get(
  '/delivery-fees',
  authMiddleware,
  requireRole(['ADMIN']),
  adminDeliveryFeesController.getDeliveryFeeBands
);
router.put(
  '/delivery-fees',
  authMiddleware,
  requireRole(['ADMIN']),
  adminDeliveryFeesController.updateDeliveryFeeBands
);

// Delivery / Vendor shipping
router.get(
  '/vendor-delivery',
  authMiddleware,
  requireRole(['ADMIN']),
  adminVendorDeliveryController.getVendorDeliveryOverview
);
router.get(
  '/vendor-delivery/neighborhood-settings',
  authMiddleware,
  requireRole(['ADMIN']),
  adminVendorDeliveryController.getPlatformNeighborhoodDeliverySettings
);
router.put(
  '/vendor-delivery/neighborhood-settings',
  authMiddleware,
  requireRole(['ADMIN']),
  adminVendorDeliveryController.upsertPlatformNeighborhoodDeliverySetting
);
router.post(
  '/vendor-delivery/:id/approve',
  authMiddleware,
  requireRole(['ADMIN']),
  adminVendorDeliveryController.approveVendorDeliveryCoverageChange
);
router.post(
  '/vendor-delivery/:id/reject',
  authMiddleware,
  requireRole(['ADMIN']),
  adminVendorDeliveryController.rejectVendorDeliveryCoverageChange
);
router.put(
  '/vendor-delivery/:id',
  authMiddleware,
  requireRole(['ADMIN']),
  adminVendorDeliveryController.updateVendorDeliverySettings
);

// Vendors
router.get(
  '/vendors',
  authMiddleware,
  requireRole(['ADMIN']),
  adminController.getVendors
);
router.get(
  '/vendors/:id',
  authMiddleware,
  requireRole(['ADMIN']),
  adminController.getVendorById
);
router.post(
  '/vendors/:id/approve',
  authMiddleware,
  requireRole(['ADMIN']),
  adminController.approveVendor
);
router.post(
  '/vendors/:id/reject',
  authMiddleware,
  requireRole(['ADMIN']),
  adminController.rejectVendor
);
router.post(
  '/vendors/:id/documents/review',
  authMiddleware,
  requireRole(['ADMIN']),
  adminController.reviewVendorDocument
);

router.post(
  '/vendors/:id/iban/approve',
  authMiddleware,
  requireRole(['ADMIN']),
  adminController.approveVendorIban
);

router.post(
  '/vendors/:id/iban/open-change',
  authMiddleware,
  requireRole(['ADMIN']),
  adminController.openVendorIbanChange
);

router.post(
  '/vendors/:id/deactivate',
  authMiddleware,
  requireRole(['ADMIN']),
  adminController.deactivateVendor
);
router.post(
  '/vendors/:id/suspend',
  authMiddleware,
  requireRole(['ADMIN']),
  adminController.suspendVendor
);
router.post(
  '/vendors/:id/unsuspend',
  authMiddleware,
  requireRole(['ADMIN']),
  adminController.unsuspendVendor
);

// Vendor Violations
router.get(
  '/vendors/:id/violations',
  authMiddleware,
  requireRole(['ADMIN']),
  adminController.getVendorViolations
);
router.post(
  '/vendors/:id/violations',
  authMiddleware,
  requireRole(['ADMIN']),
  adminController.createVendorViolation
);

// Users
router.get(
  '/users',
  authMiddleware,
  requireRole(['ADMIN']),
  adminController.getUsers
);
router.get(
  '/users/:id',
  authMiddleware,
  requireRole(['ADMIN']),
  adminController.getUserById
);
router.post(
  '/users/:id/suspend',
  authMiddleware,
  requireRole(['ADMIN']),
  adminController.suspendUser
);
router.post(
  '/users/:id/unsuspend',
  authMiddleware,
  requireRole(['ADMIN']),
  adminController.unsuspendUser
);

// Customers (alias for users?role=CUSTOMER)
router.get(
  '/customers',
  authMiddleware,
  requireRole(['ADMIN']),
  adminController.getCustomers
);

// Products
router.get(
  '/products',
  authMiddleware,
  requireRole(['ADMIN']),
  adminController.getProducts
);
router.get(
  '/products/uncategorized',
  authMiddleware,
  requireRole(['ADMIN']),
  adminController.getUncategorizedProducts
);
router.post(
  '/products/bulk-assign-subcategory',
  authMiddleware,
  requireRole(['ADMIN']),
  adminController.bulkAssignProductSubCategories
);
router.put(
  '/products/:id/toggle-active',
  authMiddleware,
  requireRole(['ADMIN']),
  adminController.toggleProductActive
);
router.put(
  '/products/:id/active',
  authMiddleware,
  requireRole(['ADMIN']),
  adminController.setProductActive
);
router.post(
  '/products/:id/reject-pricing',
  authMiddleware,
  requireRole(['ADMIN']),
  adminController.rejectProductForPricing
);
router.delete(
  '/products/:id',
  authMiddleware,
  requireRole(['ADMIN']),
  adminController.deleteProduct
);

// Orders
router.get(
  '/orders',
  authMiddleware,
  requireRole(['ADMIN']),
  adminController.getOrders
);
router.get(
  '/orders/:id',
  authMiddleware,
  requireRole(['ADMIN']),
  adminController.getOrderById
);
router.put(
  '/orders/:id/status',
  authMiddleware,
  requireRole(['ADMIN']),
  adminController.updateOrderStatus
);

// Payouts
router.get(
  '/payouts',
  authMiddleware,
  requireRole(['ADMIN']),
  adminController.getPayouts
);
router.get(
  '/payouts/:id',
  authMiddleware,
  requireRole(['ADMIN']),
  adminController.getPayoutById
);
router.post(
  '/payouts/:id/mark-paid',
  authMiddleware,
  requireRole(['ADMIN']),
  adminController.markPayoutAsPaid
);

// Support Chat
router.get(
  '/support/conversations',
  authMiddleware,
  requireRole(['ADMIN']),
  adminSupportController.listConversations
);
router.get(
  '/support/conversations/:id',
  authMiddleware,
  requireRole(['ADMIN']),
  adminSupportController.getConversationById
);
router.post(
  '/support/conversations/:id/messages',
  authMiddleware,
  requireRole(['ADMIN']),
  adminSupportController.postAdminMessage
);
router.post(
  '/support/conversations/:id/close',
  authMiddleware,
  requireRole(['ADMIN']),
  adminSupportController.closeConversation
);

// Notifications
router.get(
  '/notifications',
  authMiddleware,
  requireRole(['ADMIN']),
  adminController.getNotifications
);
router.post(
  '/notifications',
  authMiddleware,
  requireRole(['ADMIN']),
  adminController.createNotification
);
router.put(
  '/notifications/:id/read',
  authMiddleware,
  requireRole(['ADMIN']),
  adminController.markNotificationAsRead
);

// Promotions
router.get(
  '/promotions/pending',
  authMiddleware,
  requireRole(['ADMIN']),
  promotionController.getPendingPromotions
);
router.post(
  '/promotions/:promotionId/approve',
  authMiddleware,
  requireRole(['ADMIN']),
  promotionController.approvePromotion
);
router.post(
  '/promotions/:promotionId/reject',
  authMiddleware,
  requireRole(['ADMIN']),
  promotionController.rejectPromotion
);

// Seller campaigns (basket-based)
router.get(
  '/seller-campaigns',
  authMiddleware,
  requireRole(['ADMIN']),
  sellerCampaignController.getAdminSellerCampaigns
);
router.put(
  '/seller-campaigns/:id/status',
  authMiddleware,
  requireRole(['ADMIN']),
  sellerCampaignController.updateAdminSellerCampaignStatus
);

export default router;
