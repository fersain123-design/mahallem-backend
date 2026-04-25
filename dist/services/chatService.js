"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.escalateConversationToAdmin = exports.rateConversation = exports.closeConversationForUser = exports.markConversationRead = exports.postMessage = exports.getConversationByIdForUser = exports.listVendorSupportConversations = exports.listVendorConversations = exports.listCustomerSupportConversations = exports.listCustomerConversations = exports.getOrCreateSupportConversationForCustomer = exports.getOrCreateConversationForCustomer = void 0;
const db_1 = __importDefault(require("../config/db"));
const errorHandler_1 = require("../middleware/errorHandler");
const messageNotificationEmails_1 = require("./mail/messageNotificationEmails");
const chatConversation = db_1.default.vendorChatConversation;
const chatMessage = db_1.default.vendorChatMessage;
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
const createOrderActionHistory = async (input) => {
    if (!input.orderId)
        return;
    await db_1.default.orderActionHistory.create({
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
const ensureVendorProfile = async (vendorProfileId) => {
    const vendor = await db_1.default.vendorProfile.findFirst({
        where: { id: vendorProfileId, status: 'APPROVED', user: { isActive: true } },
        select: { id: true, shopName: true, userId: true },
    });
    if (!vendor) {
        throw new errorHandler_1.AppError(404, 'Vendor not found');
    }
    return vendor;
};
const ensureVendorProfileByUser = async (vendorUserId) => {
    const vendor = await db_1.default.vendorProfile.findUnique({
        where: { userId: vendorUserId },
        select: { id: true, shopName: true, userId: true },
    });
    if (!vendor)
        throw new errorHandler_1.AppError(404, 'Vendor profile not found');
    return vendor;
};
const getOrCreateConversationForCustomer = async (customerId, vendorProfileId) => {
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
    if (existing)
        return existing;
    return chatConversation.create({
        data: {
            customerId,
            vendorProfileId,
        },
        include: conversationInclude,
    });
};
exports.getOrCreateConversationForCustomer = getOrCreateConversationForCustomer;
const getOrCreateSupportConversationForCustomer = async (customerId, vendorProfileId, orderId, category) => {
    const vendor = await ensureVendorProfile(vendorProfileId);
    const order = await db_1.default.order.findFirst({
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
        throw new errorHandler_1.AppError(404, 'Order not found for this vendor');
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
    if (existing)
        return existing;
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
            body: 'Merhaba! Siparişinizle ilgili sorununuzu yazabilirsiniz. Satıcı en kısa sürede size yardımcı olacaktır.',
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
exports.getOrCreateSupportConversationForCustomer = getOrCreateSupportConversationForCustomer;
const listCustomerConversations = async (customerId) => {
    return chatConversation.findMany({
        where: { customerId, isSupport: false },
        include: {
            vendorProfile: { select: { id: true, shopName: true, storeCoverImageUrl: true } },
            messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: { updatedAt: 'desc' },
    });
};
exports.listCustomerConversations = listCustomerConversations;
const listCustomerSupportConversations = async (customerId) => {
    return chatConversation.findMany({
        where: { customerId, isSupport: true },
        include: {
            vendorProfile: { select: { id: true, shopName: true, storeCoverImageUrl: true } },
            messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: { updatedAt: 'desc' },
    });
};
exports.listCustomerSupportConversations = listCustomerSupportConversations;
const listVendorConversations = async (vendorUserId) => {
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
exports.listVendorConversations = listVendorConversations;
const listVendorSupportConversations = async (vendorUserId) => {
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
exports.listVendorSupportConversations = listVendorSupportConversations;
const getConversationByIdForUser = async (conversationId, userId, role) => {
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
exports.getConversationByIdForUser = getConversationByIdForUser;
const postMessage = async (conversationId, sender, body, imageUrl) => {
    const convo = await (0, exports.getConversationByIdForUser)(conversationId, sender.userId, sender.role);
    if (!convo)
        throw new errorHandler_1.AppError(404, 'Conversation not found');
    if (String(convo.status || 'OPEN') !== 'OPEN')
        throw new errorHandler_1.AppError(400, 'Conversation is closed');
    const senderRole = sender.role === 'VENDOR' ? 'VENDOR' : 'CUSTOMER';
    const msg = await chatMessage.create({
        data: {
            conversationId,
            senderRole: senderRole,
            body: body || 'Gorsel eklendi',
            imageUrl: imageUrl || null,
            readAt: new Date(),
        },
    });
    await chatConversation.update({
        where: { id: conversationId },
        data: {
            updatedAt: new Date(),
            workflowStatus: convo.isSupport
                ? sender.role === 'CUSTOMER'
                    ? 'WAITING_SELLER'
                    : 'OPEN'
                : convo.workflowStatus,
            customerLastReadAt: sender.role === 'CUSTOMER' ? new Date() : convo.customerLastReadAt,
            vendorLastReadAt: sender.role === 'VENDOR' ? new Date() : convo.vendorLastReadAt,
        },
    });
    if (convo.isSupport && convo.orderId) {
        await createOrderActionHistory({
            orderId: convo.orderId,
            actionType: 'MESSAGE_SENT',
            actorRole: sender.role,
            actorId: sender.userId,
            vendorConversationId: conversationId,
            metadata: {
                hasImage: Boolean(imageUrl),
                supportCategory: convo.supportCategory || null,
            },
        });
    }
    if (sender.role === 'CUSTOMER') {
        const vendorEmail = String(convo?.vendorProfile?.user?.email || '').trim();
        if (vendorEmail) {
            void (0, messageNotificationEmails_1.sendSellerNewMessageEmail)({
                to: vendorEmail,
                sellerName: convo?.vendorProfile?.user?.name,
                customerName: convo?.customer?.name,
                shopName: convo?.vendorProfile?.shopName,
                messageText: body,
                hasImage: Boolean(imageUrl),
                isSupport: Boolean(convo?.isSupport),
                conversationId,
            }).catch((error) => {
                console.warn('[chatService] seller message notification mail failed:', error);
            });
        }
    }
    return msg;
};
exports.postMessage = postMessage;
const markConversationRead = async (conversationId, actor) => {
    const convo = await (0, exports.getConversationByIdForUser)(conversationId, actor.userId, actor.role);
    if (!convo)
        throw new errorHandler_1.AppError(404, 'Conversation not found');
    if (actor.role === 'CUSTOMER') {
        await chatConversation.update({
            where: { id: conversationId },
            data: { customerLastReadAt: new Date() },
        });
        await chatMessage.updateMany({
            where: { conversationId, senderRole: 'VENDOR', readAt: null },
            data: { readAt: new Date() },
        });
    }
    else {
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
exports.markConversationRead = markConversationRead;
const closeConversationForUser = async (conversationId, actor) => {
    const convo = await (0, exports.getConversationByIdForUser)(conversationId, actor.userId, actor.role);
    if (!convo)
        throw new errorHandler_1.AppError(404, 'Conversation not found');
    return chatConversation.update({
        where: { id: conversationId },
        data: { status: 'CLOSED', workflowStatus: 'CLOSED', closedAt: new Date() },
        include: conversationInclude,
    });
};
exports.closeConversationForUser = closeConversationForUser;
const rateConversation = async (conversationId, customerId, rating, feedback) => {
    const convo = await (0, exports.getConversationByIdForUser)(conversationId, customerId, 'CUSTOMER');
    if (!convo)
        throw new errorHandler_1.AppError(404, 'Conversation not found');
    return chatConversation.update({
        where: { id: conversationId },
        data: {
            customerRating: rating,
            customerFeedback: feedback || null,
        },
        include: conversationInclude,
    });
};
exports.rateConversation = rateConversation;
const escalateConversationToAdmin = async (conversationId, vendorUserId, note) => {
    const vendor = await ensureVendorProfileByUser(vendorUserId);
    const convo = await chatConversation.findFirst({
        where: { id: conversationId, vendorProfileId: vendor.id, isSupport: true },
        include: conversationInclude,
    });
    if (!convo)
        throw new errorHandler_1.AppError(404, 'Support conversation not found');
    if (convo.adminSupportConversationId) {
        return db_1.default.supportConversation.findUnique({
            where: { id: convo.adminSupportConversationId },
            include: { messages: { orderBy: { createdAt: 'asc' } }, user: { select: { id: true, name: true, email: true } } },
        });
    }
    const transcript = Array.isArray(convo.messages)
        ? convo.messages
            .slice(-8)
            .map((message) => `${message.senderRole === 'VENDOR' ? 'Satıcı' : 'Müşteri'}: ${message.body}`)
            .join('\n')
        : '';
    const adminConversation = await db_1.default.supportConversation.create({
        data: {
            userId: convo.customerId,
            status: 'OPEN',
            workflowStatus: 'WAITING_ADMIN',
            subject: `${vendor.shopName || 'Satıcı'} sipariş desteği`,
            category: String(convo.supportCategory || 'ORDER'),
            routeTarget: 'ESCALATED_VENDOR',
            orderId: convo.orderId || null,
            vendorProfileId: vendor.id,
            sourceVendorConversationId: conversationId,
        },
    });
    await db_1.default.supportMessage.create({
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
        orderId: convo.orderId,
        actionType: 'ESCALATED_TO_ADMIN',
        actorRole: 'VENDOR',
        actorId: vendorUserId,
        supportConversationId: adminConversation.id,
        vendorConversationId: conversationId,
        note: note || null,
        metadata: {
            category: String(convo.supportCategory || 'ORDER'),
            vendorProfileId: vendor.id,
        },
    });
    return db_1.default.supportConversation.findUnique({
        where: { id: adminConversation.id },
        include: { messages: { orderBy: { createdAt: 'asc' } }, user: { select: { id: true, name: true, email: true } } },
    });
};
exports.escalateConversationToAdmin = escalateConversationToAdmin;
