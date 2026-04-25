import fs from 'fs';
import path from 'path';
import { Request, Response, NextFunction } from 'express';
import * as chatService from '../services/chatService';

export const listMyConversations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    if (req.user.role !== 'CUSTOMER') {
      res.status(403).json({ success: false, message: 'Only customers can list this' });
      return;
    }

    const list = await chatService.listCustomerConversations(req.user.userId);
    res.status(200).json({ success: true, data: list });
  } catch (e) {
    next(e);
  }
};

export const listVendorConversations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    if (req.user.role !== 'VENDOR') {
      res.status(403).json({ success: false, message: 'Only vendors can list this' });
      return;
    }

    const list = await chatService.listVendorConversations(req.user.userId);
    res.status(200).json({ success: true, data: list });
  } catch (e) {
    next(e);
  }
};

export const listVendorSupportConversations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    if (req.user.role !== 'VENDOR') {
      res.status(403).json({ success: false, message: 'Only vendors can list this' });
      return;
    }

    const list = await chatService.listVendorSupportConversations(req.user.userId);
    res.status(200).json({ success: true, data: list });
  } catch (e) {
    next(e);
  }
};

export const listCustomerSupportConversations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    if (req.user.role !== 'CUSTOMER') {
      res.status(403).json({ success: false, message: 'Only customers can list this' });
      return;
    }

    const list = await chatService.listCustomerSupportConversations(req.user.userId);
    res.status(200).json({ success: true, data: list });
  } catch (e) {
    next(e);
  }
};

export const getOrCreateConversationForCustomer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    if (req.user.role !== 'CUSTOMER') {
      res.status(403).json({ success: false, message: 'Only customers can start chat' });
      return;
    }

    const { vendorId } = req.params;
    const convo = await chatService.getOrCreateConversationForCustomer(req.user.userId, vendorId);
    res.status(200).json({ success: true, data: convo });
  } catch (e) {
    next(e);
  }
};

export const getOrCreateSupportConversationForCustomer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    if (req.user.role !== 'CUSTOMER') {
      res.status(403).json({ success: false, message: 'Only customers can start support chat' });
      return;
    }

    const { vendorId } = req.params;
    const orderId = String(req.query.orderId || '').trim();
    const category = String(req.query.category || 'ORDER').trim();

    if (!orderId) {
      res.status(400).json({ success: false, message: 'orderId is required' });
      return;
    }

    const convo = await chatService.getOrCreateSupportConversationForCustomer(
      req.user.userId,
      vendorId,
      orderId,
      category
    );
    res.status(200).json({ success: true, data: convo });
  } catch (e) {
    next(e);
  }
};

export const getConversationById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    if (req.user.role !== 'CUSTOMER' && req.user.role !== 'VENDOR') {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }

    const convo = await chatService.getConversationByIdForUser(id, req.user.userId, req.user.role as any);
    if (!convo) {
      res.status(404).json({ success: false, message: 'Conversation not found' });
      return;
    }

    res.status(200).json({ success: true, data: convo });
  } catch (e) {
    next(e);
  }
};

export const postMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    if (req.user.role !== 'CUSTOMER' && req.user.role !== 'VENDOR') {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }

    const { id } = req.params;
    const body = String(req.body?.body ?? req.body?.text ?? req.body?.message ?? '').trim();
    const imageUrl = String(req.body?.imageUrl || '').trim() || undefined;
    if (!body && !imageUrl) {
      res.status(400).json({ success: false, message: 'Message body is required' });
      return;
    }

    const msg = await chatService.postMessage(id, { userId: req.user.userId, role: req.user.role as any }, body, imageUrl);
    res.status(201).json({ success: true, data: msg });
  } catch (e) {
    next(e);
  }
};

export const markConversationRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const updated = await chatService.markConversationRead(req.params.id, {
      userId: req.user.userId,
      role: req.user.role as any,
    });
    res.status(200).json({ success: true, data: updated });
  } catch (e) {
    next(e);
  }
};

export const closeConversation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const updated = await chatService.closeConversationForUser(req.params.id, {
      userId: req.user.userId,
      role: req.user.role as any,
    });
    res.status(200).json({ success: true, data: updated });
  } catch (e) {
    next(e);
  }
};

export const rateConversation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    if (req.user.role !== 'CUSTOMER') {
      res.status(403).json({ success: false, message: 'Only customers can rate conversations' });
      return;
    }

    const rating = Number(req.body?.rating || 0);
    const feedback = String(req.body?.feedback || '').trim();
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
      return;
    }

    const updated = await chatService.rateConversation(req.params.id, req.user.userId, rating, feedback);
    res.status(200).json({ success: true, data: updated });
  } catch (e) {
    next(e);
  }
};

export const escalateConversation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    if (req.user.role !== 'VENDOR') {
      res.status(403).json({ success: false, message: 'Only vendors can escalate conversations' });
      return;
    }

    const note = String(req.body?.note || '').trim();
    const result = await chatService.escalateConversationToAdmin(req.params.id, req.user.userId, note);
    res.status(200).json({ success: true, data: result });
  } catch (e) {
    next(e);
  }
};

export const uploadChatImage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) {
      res.status(400).json({ success: false, message: 'Image file is required' });
      return;
    }

    if (!String(file.mimetype || '').startsWith('image/')) {
      res.status(400).json({ success: false, message: 'Only image uploads are allowed' });
      return;
    }

    const uploadsDir = path.join(process.cwd(), 'uploads', 'chat');
    fs.mkdirSync(uploadsDir, { recursive: true });

    const extFromName = path.extname(file.originalname || '').trim();
    const extFromMime = String(file.mimetype || '').split('/')[1]?.trim();
    const extension = extFromName || (extFromMime ? `.${extFromMime.replace(/[^a-z0-9]/gi, '')}` : '.jpg');
    const filename = `chat-${req.user.userId}-${Date.now()}${extension}`;
    fs.writeFileSync(path.join(uploadsDir, filename), file.buffer);

    res.status(201).json({ success: true, data: { url: `/uploads/chat/${filename}` } });
  } catch (e) {
    next(e);
  }
};
