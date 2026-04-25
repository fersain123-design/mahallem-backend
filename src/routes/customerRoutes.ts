import { Router } from 'express';
import * as customerController from '../controllers/customerController';
import * as orderController from '../controllers/orderController';
import * as promotionController from '../controllers/promotionController';
import { authMiddleware } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/requireRole';

const router = Router();

// Public catalog (no auth)
router.get('/categories', customerController.getCategories);
router.get('/products', customerController.getProducts);
router.get('/products/:id', customerController.getProductById);
router.get('/vendors', customerController.getVendors);
router.get('/vendors/all', customerController.getVendors); // Alias for mobile app

// Profile
router.get(
  '/profile',
  authMiddleware,
  requireRole(['CUSTOMER']),
  customerController.getProfile
);
router.put(
  '/profile',
  authMiddleware,
  requireRole(['CUSTOMER']),
  customerController.updateProfile
);

router.get(
  '/notifications',
  authMiddleware,
  requireRole(['CUSTOMER']),
  customerController.getNotifications
);
router.put(
  '/notifications/:id/read',
  authMiddleware,
  requireRole(['CUSTOMER']),
  customerController.markNotificationAsRead
);
router.put(
  '/notifications/read-all',
  authMiddleware,
  requireRole(['CUSTOMER']),
  customerController.markAllNotificationsAsRead
);
router.post(
  '/push-token',
  authMiddleware,
  requireRole(['CUSTOMER']),
  customerController.registerPushToken
);
router.delete(
  '/push-token',
  authMiddleware,
  requireRole(['CUSTOMER']),
  customerController.unregisterPushToken
);
router.post(
  '/notifications/test-push',
  authMiddleware,
  requireRole(['CUSTOMER']),
  customerController.sendTestPushNotification
);
router.get(
  '/push-status',
  authMiddleware,
  requireRole(['CUSTOMER']),
  customerController.getPushStatus
);

// Addresses
router.get(
  '/addresses',
  authMiddleware,
  requireRole(['CUSTOMER']),
  customerController.getAddresses
);
router.get(
  '/addresses/:id',
  authMiddleware,
  requireRole(['CUSTOMER']),
  customerController.getAddressById
);
router.post(
  '/addresses',
  authMiddleware,
  requireRole(['CUSTOMER']),
  customerController.addAddress
);
router.put(
  '/addresses/:id',
  authMiddleware,
  requireRole(['CUSTOMER']),
  customerController.updateAddress
);
router.delete(
  '/addresses/:id',
  authMiddleware,
  requireRole(['CUSTOMER']),
  customerController.deleteAddress
);
router.post(
  '/addresses/:id/set-default',
  authMiddleware,
  requireRole(['CUSTOMER']),
  customerController.setDefaultAddress
);

// Cart
router.get(
  '/cart',
  authMiddleware,
  requireRole(['CUSTOMER']),
  customerController.getCart
);
router.post(
  '/cart/add',
  authMiddleware,
  requireRole(['CUSTOMER']),
  customerController.addToCart
);
router.post(
  '/cart/update',
  authMiddleware,
  requireRole(['CUSTOMER']),
  customerController.updateCartItem
);
router.post(
  '/cart/remove',
  authMiddleware,
  requireRole(['CUSTOMER']),
  customerController.removeFromCart
);
router.post(
  '/cart/clear',
  authMiddleware,
  requireRole(['CUSTOMER']),
  customerController.clearCart
);
router.get(
  '/cart/delivery-estimate',
  authMiddleware,
  requireRole(['CUSTOMER']),
  customerController.getCartDeliveryEstimate
);

// Orders
router.post(
  '/orders',
  authMiddleware,
  requireRole(['CUSTOMER']),
  customerController.createOrder
);
router.get(
  '/orders',
  authMiddleware,
  requireRole(['CUSTOMER']),
  orderController.getCustomerOrders
);
router.get(
  '/orders/:id',
  authMiddleware,
  requireRole(['CUSTOMER']),
  orderController.getOrderById
);

router.get(
  '/orders/:id/rating',
  authMiddleware,
  requireRole(['CUSTOMER']),
  customerController.getOrderSellerRating
);

router.post(
  '/orders/:id/rating',
  authMiddleware,
  requireRole(['CUSTOMER']),
  customerController.createOrderSellerRating
);

router.put(
  '/orders/:id/rating',
  authMiddleware,
  requireRole(['CUSTOMER']),
  customerController.updateOrderSellerRating
);

router.post(
  '/orders/:id/cancel',
  authMiddleware,
  requireRole(['CUSTOMER']),
  orderController.cancelCustomerOrder
);

// Promotions
router.get(
  '/promotions',
  promotionController.getActivePromotions
);

export default router;
