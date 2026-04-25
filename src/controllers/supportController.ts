import fs from 'fs';
import path from 'path';
import { Request, Response, NextFunction } from 'express';
import { SupportSenderRole } from '@prisma/client';
import prisma from '../config/db';

const supportConversationInclude = {
  user: { select: { id: true, name: true, email: true, role: true } },
  messages: { orderBy: { createdAt: 'asc' as const } },
};

const createOrderActionHistory = async (input: {
  orderId?: string | null;
  actionType: string;
  actorRole?: 'CUSTOMER' | 'VENDOR' | 'ADMIN';
  actorId?: string;
  supportConversationId?: string | null;
  vendorConversationId?: string | null;
  note?: string | null;
  metadata?: Record<string, unknown> | null;
}) => {
  if (!input.orderId) return;

  await (prisma as any).orderActionHistory.create({
    data: {
      orderId: input.orderId,
      actionType: input.actionType,
      actorRole: input.actorRole || null,
      actorId: input.actorId || null,
      supportConversationId: input.supportConversationId || null,
      vendorConversationId: input.vendorConversationId || null,
      note: input.note || null,
      metadata: input.metadata || undefined,
    },
  });
};

const buildAllowedHelpActions = (orderStatus: string, hasOpenVendorThread: boolean, hasOpenAdminThread: boolean) => {
  const actions: Array<{ key: string; routeTarget: 'VENDOR' | 'ADMIN' | 'SELF'; priority: number }> = [];
  const status = String(orderStatus || '').toUpperCase();

  if (hasOpenVendorThread) actions.push({ key: 'OPEN_VENDOR_SUPPORT', routeTarget: 'VENDOR', priority: 100 });
  if (hasOpenAdminThread) actions.push({ key: 'OPEN_ADMIN_SUPPORT', routeTarget: 'ADMIN', priority: 95 });

  if (status === 'PENDING' || status === 'PREPARING') {
    actions.push({ key: 'CONTACT_SELLER_SUPPORT', routeTarget: 'VENDOR', priority: 90 });
    actions.push({ key: 'CANCEL_ORDER', routeTarget: 'SELF', priority: 85 });
  } else if (status === 'ON_THE_WAY') {
    actions.push({ key: 'TRACK_ORDER', routeTarget: 'SELF', priority: 90 });
    actions.push({ key: 'CONTACT_SELLER_SUPPORT', routeTarget: 'VENDOR', priority: 85 });
  } else if (status === 'DELIVERED') {
    actions.push({ key: 'REPORT_ORDER_ISSUE', routeTarget: 'VENDOR', priority: 90 });
    actions.push({ key: 'CONTACT_ADMIN_SUPPORT', routeTarget: 'ADMIN', priority: 80 });
  } else if (status === 'CANCELLED') {
    actions.push({ key: 'VIEW_CANCELLATION_STATUS', routeTarget: 'SELF', priority: 90 });
    actions.push({ key: 'CONTACT_ADMIN_SUPPORT', routeTarget: 'ADMIN', priority: 80 });
  } else {
    actions.push({ key: 'CONTACT_SELLER_SUPPORT', routeTarget: 'VENDOR', priority: 80 });
  }

  const seen = new Set<string>();
  return actions
    .filter((action) => {
      if (seen.has(action.key)) return false;
      seen.add(action.key);
      return true;
    })
    .sort((a, b) => b.priority - a.priority);
};

const buildIssueOptions = (orderStatus: string) => {
  const status = String(orderStatus || '').toUpperCase();

  if (status === 'PENDING' || status === 'PREPARING') {
    return [
      { key: 'delayed', title: 'Siparişim gecikti', subtitle: 'Hazırlık veya teslimat süresi uzadı', icon: 'time-outline', accent: '#b45309' },
      { key: 'payment', title: 'Ödeme sorunu', subtitle: 'Ödeme alındı ama sipariş ilerlemiyor', icon: 'card-outline', accent: '#1d4ed8' },
      { key: 'other', title: 'Diğer', subtitle: 'Farklı bir konuda yardım almak istiyorum', icon: 'help-circle-outline', accent: '#0B3E25' },
    ];
  }

  if (status === 'ON_THE_WAY') {
    return [
      { key: 'courier', title: 'Kurye ile ilgili sorun', subtitle: 'Kurye konumu, teslim süreci veya iletişim', icon: 'bicycle-outline', accent: '#7c3aed' },
      { key: 'delayed', title: 'Siparişim gecikti', subtitle: 'Teslimat beklenenden uzun sürüyor', icon: 'time-outline', accent: '#b45309' },
      { key: 'other', title: 'Diğer', subtitle: 'Farklı bir konuda yardım almak istiyorum', icon: 'help-circle-outline', accent: '#0B3E25' },
    ];
  }

  if (status === 'DELIVERED') {
    return [
      { key: 'wrong_item', title: 'Yanlış ürün geldi', subtitle: 'Siparişte olmayan ürün teslim edildi', icon: 'swap-horizontal-outline', accent: '#b91c1c' },
      { key: 'missing_item', title: 'Eksik ürün geldi', subtitle: 'Sepetteki bazı ürünler teslim edilmedi', icon: 'remove-circle-outline', accent: '#dc2626' },
      { key: 'other', title: 'Diğer', subtitle: 'Farklı bir konuda yardım almak istiyorum', icon: 'help-circle-outline', accent: '#0B3E25' },
    ];
  }

  if (status === 'CANCELLED') {
    return [
      { key: 'payment', title: 'İptal ve iade durumu', subtitle: 'İptal sonrası ödeme veya iade bilgisini kontrol edin', icon: 'card-outline', accent: '#1d4ed8' },
      { key: 'other', title: 'Diğer', subtitle: 'Farklı bir konuda yardım almak istiyorum', icon: 'help-circle-outline', accent: '#0B3E25' },
    ];
  }

  return [
    { key: 'delayed', title: 'Siparişim gecikti', subtitle: 'Hazırlık veya teslimat süresi uzadı', icon: 'time-outline', accent: '#b45309' },
    { key: 'other', title: 'Diğer', subtitle: 'Farklı bir konuda yardım almak istiyorum', icon: 'help-circle-outline', accent: '#0B3E25' },
  ];
};

export const getOrderHelpContext = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const orderId = String(req.params.orderId || '').trim();
    if (!orderId) {
      res.status(400).json({ success: false, message: 'orderId is required' });
      return;
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, customerId: userId },
      include: {
        items: {
          include: {
            vendor: { select: { id: true, shopName: true, deliveryMinutes: true } },
            product: { select: { id: true, name: true } },
          },
        },
        shippingAddress: true,
      },
    });

    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    const vendorIds = Array.from(new Set((order.items || []).map((item: any) => item.vendorId).filter(Boolean)));

    const [activeVendorConversation, activeAdminConversation, actionHistory] = await Promise.all([
      (prisma as any).vendorChatConversation.findFirst({
        where: {
          customerId: userId,
          orderId,
          isSupport: true,
          status: 'OPEN',
        },
        include: {
          vendorProfile: { select: { id: true, shopName: true, storeCoverImageUrl: true } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      (prisma as any).supportConversation.findFirst({
        where: {
          userId,
          orderId,
          status: 'OPEN',
        },
        include: {
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      (prisma as any).orderActionHistory.findMany({
        where: { orderId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    const primaryVendor = (order.items || []).find((item: any) => item.vendor)?.vendor || null;
    const workflowStatus =
      (activeAdminConversation as any)?.workflowStatus ||
      (activeVendorConversation as any)?.workflowStatus ||
      (String(order.status || '').toUpperCase() === 'CANCELLED' ? 'RESOLVED' : 'OPEN');

    res.json({
      success: true,
      data: {
        order: {
          id: order.id,
          status: order.status,
          paymentStatus: order.paymentStatus,
          totalPrice: order.totalPrice,
          deliveryFee: order.deliveryFee,
          createdAt: order.createdAt,
          cancelledAt: order.cancelledAt,
          cancelReason: order.cancelReason,
          cancelOtherDescription: order.cancelOtherDescription,
          shippingAddress: order.shippingAddress,
          items: (order.items || []).map((item: any) => ({
            id: item.id,
            productId: item.productId,
            productName: item.product?.name || '',
            quantity: item.quantity,
            vendorId: item.vendorId,
            vendorName: item.vendor?.shopName || '',
          })),
        },
        support: {
          workflowStatus,
          preferredRouteTarget: activeAdminConversation ? 'ADMIN' : 'VENDOR',
          vendorIds,
          primaryVendor,
          activeVendorConversation,
          activeAdminConversation,
          issueOptions: buildIssueOptions(String(order.status || '')),
          allowedActions: buildAllowedHelpActions(
            String(order.status || ''),
            Boolean(activeVendorConversation),
            Boolean(activeAdminConversation)
          ),
        },
        actionHistory,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getMyConversation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    let conversation = await prisma.supportConversation.findFirst({
      where: { userId, status: 'OPEN' },
      include: supportConversationInclude,
      orderBy: { updatedAt: 'desc' },
    });

    if (!conversation) {
      conversation = await prisma.supportConversation.create({
        data: { userId, status: 'OPEN', subject: 'Genel destek', category: 'OTHER', routeTarget: 'ADMIN' },
        include: supportConversationInclude,
      });
    }

    res.json({ success: true, data: conversation });
  } catch (error) {
    next(error);
  }
};

export const listMyConversations = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const conversations = await (prisma as any).supportConversation.findMany({
      where: { userId },
      include: {
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json({ success: true, data: conversations });
  } catch (error) {
    next(error);
  }
};

export const createConversation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const category = String(req.body?.category || 'OTHER').trim() || 'OTHER';
    const subject = String(req.body?.subject || 'Canlı destek').trim() || 'Canlı destek';
    const initialMessage = String(req.body?.initialMessage || '').trim();
    const orderId = String(req.body?.orderId || '').trim() || null;
    const vendorProfileId = String(req.body?.vendorProfileId || '').trim() || null;

    if (orderId) {
      const existing = await (prisma as any).supportConversation.findFirst({
        where: {
          userId,
          orderId,
          category,
          status: 'OPEN',
        },
        include: supportConversationInclude,
        orderBy: { updatedAt: 'desc' },
      });

      if (existing) {
        res.status(200).json({ success: true, data: existing });
        return;
      }
    }

    const conversation = await (prisma as any).supportConversation.create({
      data: {
        userId,
        status: 'OPEN',
        workflowStatus: 'WAITING_ADMIN',
        subject,
        category,
        routeTarget: 'ADMIN',
        orderId,
        vendorProfileId,
      },
      include: supportConversationInclude,
    });

    if (initialMessage) {
      await (prisma as any).supportMessage.create({
        data: {
          conversationId: conversation.id,
          senderRole: SupportSenderRole.CUSTOMER,
          body: initialMessage,
          autoMessage: true,
        },
      });
    }

    await createOrderActionHistory({
      orderId,
      actionType: 'SUPPORT_REQUESTED',
      actorRole: req.user?.role as any,
      actorId: userId,
      supportConversationId: conversation.id,
      metadata: {
        routeTarget: 'ADMIN',
        category,
        vendorProfileId,
      },
    });

    const updated = await (prisma as any).supportConversation.findUnique({
      where: { id: conversation.id },
      include: supportConversationInclude,
    });

    res.status(201).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

export const getMyConversationById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const conversation = await (prisma as any).supportConversation.findFirst({
      where: { id: req.params.id, userId },
      include: supportConversationInclude,
    });

    if (!conversation) {
      res.status(404).json({ success: false, message: 'Conversation not found' });
      return;
    }

    res.json({ success: true, data: conversation });
  } catch (error) {
    next(error);
  }
};

export const postMyMessage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const conversationId = req.params.id;
    const body = String(req.body?.body || '').trim();
    const imageUrl = String(req.body?.imageUrl || '').trim() || null;

    if (!body && !imageUrl) {
      res.status(400).json({ success: false, message: 'Message body is required' });
      return;
    }

    const conversation = await prisma.supportConversation.findFirst({
      where: { id: conversationId, userId },
      select: { id: true, status: true },
    });

    if (!conversation) {
      res.status(404).json({ success: false, message: 'Conversation not found' });
      return;
    }

    if (conversation.status !== 'OPEN') {
      res.status(400).json({ success: false, message: 'Conversation is closed' });
      return;
    }

    // SupportSenderRole currently supports CUSTOMER/ADMIN in schema.
    // Treat vendor-originated messages as CUSTOMER for now.
    const senderRole = SupportSenderRole.CUSTOMER;

    const message = await prisma.supportMessage.create({
      data: {
        conversationId,
        senderRole,
        body: body || 'Gorsel eklendi',
        imageUrl,
        readAt: new Date(),
      } as any,
    });

    const updatedConversation = await (prisma as any).supportConversation.update({
      where: { id: conversationId },
      data: { workflowStatus: 'WAITING_ADMIN', updatedAt: new Date() },
      select: { orderId: true },
    });

    await createOrderActionHistory({
      orderId: updatedConversation?.orderId,
      actionType: 'MESSAGE_SENT',
      actorRole: req.user?.role as any,
      actorId: userId,
      supportConversationId: conversationId,
      metadata: { hasImage: Boolean(imageUrl) },
    });

    res.status(201).json({ success: true, data: message });
  } catch (error) {
    next(error);
  }
};

export const markConversationRead = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const conversation = await (prisma as any).supportConversation.findFirst({
      where: { id: req.params.id, userId },
      select: { id: true },
    });

    if (!conversation) {
      res.status(404).json({ success: false, message: 'Conversation not found' });
      return;
    }

    await (prisma as any).supportMessage.updateMany({
      where: { conversationId: req.params.id, senderRole: 'ADMIN', readAt: null },
      data: { readAt: new Date() },
    });

    const updated = await (prisma as any).supportConversation.findUnique({
      where: { id: req.params.id },
      include: supportConversationInclude,
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

export const closeMyConversation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const conversation = await (prisma as any).supportConversation.findFirst({
      where: { id: req.params.id, userId },
      select: { id: true },
    });

    if (!conversation) {
      res.status(404).json({ success: false, message: 'Conversation not found' });
      return;
    }

    const updated = await (prisma as any).supportConversation.update({
      where: { id: req.params.id },
      data: { status: 'CLOSED', workflowStatus: 'CLOSED', closedAt: new Date() },
      include: supportConversationInclude,
    });

    await createOrderActionHistory({
      orderId: (updated as any).orderId,
      actionType: 'CLOSED',
      actorRole: req.user?.role as any,
      actorId: userId,
      supportConversationId: req.params.id,
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

export const rateConversation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const rating = Number(req.body?.rating || 0);
    const feedback = String(req.body?.feedback || '').trim() || null;
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
      return;
    }

    const updated = await (prisma as any).supportConversation.updateMany({
      where: { id: req.params.id, userId },
      data: { rating, feedback },
    });

    if (!updated.count) {
      res.status(404).json({ success: false, message: 'Conversation not found' });
      return;
    }

    const conversation = await (prisma as any).supportConversation.findUnique({
      where: { id: req.params.id },
      include: supportConversationInclude,
    });

    res.json({ success: true, data: conversation });
  } catch (error) {
    next(error);
  }
};

export const uploadSupportImage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
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

    const uploadsDir = path.join(process.cwd(), 'uploads', 'support');
    fs.mkdirSync(uploadsDir, { recursive: true });

    const extFromName = path.extname(file.originalname || '').trim();
    const extFromMime = String(file.mimetype || '').split('/')[1]?.trim();
    const extension = extFromName || (extFromMime ? `.${extFromMime.replace(/[^a-z0-9]/gi, '')}` : '.jpg');
    const filename = `support-${userId}-${Date.now()}${extension}`;
    const fullPath = path.join(uploadsDir, filename);

    fs.writeFileSync(fullPath, file.buffer);

    res.status(201).json({
      success: true,
      data: {
        url: `/uploads/support/${filename}`,
      },
    });
  } catch (error) {
    next(error);
  }
};
