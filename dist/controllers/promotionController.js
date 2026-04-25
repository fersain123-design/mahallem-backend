"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deletePromotion = exports.getActivePromotions = exports.rejectPromotion = exports.approvePromotion = exports.getPendingPromotions = exports.getVendorPromotions = exports.createPromotion = void 0;
const db_1 = __importDefault(require("../config/db"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const prismaAny = db_1.default;
// Vendor: Promosyon oluştur
const createPromotion = async (req, res) => {
    try {
        const vendorId = req.user?.vendorProfileId;
        if (!vendorId) {
            return res.status(401).json({ error: 'Satıcı profili gerekli' });
        }
        const { title, description, discountPercentage, type, validFrom, validUntil } = req.body;
        if (!title || !discountPercentage || !type || !validFrom || !validUntil) {
            return res.status(400).json({ error: 'Tüm alanlar gerekli' });
        }
        if (discountPercentage < 0 || discountPercentage > 100) {
            return res.status(400).json({ error: 'İndirim yüzdesi 0-100 arasında olmalı' });
        }
        if (new Date(validFrom) >= new Date(validUntil)) {
            return res.status(400).json({ error: 'Başlangıç tarihi bitiş tarihinden önce olmalı' });
        }
        // Fotoğraf yükleme
        let imageUrl;
        if (req.file) {
            const uploadsDir = path_1.default.join(__dirname, '../../uploads/promotions');
            if (!fs_1.default.existsSync(uploadsDir)) {
                fs_1.default.mkdirSync(uploadsDir, { recursive: true });
            }
            const filename = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${path_1.default.extname(req.file.originalname)}`;
            const filepath = path_1.default.join(uploadsDir, filename);
            fs_1.default.writeFileSync(filepath, req.file.buffer);
            imageUrl = `/uploads/promotions/${filename}`;
        }
        const promotion = await prismaAny.promotion.create({
            data: {
                vendorProfileId: vendorId,
                title,
                description,
                discountPercentage: Number(discountPercentage),
                type,
                validFrom: new Date(validFrom),
                validUntil: new Date(validUntil),
                imageUrl,
                status: 'PENDING',
            },
            include: {
                vendorProfile: {
                    select: {
                        user: { select: { id: true, email: true, name: true } },
                    },
                },
            },
        });
        // Admin'e bildirim gönder
        const admins = await db_1.default.user.findMany({
            where: { role: 'ADMIN' },
        });
        for (const admin of admins) {
            await db_1.default.notification.create({
                data: {
                    userId: admin.id,
                    type: 'SYSTEM_MESSAGE',
                    title: 'Yeni Promosyon Onay İsteği',
                    message: `${promotion.vendorProfile.user.name} - "${promotion.title}" indirimi (${promotion.discountPercentage}%) onayınızı bekliyor.`,
                },
            });
        }
        return res.status(201).json({
            success: true,
            message: 'Promosyon oluşturuldu, admin onayı bekleniyor',
            promotion,
        });
    }
    catch (error) {
        console.error('Promosyon oluşturma hatası:', error);
        return res.status(500).json({ error: 'Promosyon oluşturulamadı' });
    }
};
exports.createPromotion = createPromotion;
// Satıcı: Kendi promosyonlarını listele
const getVendorPromotions = async (req, res) => {
    try {
        const vendorId = req.user?.vendorProfileId;
        if (!vendorId) {
            return res.status(401).json({ error: 'Satıcı profili gerekli' });
        }
        const promotions = await prismaAny.promotion.findMany({
            where: { vendorProfileId: vendorId },
            orderBy: { createdAt: 'desc' },
        });
        return res.json({ success: true, promotions });
    }
    catch (error) {
        console.error('Promosyon listesi hatası:', error);
        return res.status(500).json({ error: 'Promosyonlar alınamadı' });
    }
};
exports.getVendorPromotions = getVendorPromotions;
// Admin: Onay bekleyen promosyonları listele
const getPendingPromotions = async (req, res) => {
    try {
        const userRole = req.user?.role;
        if (userRole !== 'ADMIN') {
            return res.status(403).json({ error: 'Yetki yok' });
        }
        const promotions = await prismaAny.promotion.findMany({
            where: { status: 'PENDING' },
            include: {
                vendorProfile: {
                    include: {
                        user: { select: { id: true, name: true, email: true } },
                    },
                },
            },
            orderBy: { createdAt: 'asc' },
        });
        return res.json({ success: true, promotions });
    }
    catch (error) {
        console.error('Onay bekleyen promosyonlar hatası:', error);
        return res.status(500).json({ error: 'Promosyonlar alınamadı' });
    }
};
exports.getPendingPromotions = getPendingPromotions;
// Admin: Promosyonu onayla
const approvePromotion = async (req, res) => {
    try {
        const userRole = req.user?.role;
        if (userRole !== 'ADMIN') {
            return res.status(403).json({ error: 'Yetki yok' });
        }
        const { promotionId } = req.params;
        const promotion = await prismaAny.promotion.findUnique({
            where: { id: promotionId },
            include: {
                vendorProfile: {
                    include: {
                        user: { select: { id: true, name: true, email: true } },
                    },
                },
            },
        });
        if (!promotion) {
            return res.status(404).json({ error: 'Promosyon bulunamadı' });
        }
        const updated = await prismaAny.promotion.update({
            where: { id: promotionId },
            data: { status: 'APPROVED' },
            include: { vendorProfile: true },
        });
        // Satıcıya bildirim gönder
        await db_1.default.notification.create({
            data: {
                userId: promotion.vendorProfile.user.id,
                type: 'SYSTEM_MESSAGE',
                title: 'Promosyon Onaylandı ✅',
                message: `"${promotion.title}" promosyonunuz onaylandı ve müşterilere gösterilecek.`,
            },
        });
        return res.json({
            success: true,
            message: 'Promosyon onaylandı',
            promotion: updated,
        });
    }
    catch (error) {
        console.error('Promosyon onaylama hatası:', error);
        return res.status(500).json({ error: 'Promosyon onaylanamadı' });
    }
};
exports.approvePromotion = approvePromotion;
// Admin: Promosyonu reddet
const rejectPromotion = async (req, res) => {
    try {
        const userRole = req.user?.role;
        if (userRole !== 'ADMIN') {
            return res.status(403).json({ error: 'Yetki yok' });
        }
        const { promotionId } = req.params;
        const { reason } = req.body;
        const promotion = await prismaAny.promotion.findUnique({
            where: { id: promotionId },
            include: {
                vendorProfile: {
                    include: {
                        user: { select: { id: true, name: true, email: true } },
                    },
                },
            },
        });
        if (!promotion) {
            return res.status(404).json({ error: 'Promosyon bulunamadı' });
        }
        const updated = await prismaAny.promotion.update({
            where: { id: promotionId },
            data: { status: 'REJECTED' },
            include: { vendorProfile: true },
        });
        // Satıcıya bildirim gönder
        await db_1.default.notification.create({
            data: {
                userId: promotion.vendorProfile.user.id,
                type: 'SYSTEM_MESSAGE',
                title: 'Promosyon Reddedildi ❌',
                message: `"${promotion.title}" promosyonunuz reddedildi. Sebep: ${reason || 'Belirtilmedi'}`,
            },
        });
        return res.json({
            success: true,
            message: 'Promosyon reddedildi',
            promotion: updated,
        });
    }
    catch (error) {
        console.error('Promosyon reddetme hatası:', error);
        return res.status(500).json({ error: 'Promosyon reddedilemedi' });
    }
};
exports.rejectPromotion = rejectPromotion;
// Müşteri: Aktif promosyonları listele
const getActivePromotions = async (req, res) => {
    try {
        const { type } = req.query; // 'DAILY' or 'MONTHLY'
        const now = new Date();
        const where = {
            status: 'APPROVED',
            validFrom: { lte: now },
            validUntil: { gte: now },
        };
        if (type && (type === 'DAILY' || type === 'MONTHLY')) {
            where.type = type;
        }
        const promotions = await prismaAny.promotion.findMany({
            where,
            include: {
                vendorProfile: {
                    select: {
                        id: true,
                        shopName: true,
                        businessType: true,
                        user: { select: { id: true, name: true } },
                    },
                },
            },
            orderBy: { discountPercentage: 'desc' },
            take: 10,
        });
        return res.json({ success: true, promotions });
    }
    catch (error) {
        console.error('Aktif promosyonlar hatası:', error);
        return res.status(500).json({ error: 'Promosyonlar alınamadı' });
    }
};
exports.getActivePromotions = getActivePromotions;
// Satıcı: Promosyonu sil
const deletePromotion = async (req, res) => {
    try {
        const vendorId = req.user?.vendorProfileId;
        if (!vendorId) {
            return res.status(401).json({ error: 'Satıcı profili gerekli' });
        }
        const { promotionId } = req.params;
        const promotion = await prismaAny.promotion.findUnique({
            where: { id: promotionId },
        });
        if (!promotion) {
            return res.status(404).json({ error: 'Promosyon bulunamadı' });
        }
        if (promotion.vendorProfileId !== vendorId) {
            return res.status(403).json({ error: 'Bu promosyonu silemezsiniz' });
        }
        if (promotion.status === 'APPROVED') {
            return res.status(400).json({ error: 'Onaylı promosyonlar silinemez' });
        }
        // Fotoğrafı sil
        if (promotion.imageUrl) {
            const filepath = path_1.default.join(__dirname, '../../' + promotion.imageUrl.replace(/^\//, ''));
            if (fs_1.default.existsSync(filepath)) {
                fs_1.default.unlinkSync(filepath);
            }
        }
        await prismaAny.promotion.delete({
            where: { id: promotionId },
        });
        return res.json({
            success: true,
            message: 'Promosyon silindi',
        });
    }
    catch (error) {
        console.error('Promosyon silme hatası:', error);
        return res.status(500).json({ error: 'Promosyon silinemedi' });
    }
};
exports.deletePromotion = deletePromotion;
