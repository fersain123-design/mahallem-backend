import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/requireRole';
import * as chatController from '../controllers/chatController';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Customer: list my conversations
router.get('/conversations', authMiddleware, requireRole(['CUSTOMER']), chatController.listMyConversations);

// Vendor: list inbox
router.get('/conversations/vendor', authMiddleware, requireRole(['VENDOR']), chatController.listVendorConversations);

// Vendor: list support inbox
router.get('/support-conversations/vendor', authMiddleware, requireRole(['VENDOR']), chatController.listVendorSupportConversations);

// Customer: list my support threads
router.get('/support-conversations', authMiddleware, requireRole(['CUSTOMER']), chatController.listCustomerSupportConversations);

// Customer: get/create conversation with a vendor
router.get(
  '/conversations/vendor/:vendorId',
  authMiddleware,
  requireRole(['CUSTOMER']),
  chatController.getOrCreateConversationForCustomer
);

router.get(
  '/support-conversations/vendor/:vendorId',
  authMiddleware,
  requireRole(['CUSTOMER']),
  chatController.getOrCreateSupportConversationForCustomer
);

// Both sides: open conversation
router.get('/conversations/:id', authMiddleware, requireRole(['CUSTOMER', 'VENDOR']), chatController.getConversationById);

// Both sides: send message
router.post('/conversations/:id/messages', authMiddleware, requireRole(['CUSTOMER', 'VENDOR']), chatController.postMessage);

router.post('/conversations/:id/read', authMiddleware, requireRole(['CUSTOMER', 'VENDOR']), chatController.markConversationRead);
router.post('/conversations/:id/close', authMiddleware, requireRole(['CUSTOMER', 'VENDOR']), chatController.closeConversation);
router.post('/conversations/:id/rate', authMiddleware, requireRole(['CUSTOMER']), chatController.rateConversation);
router.post('/conversations/:id/escalate', authMiddleware, requireRole(['VENDOR']), chatController.escalateConversation);
router.post('/uploads/image', authMiddleware, requireRole(['CUSTOMER', 'VENDOR']), upload.single('file'), chatController.uploadChatImage);

export default router;
