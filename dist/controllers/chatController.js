"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadChatImage = exports.escalateConversation = exports.rateConversation = exports.closeConversation = exports.markConversationRead = exports.postMessage = exports.getConversationById = exports.getOrCreateSupportConversationForCustomer = exports.getOrCreateConversationForCustomer = exports.listCustomerSupportConversations = exports.listVendorSupportConversations = exports.listVendorConversations = exports.listMyConversations = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const chatService = __importStar(require("../services/chatService"));
const listMyConversations = async (req, res, next) => {
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
    }
    catch (e) {
        next(e);
    }
};
exports.listMyConversations = listMyConversations;
const listVendorConversations = async (req, res, next) => {
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
    }
    catch (e) {
        next(e);
    }
};
exports.listVendorConversations = listVendorConversations;
const listVendorSupportConversations = async (req, res, next) => {
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
    }
    catch (e) {
        next(e);
    }
};
exports.listVendorSupportConversations = listVendorSupportConversations;
const listCustomerSupportConversations = async (req, res, next) => {
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
    }
    catch (e) {
        next(e);
    }
};
exports.listCustomerSupportConversations = listCustomerSupportConversations;
const getOrCreateConversationForCustomer = async (req, res, next) => {
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
    }
    catch (e) {
        next(e);
    }
};
exports.getOrCreateConversationForCustomer = getOrCreateConversationForCustomer;
const getOrCreateSupportConversationForCustomer = async (req, res, next) => {
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
        const convo = await chatService.getOrCreateSupportConversationForCustomer(req.user.userId, vendorId, orderId, category);
        res.status(200).json({ success: true, data: convo });
    }
    catch (e) {
        next(e);
    }
};
exports.getOrCreateSupportConversationForCustomer = getOrCreateSupportConversationForCustomer;
const getConversationById = async (req, res, next) => {
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
        const convo = await chatService.getConversationByIdForUser(id, req.user.userId, req.user.role);
        if (!convo) {
            res.status(404).json({ success: false, message: 'Conversation not found' });
            return;
        }
        res.status(200).json({ success: true, data: convo });
    }
    catch (e) {
        next(e);
    }
};
exports.getConversationById = getConversationById;
const postMessage = async (req, res, next) => {
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
        const msg = await chatService.postMessage(id, { userId: req.user.userId, role: req.user.role }, body, imageUrl);
        res.status(201).json({ success: true, data: msg });
    }
    catch (e) {
        next(e);
    }
};
exports.postMessage = postMessage;
const markConversationRead = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const updated = await chatService.markConversationRead(req.params.id, {
            userId: req.user.userId,
            role: req.user.role,
        });
        res.status(200).json({ success: true, data: updated });
    }
    catch (e) {
        next(e);
    }
};
exports.markConversationRead = markConversationRead;
const closeConversation = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const updated = await chatService.closeConversationForUser(req.params.id, {
            userId: req.user.userId,
            role: req.user.role,
        });
        res.status(200).json({ success: true, data: updated });
    }
    catch (e) {
        next(e);
    }
};
exports.closeConversation = closeConversation;
const rateConversation = async (req, res, next) => {
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
    }
    catch (e) {
        next(e);
    }
};
exports.rateConversation = rateConversation;
const escalateConversation = async (req, res, next) => {
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
    }
    catch (e) {
        next(e);
    }
};
exports.escalateConversation = escalateConversation;
const uploadChatImage = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const file = req.file;
        if (!file) {
            res.status(400).json({ success: false, message: 'Image file is required' });
            return;
        }
        if (!String(file.mimetype || '').startsWith('image/')) {
            res.status(400).json({ success: false, message: 'Only image uploads are allowed' });
            return;
        }
        const uploadsDir = path_1.default.join(process.cwd(), 'uploads', 'chat');
        fs_1.default.mkdirSync(uploadsDir, { recursive: true });
        const extFromName = path_1.default.extname(file.originalname || '').trim();
        const extFromMime = String(file.mimetype || '').split('/')[1]?.trim();
        const extension = extFromName || (extFromMime ? `.${extFromMime.replace(/[^a-z0-9]/gi, '')}` : '.jpg');
        const filename = `chat-${req.user.userId}-${Date.now()}${extension}`;
        fs_1.default.writeFileSync(path_1.default.join(uploadsDir, filename), file.buffer);
        res.status(201).json({ success: true, data: { url: `/uploads/chat/${filename}` } });
    }
    catch (e) {
        next(e);
    }
};
exports.uploadChatImage = uploadChatImage;
