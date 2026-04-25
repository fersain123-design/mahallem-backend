import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/requireRole';
import * as supportController from '../controllers/supportController';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get(
  '/conversations',
  authMiddleware,
  requireRole(['CUSTOMER', 'VENDOR']),
  supportController.listMyConversations
);

router.get(
  '/orders/:orderId/help-context',
  authMiddleware,
  requireRole(['CUSTOMER']),
  supportController.getOrderHelpContext
);

router.post(
  '/conversations',
  authMiddleware,
  requireRole(['CUSTOMER', 'VENDOR']),
  supportController.createConversation
);

router.get(
  '/conversations/me',
  authMiddleware,
  requireRole(['CUSTOMER', 'VENDOR']),
  supportController.getMyConversation
);

router.get(
  '/conversations/:id',
  authMiddleware,
  requireRole(['CUSTOMER', 'VENDOR']),
  supportController.getMyConversationById
);

router.post(
  '/uploads/image',
  authMiddleware,
  requireRole(['CUSTOMER', 'VENDOR', 'ADMIN']),
  upload.single('file'),
  supportController.uploadSupportImage
);

router.post(
  '/conversations/:id/messages',
  authMiddleware,
  requireRole(['CUSTOMER', 'VENDOR']),
  supportController.postMyMessage
);

router.post(
  '/conversations/:id/read',
  authMiddleware,
  requireRole(['CUSTOMER', 'VENDOR']),
  supportController.markConversationRead
);

router.post(
  '/conversations/:id/close',
  authMiddleware,
  requireRole(['CUSTOMER', 'VENDOR']),
  supportController.closeMyConversation
);

router.post(
  '/conversations/:id/rate',
  authMiddleware,
  requireRole(['CUSTOMER', 'VENDOR']),
  supportController.rateConversation
);

export default router;
