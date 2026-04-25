import { Router } from 'express';
import { authMiddleware } from '../../middleware/authMiddleware';
import { requireRole } from '../../middleware/requireRole';
import {
  getPaymentById,
  initializePayment,
  refundPayment,
  registerSubmerchant,
  updateSubmerchant,
} from './payment.controller';
import { paymentCallback, paymentWebhook } from './payment.webhook.controller';

const router = Router();

router.post('/payments/initialize', authMiddleware, requireRole(['CUSTOMER']), initializePayment);
router.post('/payments/callback', paymentCallback);
router.post('/payments/webhook', paymentWebhook);
router.get('/payments/:id', authMiddleware, requireRole(['CUSTOMER', 'VENDOR', 'ADMIN']), getPaymentById);
router.post('/payments/:id/refund', authMiddleware, requireRole(['VENDOR', 'ADMIN']), refundPayment);

router.post(
  '/vendors/:vendorId/submerchant/register',
  authMiddleware,
  requireRole(['VENDOR', 'ADMIN']),
  registerSubmerchant
);
router.put(
  '/vendors/:vendorId/submerchant/update',
  authMiddleware,
  requireRole(['VENDOR', 'ADMIN']),
  updateSubmerchant
);

export default router;
