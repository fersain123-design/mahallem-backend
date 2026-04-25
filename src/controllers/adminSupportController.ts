import { Request, Response, NextFunction } from 'express';
import prisma from '../config/db';
import { sendSellerAdminSupportMessageEmail } from '../services/mail/messageNotificationEmails';

const createOrderActionHistory = async (input: {
  orderId?: string | null;
  actionType: string;
  actorRole?: 'CUSTOMER' | 'VENDOR' | 'ADMIN';
  actorId?: string;
  supportConversationId?: string | null;
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
      note: input.note || null,
      metadata: input.metadata || undefined,
    },
  });
};

export const listConversations = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const conversations = await prisma.supportConversation.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, senderRole: true, body: true, imageUrl: true, createdAt: true, readAt: true } as any,
        },
      },
    });

    const vendorIds = Array.from(new Set(conversations.map((item: any) => item.vendorProfileId).filter(Boolean)));
    const vendors = vendorIds.length
      ? await prisma.vendorProfile.findMany({ where: { id: { in: vendorIds as string[] } }, select: { id: true, shopName: true } })
      : [];
    const vendorMap = new Map(vendors.map((item) => [item.id, item]));

    const data = conversations.map((item: any) => ({
      ...item,
      vendorProfile: item.vendorProfileId ? vendorMap.get(item.vendorProfileId) || null : null,
    }));

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getConversationById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.params.id;

    const conversation = await prisma.supportConversation.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!conversation) {
      res.status(404).json({ success: false, message: 'Conversation not found' });
      return;
    }

    const vendorProfile = (conversation as any).vendorProfileId
      ? await prisma.vendorProfile.findUnique({ where: { id: (conversation as any).vendorProfileId }, select: { id: true, shopName: true } })
      : null;

    const sourceVendorConversation = (conversation as any).sourceVendorConversationId
      ? await (prisma as any).vendorChatConversation.findUnique({
          where: { id: (conversation as any).sourceVendorConversationId },
          include: {
            customer: { select: { id: true, name: true, email: true } },
            vendorProfile: { select: { id: true, shopName: true } },
            messages: { orderBy: { createdAt: 'asc' } },
          },
        })
      : null;

    res.json({ success: true, data: { ...conversation, vendorProfile, sourceVendorConversation } });
  } catch (error) {
    next(error);
  }
};

export const postAdminMessage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const conversationId = req.params.id;
    const body = String(req.body?.body || '').trim();
    const imageUrl = String(req.body?.imageUrl || '').trim() || null;

    if (!body && !imageUrl) {
      res.status(400).json({ success: false, message: 'Message body is required' });
      return;
    }

    const conversation = await prisma.supportConversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        status: true,
        orderId: true,
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    if (!conversation) {
      res.status(404).json({ success: false, message: 'Conversation not found' });
      return;
    }

    if (conversation.status !== 'OPEN') {
      res.status(400).json({ success: false, message: 'Conversation is closed' });
      return;
    }

    const message = await prisma.supportMessage.create({
      data: {
        conversationId,
        senderRole: 'ADMIN',
        body: body || 'Gorsel eklendi',
        imageUrl,
        readAt: new Date(),
      } as any,
    });

    await (prisma as any).supportConversation.update({
      where: { id: conversationId },
      data: { workflowStatus: 'OPEN', updatedAt: new Date() },
    });

    await createOrderActionHistory({
      orderId: conversation.orderId,
      actionType: 'MESSAGE_SENT',
      actorRole: 'ADMIN',
      actorId: req.user?.userId,
      supportConversationId: conversationId,
      metadata: { hasImage: Boolean(imageUrl) },
    });

    if (String((conversation as any)?.user?.role || '') === 'VENDOR') {
      const email = String((conversation as any)?.user?.email || '').trim();
      if (email) {
        void sendSellerAdminSupportMessageEmail({
          to: email,
          sellerName: (conversation as any)?.user?.name,
          messageText: body,
          hasImage: Boolean(imageUrl),
        }).catch((mailError) => {
          console.warn('[adminSupportController] vendor support mail failed:', mailError);
        });
      }
    }

    res.status(201).json({ success: true, data: message });
  } catch (error) {
    next(error);
  }
};

export const closeConversation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.params.id;

    const updated = await prisma.supportConversation.update({
      where: { id },
      data: { status: 'CLOSED', workflowStatus: 'CLOSED', closedAt: new Date() } as any,
    });

    await createOrderActionHistory({
      orderId: (updated as any).orderId,
      actionType: 'CLOSED',
      actorRole: 'ADMIN',
      actorId: req.user?.userId,
      supportConversationId: id,
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};
