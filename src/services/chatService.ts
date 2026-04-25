import prisma from '../config/db';
import { AppError } from '../middleware/errorHandler';
import { sendSellerNewMessageEmail } from './mail/messageNotificationEmails';

const chatConversation = (prisma as any).vendorChatConversation as any;
const chatMessage = (prisma as any).vendorChatMessage as any;

const conversationInclude = {
  vendorProfile: {
    select: {
      id: true,
      shopName: true,
      storeCoverImageUrl: true,
      user: { select: { id: true, name: true, email: true } },
    },
  },
  customer: { select: { id: true, name: true, email: true } },
  messages: { orderBy: { createdAt: 'asc' } },
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

const ensureVendorProfile = async (vendorProfileId: string) => {
  const vendor = await prisma.vendorProfile.findFirst({
    where: { id: vendorProfileId, status: 'APPROVED', user: { isActive: true } },
    select: { id: true, shopName: true, userId: true },
  });

  if (!vendor) {
    throw new AppError(404, 'Vendor not found');
  }

  return vendor;
};

const ensureVendorProfileByUser = async (vendorUserId: string) => {
  const vendor = await prisma.vendorProfile.findUnique({
    where: { userId: vendorUserId },
    select: { id: true, shopName: true, userId: true },
  });
  if (!vendor) throw new AppError(404, 'Vendor profile not found');
  return vendor;
};

export const getOrCreateConversationForCustomer = async (customerId: string, vendorProfileId: string) => {
  await ensureVendorProfile(vendorProfileId);

  const existing = await chatConversation.findFirst({
    where: {
      customerId,
      vendorProfileId,
      isSupport: false,
    },
    include: conversationInclude,
    orderBy: { updatedAt: 'desc' },
  });

  if (existing) return existing;

  return chatConversation.create({
    data: {
      customerId,
      vendorProfileId,
    },
    include: conversationInclude,
  });
};

export const getOrCreateSupportConversationForCustomer = async (
  customerId: string,
  vendorProfileId: string,
  orderId: string,
  category: string
) => {
  const vendor = await ensureVendorProfile(vendorProfileId);

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      customerId,
      items: { some: { vendorId: vendorProfileId } },
    },
    select: {
      id: true,
      createdAt: true,
      totalPrice: true,
      status: true,
    },
  });

  if (!order) {
    throw new AppError(404, 'Order not found for this vendor');
  }

  const existing = await chatConversation.findFirst({
    where: {
      customerId,
      vendorProfileId,
      orderId,
      isSupport: true,
      status: 'OPEN',
    },
    include: conversationInclude,
    orderBy: { updatedAt: 'desc' },
  });

  if (existing) return existing;

  const created = await chatConversation.create({
    data: {
      customerId,
      vendorProfileId,
      orderId,
      isSupport: true,
      supportCategory: String(category || 'ORDER'),
      workflowStatus: 'WAITING_SELLER',
      customerLastReadAt: new Date(),
    },
    include: conversationInclude,
  });

  await chatMessage.create({
    data: {
      conversationId: created.id,
      senderRole: 'VENDOR',
      body:
        'Merhaba! Siparişinizle ilgili sorununuzu yazabilirsiniz. Satıcı en kısa sürede size yardımcı olacaktır.',
      autoMessage: true,
    },
  });

  await createOrderActionHistory({
    orderId,
    actionType: 'SUPPORT_REQUESTED',
    actorRole: 'CUSTOMER',
    actorId: customerId,
    vendorConversationId: created.id,
    metadata: {
      routeTarget: 'VENDOR',
      category: String(category || 'ORDER'),
      vendorProfileId,
      vendorName: vendor.shopName,
    },
  });

  return chatConversation.findUnique({
    where: { id: created.id },
    include: conversationInclude,
  });
};

export const listCustomerConversations = async (customerId: string) => {
  return chatConversation.findMany({
    where: { customerId, isSupport: false },
    include: {
      vendorProfile: { select: { id: true, shopName: true, storeCoverImageUrl: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { updatedAt: 'desc' },
  });
};

export const listCustomerSupportConversations = async (customerId: string) => {
  return chatConversation.findMany({
    where: { customerId, isSupport: true },
    include: {
      vendorProfile: { select: { id: true, shopName: true, storeCoverImageUrl: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { updatedAt: 'desc' },
  });
};

export const listVendorConversations = async (vendorUserId: string) => {
  const vendor = await ensureVendorProfileByUser(vendorUserId);

  return chatConversation.findMany({
    where: { vendorProfileId: vendor.id, isSupport: false },
    include: {
      customer: { select: { id: true, name: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { updatedAt: 'desc' },
  });
};

export const listVendorSupportConversations = async (vendorUserId: string) => {
  const vendor = await ensureVendorProfileByUser(vendorUserId);

  return chatConversation.findMany({
    where: { vendorProfileId: vendor.id, isSupport: true },
    include: {
      customer: { select: { id: true, name: true, email: true } },
      vendorProfile: { select: { id: true, shopName: true, storeCoverImageUrl: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { updatedAt: 'desc' },
  });
};

export const getConversationByIdForUser = async (conversationId: string, userId: string, role: 'CUSTOMER' | 'VENDOR') => {
  if (role === 'CUSTOMER') {
    return chatConversation.findFirst({
      where: { id: conversationId, customerId: userId },
      include: conversationInclude,
    });
  }

  const vendor = await ensureVendorProfileByUser(userId);

  return chatConversation.findFirst({
    where: { id: conversationId, vendorProfileId: vendor.id },
    include: conversationInclude,
  });
};

export const postMessage = async (
  conversationId: string,
  sender: { userId: string; role: 'CUSTOMER' | 'VENDOR' },
  body: string,
  imageUrl?: string
) => {
  const convo = await getConversationByIdForUser(conversationId, sender.userId, sender.role);
  if (!convo) throw new AppError(404, 'Conversation not found');
  if (String(convo.status || 'OPEN') !== 'OPEN') throw new AppError(400, 'Conversation is closed');

  const senderRole = sender.role === 'VENDOR' ? 'VENDOR' : 'CUSTOMER';

  const msg = await chatMessage.create({
    data: {
      conversationId,
      senderRole: senderRole as any,
      body: body || 'Gorsel eklendi',
      imageUrl: imageUrl || null,
      readAt: new Date(),
    },
  });

  await chatConversation.update({
    where: { id: conversationId },
    data: {
      updatedAt: new Date(),
      workflowStatus: (convo as any).isSupport
        ? sender.role === 'CUSTOMER'
          ? 'WAITING_SELLER'
          : 'OPEN'
        : (convo as any).workflowStatus,
      customerLastReadAt: sender.role === 'CUSTOMER' ? new Date() : (convo as any).customerLastReadAt,
      vendorLastReadAt: sender.role === 'VENDOR' ? new Date() : (convo as any).vendorLastReadAt,
    },
  });

  if ((convo as any).isSupport && (convo as any).orderId) {
    await createOrderActionHistory({
      orderId: (convo as any).orderId,
      actionType: 'MESSAGE_SENT',
      actorRole: sender.role,
      actorId: sender.userId,
      vendorConversationId: conversationId,
      metadata: {
        hasImage: Boolean(imageUrl),
        supportCategory: (convo as any).supportCategory || null,
      },
    });
  }

  if (sender.role === 'CUSTOMER') {
    const vendorEmail = String((convo as any)?.vendorProfile?.user?.email || '').trim();
    if (vendorEmail) {
      void sendSellerNewMessageEmail({
        to: vendorEmail,
        sellerName: (convo as any)?.vendorProfile?.user?.name,
        customerName: (convo as any)?.customer?.name,
        shopName: (convo as any)?.vendorProfile?.shopName,
        messageText: body,
        hasImage: Boolean(imageUrl),
        isSupport: Boolean((convo as any)?.isSupport),
        conversationId,
      }).catch((error) => {
        console.warn('[chatService] seller message notification mail failed:', error);
      });
    }
  }

  return msg;
};

export const markConversationRead = async (
  conversationId: string,
  actor: { userId: string; role: 'CUSTOMER' | 'VENDOR' }
) => {
  const convo = await getConversationByIdForUser(conversationId, actor.userId, actor.role);
  if (!convo) throw new AppError(404, 'Conversation not found');

  if (actor.role === 'CUSTOMER') {
    await chatConversation.update({
      where: { id: conversationId },
      data: { customerLastReadAt: new Date() },
    });
    await chatMessage.updateMany({
      where: { conversationId, senderRole: 'VENDOR', readAt: null },
      data: { readAt: new Date() },
    });
  } else {
    await chatConversation.update({
      where: { id: conversationId },
      data: { vendorLastReadAt: new Date() },
    });
    await chatMessage.updateMany({
      where: { conversationId, senderRole: 'CUSTOMER', readAt: null },
      data: { readAt: new Date() },
    });
  }

  return chatConversation.findUnique({ where: { id: conversationId }, include: conversationInclude });
};

export const closeConversationForUser = async (
  conversationId: string,
  actor: { userId: string; role: 'CUSTOMER' | 'VENDOR' }
) => {
  const convo = await getConversationByIdForUser(conversationId, actor.userId, actor.role);
  if (!convo) throw new AppError(404, 'Conversation not found');

  return chatConversation.update({
    where: { id: conversationId },
    data: { status: 'CLOSED', workflowStatus: 'CLOSED', closedAt: new Date() },
    include: conversationInclude,
  });
};

export const rateConversation = async (
  conversationId: string,
  customerId: string,
  rating: number,
  feedback?: string
) => {
  const convo = await getConversationByIdForUser(conversationId, customerId, 'CUSTOMER');
  if (!convo) throw new AppError(404, 'Conversation not found');

  return chatConversation.update({
    where: { id: conversationId },
    data: {
      customerRating: rating,
      customerFeedback: feedback || null,
    },
    include: conversationInclude,
  });
};

export const escalateConversationToAdmin = async (
  conversationId: string,
  vendorUserId: string,
  note?: string
) => {
  const vendor = await ensureVendorProfileByUser(vendorUserId);
  const convo = await chatConversation.findFirst({
    where: { id: conversationId, vendorProfileId: vendor.id, isSupport: true },
    include: conversationInclude,
  });

  if (!convo) throw new AppError(404, 'Support conversation not found');

  if ((convo as any).adminSupportConversationId) {
    return prisma.supportConversation.findUnique({
      where: { id: (convo as any).adminSupportConversationId },
      include: { messages: { orderBy: { createdAt: 'asc' } }, user: { select: { id: true, name: true, email: true } } },
    });
  }

  const transcript = Array.isArray((convo as any).messages)
    ? (convo as any).messages
        .slice(-8)
        .map((message: any) => `${message.senderRole === 'VENDOR' ? 'Satıcı' : 'Müşteri'}: ${message.body}`)
        .join('\n')
    : '';

  const adminConversation = await (prisma as any).supportConversation.create({
    data: {
      userId: (convo as any).customerId,
      status: 'OPEN',
      workflowStatus: 'WAITING_ADMIN',
      subject: `${vendor.shopName || 'Satıcı'} sipariş desteği`,
      category: String((convo as any).supportCategory || 'ORDER'),
      routeTarget: 'ESCALATED_VENDOR',
      orderId: (convo as any).orderId || null,
      vendorProfileId: vendor.id,
      sourceVendorConversationId: conversationId,
    },
  });

  await (prisma as any).supportMessage.create({
    data: {
      conversationId: adminConversation.id,
      senderRole: 'CUSTOMER',
      autoMessage: true,
      body: [
        'Satıcı tarafından platform desteğine aktarıldı.',
        note ? `Satıcı notu: ${note}` : '',
        transcript ? `Son mesaj özeti:\n${transcript}` : '',
      ]
        .filter(Boolean)
        .join('\n\n'),
    },
  });

  await chatConversation.update({
    where: { id: conversationId },
    data: {
      escalatedToAdmin: true,
      escalatedAt: new Date(),
      adminSupportConversationId: adminConversation.id,
      workflowStatus: 'WAITING_ADMIN',
    },
  });

  await createOrderActionHistory({
    orderId: (convo as any).orderId,
    actionType: 'ESCALATED_TO_ADMIN',
    actorRole: 'VENDOR',
    actorId: vendorUserId,
    supportConversationId: adminConversation.id,
    vendorConversationId: conversationId,
    note: note || null,
    metadata: {
      category: String((convo as any).supportCategory || 'ORDER'),
      vendorProfileId: vendor.id,
    },
  });

  return prisma.supportConversation.findUnique({
    where: { id: adminConversation.id },
    include: { messages: { orderBy: { createdAt: 'asc' } }, user: { select: { id: true, name: true, email: true } } },
  });
};
