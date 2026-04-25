"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeConversation = exports.postAdminMessage = exports.getConversationById = exports.listConversations = void 0;
const db_1 = __importDefault(require("../config/db"));
const messageNotificationEmails_1 = require("../services/mail/messageNotificationEmails");
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
            note: input.note || null,
            metadata: input.metadata || undefined,
        },
    });
};
const listConversations = async (req, res, next) => {
    try {
        const conversations = await db_1.default.supportConversation.findMany({
            orderBy: { updatedAt: 'desc' },
            include: {
                user: { select: { id: true, name: true, email: true, role: true } },
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: { id: true, senderRole: true, body: true, imageUrl: true, createdAt: true, readAt: true },
                },
            },
        });
        const vendorIds = Array.from(new Set(conversations.map((item) => item.vendorProfileId).filter(Boolean)));
        const vendors = vendorIds.length
            ? await db_1.default.vendorProfile.findMany({ where: { id: { in: vendorIds } }, select: { id: true, shopName: true } })
            : [];
        const vendorMap = new Map(vendors.map((item) => [item.id, item]));
        const data = conversations.map((item) => ({
            ...item,
            vendorProfile: item.vendorProfileId ? vendorMap.get(item.vendorProfileId) || null : null,
        }));
        res.json({ success: true, data });
    }
    catch (error) {
        next(error);
    }
};
exports.listConversations = listConversations;
const getConversationById = async (req, res, next) => {
    try {
        const id = req.params.id;
        const conversation = await db_1.default.supportConversation.findUnique({
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
        const vendorProfile = conversation.vendorProfileId
            ? await db_1.default.vendorProfile.findUnique({ where: { id: conversation.vendorProfileId }, select: { id: true, shopName: true } })
            : null;
        const sourceVendorConversation = conversation.sourceVendorConversationId
            ? await db_1.default.vendorChatConversation.findUnique({
                where: { id: conversation.sourceVendorConversationId },
                include: {
                    customer: { select: { id: true, name: true, email: true } },
                    vendorProfile: { select: { id: true, shopName: true } },
                    messages: { orderBy: { createdAt: 'asc' } },
                },
            })
            : null;
        res.json({ success: true, data: { ...conversation, vendorProfile, sourceVendorConversation } });
    }
    catch (error) {
        next(error);
    }
};
exports.getConversationById = getConversationById;
const postAdminMessage = async (req, res, next) => {
    try {
        const conversationId = req.params.id;
        const body = String(req.body?.body || '').trim();
        const imageUrl = String(req.body?.imageUrl || '').trim() || null;
        if (!body && !imageUrl) {
            res.status(400).json({ success: false, message: 'Message body is required' });
            return;
        }
        const conversation = await db_1.default.supportConversation.findUnique({
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
        const message = await db_1.default.supportMessage.create({
            data: {
                conversationId,
                senderRole: 'ADMIN',
                body: body || 'Gorsel eklendi',
                imageUrl,
                readAt: new Date(),
            },
        });
        await db_1.default.supportConversation.update({
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
        if (String(conversation?.user?.role || '') === 'VENDOR') {
            const email = String(conversation?.user?.email || '').trim();
            if (email) {
                void (0, messageNotificationEmails_1.sendSellerAdminSupportMessageEmail)({
                    to: email,
                    sellerName: conversation?.user?.name,
                    messageText: body,
                    hasImage: Boolean(imageUrl),
                }).catch((mailError) => {
                    console.warn('[adminSupportController] vendor support mail failed:', mailError);
                });
            }
        }
        res.status(201).json({ success: true, data: message });
    }
    catch (error) {
        next(error);
    }
};
exports.postAdminMessage = postAdminMessage;
const closeConversation = async (req, res, next) => {
    try {
        const id = req.params.id;
        const updated = await db_1.default.supportConversation.update({
            where: { id },
            data: { status: 'CLOSED', workflowStatus: 'CLOSED', closedAt: new Date() },
        });
        await createOrderActionHistory({
            orderId: updated.orderId,
            actionType: 'CLOSED',
            actorRole: 'ADMIN',
            actorId: req.user?.userId,
            supportConversationId: id,
        });
        res.json({ success: true, data: updated });
    }
    catch (error) {
        next(error);
    }
};
exports.closeConversation = closeConversation;
