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
exports.getOrderById = exports.getOrders = exports.createOrder = exports.getCartDeliveryEstimate = exports.clearCart = exports.removeFromCart = exports.updateCartItem = exports.addToCart = exports.getCart = exports.getVendorById = exports.getVendors = exports.getNeighborhoodLiveStats = exports.getVendorRatings = exports.getVendorRatingsSummary = exports.getOrderSellerRating = exports.updateOrderSellerRating = exports.createOrderSellerRating = exports.addProductReview = exports.getProductReviews = exports.getProductById = exports.getBestSellerProducts = exports.getProducts = exports.getCategories = exports.setDefaultAddress = exports.deleteAddress = exports.updateAddress = exports.addAddress = exports.getAddressById = exports.getAddresses = exports.getPushStatus = exports.sendTestPushNotification = exports.unregisterPushToken = exports.registerPushToken = exports.markAllNotificationsAsRead = exports.markNotificationAsRead = exports.getNotifications = exports.updateProfile = exports.getProfile = void 0;
const customerService = __importStar(require("../services/customerService"));
const validationSchemas_1 = require("../utils/validationSchemas");
const orderService = __importStar(require("../services/orderService"));
const sellerRatingService = __importStar(require("../services/sellerRatingService"));
const db_1 = __importDefault(require("../config/db"));
const trNormalize_1 = require("../utils/trNormalize");
const sellerCampaignService_1 = require("../services/sellerCampaignService");
const platformNeighborhoodDeliveryService_1 = require("../services/platformNeighborhoodDeliveryService");
const pushNotificationService_1 = require("../services/pushNotificationService");
const normalizeBusinessType = (value) => {
    if (!value)
        return undefined;
    const map = {
        ç: 'c',
        ğ: 'g',
        ı: 'i',
        ö: 'o',
        ş: 's',
        ü: 'u',
        Ç: 'c',
        Ğ: 'g',
        İ: 'i',
        Ö: 'o',
        Ş: 's',
        Ü: 'u',
    };
    const normalized = String(value)
        .trim()
        .split('')
        .map((ch) => map[ch] ?? ch)
        .join('')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40);
    return normalized || undefined;
};
const parseTimeToMinutes = (timeText) => {
    const m = String(timeText || '').trim().match(/^(\d{1,2})[:.](\d{2})$/);
    if (!m)
        return null;
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    if (!Number.isFinite(hh) || !Number.isFinite(mm))
        return null;
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59)
        return null;
    return hh * 60 + mm;
};
const computeIsOpenNow = (openingTime, closingTime, storeOpenOverride) => {
    if (typeof storeOpenOverride === 'boolean') {
        return storeOpenOverride;
    }
    const openText = String(openingTime || '09:00').trim();
    const closeText = String(closingTime || '21:00').trim();
    const openMin = parseTimeToMinutes(openText);
    const closeMin = parseTimeToMinutes(closeText);
    if (openMin == null || closeMin == null)
        return null;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (closeMin < openMin) {
        return nowMin >= openMin || nowMin < closeMin;
    }
    return nowMin >= openMin && nowMin < closeMin;
};
const toMoney = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n))
        return 0;
    return Number(n.toFixed(2));
};
const formatDeliveryRangeText = (minMinutes, maxMinutes) => {
    const min = Number(minMinutes);
    const max = Number(maxMinutes);
    const minOk = Number.isFinite(min) && min > 0;
    const maxOk = Number.isFinite(max) && max > 0;
    if (!minOk && !maxOk)
        return null;
    const safeMin = minOk ? Math.round(min) : Math.round(max);
    const roundedMax = maxOk ? Math.round(max) : null;
    if (roundedMax != null && roundedMax > safeMin) {
        return `${safeMin}-${roundedMax} dk`;
    }
    return `${safeMin} dk`;
};
const resolveProductDisplayCategory = (product) => {
    return String(product?.subCategory?.name || product?.subCategoryName || product?.category?.name || '').trim();
};
const getErrorMessage = (error) => {
    if (!error)
        return '';
    const asAny = error;
    return String(asAny?.message || error || '');
};
const isDatabaseRuntimeError = (error) => {
    const message = getErrorMessage(error).toLowerCase();
    const code = String(error?.code || '').toUpperCase();
    return (code.startsWith('P') ||
        message.includes('prisma') ||
        message.includes('database') ||
        message.includes('relation') ||
        message.includes('table') ||
        message.includes('does not exist') ||
        message.includes('no such table') ||
        message.includes("can't reach database server") ||
        message.includes('connection'));
};
// Profile endpoints
const getProfile = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const profile = await customerService.getCustomerProfile(req.user.userId);
        res.status(200).json({ success: true, data: profile });
    }
    catch (error) {
        next(error);
    }
};
exports.getProfile = getProfile;
const updateProfile = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const data = validationSchemas_1.UpdateProfileSchema.parse(req.body);
        const profile = await customerService.updateCustomerProfile(req.user.userId, data);
        res.status(200).json({ success: true, data: profile });
    }
    catch (error) {
        next(error);
    }
};
exports.updateProfile = updateProfile;
const getNotifications = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const limitRaw = req.query.limit;
        const limit = limitRaw ? parseInt(limitRaw, 10) : 20;
        const unreadOnlyRaw = String(req.query.unreadOnly || '').trim().toLowerCase();
        const unreadOnly = unreadOnlyRaw === 'true' || unreadOnlyRaw === '1';
        const notifications = await db_1.default.notification.findMany({
            where: {
                userId: req.user.userId,
                ...(unreadOnly ? { isRead: false } : {}),
            },
            orderBy: { createdAt: 'desc' },
            take: Math.min(Math.max(limit, 1), 100),
        });
        res.status(200).json({ success: true, data: notifications });
    }
    catch (error) {
        next(error);
    }
};
exports.getNotifications = getNotifications;
const markNotificationAsRead = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const { id } = req.params;
        const existing = await db_1.default.notification.findFirst({
            where: { id, userId: req.user.userId },
        });
        if (!existing) {
            res.status(404).json({ success: false, message: 'Notification not found' });
            return;
        }
        const updated = await db_1.default.notification.update({
            where: { id },
            data: { isRead: true },
        });
        res.status(200).json({ success: true, data: updated });
    }
    catch (error) {
        next(error);
    }
};
exports.markNotificationAsRead = markNotificationAsRead;
const markAllNotificationsAsRead = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const result = await db_1.default.notification.updateMany({
            where: {
                userId: req.user.userId,
                isRead: false,
            },
            data: {
                isRead: true,
            },
        });
        res.status(200).json({ success: true, data: { updatedCount: result.count } });
    }
    catch (error) {
        next(error);
    }
};
exports.markAllNotificationsAsRead = markAllNotificationsAsRead;
const registerPushToken = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const token = String(req.body?.token || '').trim();
        const platform = String(req.body?.platform || '').trim() || null;
        const deviceId = String(req.body?.deviceId || '').trim() || null;
        if (!token || !(0, pushNotificationService_1.isExpoPushToken)(token)) {
            res.status(400).json({ success: false, message: 'Invalid Expo push token' });
            return;
        }
        const saved = await db_1.default.userDeviceToken.upsert({
            where: { token },
            update: {
                userId: req.user.userId,
                isActive: true,
                platform,
                deviceId,
                lastSeenAt: new Date(),
            },
            create: {
                userId: req.user.userId,
                token,
                platform,
                deviceId,
                isActive: true,
                lastSeenAt: new Date(),
            },
        });
        res.status(200).json({ success: true, data: { id: saved.id, token: saved.token } });
    }
    catch (error) {
        next(error);
    }
};
exports.registerPushToken = registerPushToken;
const unregisterPushToken = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const token = String(req.body?.token || '').trim();
        if (token) {
            await db_1.default.userDeviceToken.updateMany({
                where: {
                    userId: req.user.userId,
                    token,
                },
                data: {
                    isActive: false,
                    lastSeenAt: new Date(),
                },
            });
        }
        else {
            await db_1.default.userDeviceToken.updateMany({
                where: { userId: req.user.userId },
                data: {
                    isActive: false,
                    lastSeenAt: new Date(),
                },
            });
        }
        res.status(200).json({ success: true });
    }
    catch (error) {
        next(error);
    }
};
exports.unregisterPushToken = unregisterPushToken;
const sendTestPushNotification = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const title = String(req.body?.title || 'Mahallem Bildirimi').trim();
        const body = String(req.body?.body || 'Mahallem akıllı bildirim sistemi aktif.').trim();
        const route = String(req.body?.route || '/notifications').trim();
        const result = await (0, pushNotificationService_1.sendPushNotificationToUser)(req.user.userId, {
            title,
            body,
            data: {
                route,
                source: 'test',
                notificationType: 'SYSTEM_TEST',
                logoUrl: 'https://mahallem.live/logo.png',
            },
            subtitle: 'Test Bildirimi',
            imageUrl: 'https://mahallem.live/logo.png',
        });
        res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
};
exports.sendTestPushNotification = sendTestPushNotification;
const getPushStatus = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const tokens = await db_1.default.userDeviceToken.findMany({
            where: {
                userId: req.user.userId,
            },
            orderBy: {
                updatedAt: 'desc',
            },
            select: {
                token: true,
                isActive: true,
                platform: true,
                deviceId: true,
                updatedAt: true,
            },
        });
        const masked = tokens.map((entry) => {
            const token = String(entry.token || '');
            const maskStart = token.slice(0, 22);
            const maskEnd = token.slice(-6);
            return {
                token: `${maskStart}...${maskEnd}`,
                isActive: entry.isActive,
                platform: entry.platform,
                deviceId: entry.deviceId,
                updatedAt: entry.updatedAt,
            };
        });
        const activeCount = tokens.filter((entry) => entry.isActive).length;
        res.status(200).json({
            success: true,
            data: {
                activeCount,
                totalCount: tokens.length,
                tokens: masked,
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getPushStatus = getPushStatus;
// Address endpoints
const getAddresses = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const addresses = await customerService.getCustomerAddresses(req.user.userId);
        res.status(200).json({ success: true, data: addresses });
    }
    catch (error) {
        next(error);
    }
};
exports.getAddresses = getAddresses;
const getAddressById = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const { id } = req.params;
        const address = await customerService.getCustomerAddressById(id, req.user.userId);
        res.status(200).json({ success: true, data: address });
    }
    catch (error) {
        next(error);
    }
};
exports.getAddressById = getAddressById;
const addAddress = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const data = validationSchemas_1.AddressSchema.parse(req.body);
        const address = await customerService.addCustomerAddress(req.user.userId, data);
        res.status(201).json({ success: true, data: address });
    }
    catch (error) {
        next(error);
    }
};
exports.addAddress = addAddress;
const updateAddress = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const { id } = req.params;
        const data = validationSchemas_1.AddressSchema.parse(req.body);
        const address = await customerService.updateCustomerAddress(id, req.user.userId, data);
        res.status(200).json({ success: true, data: address });
    }
    catch (error) {
        next(error);
    }
};
exports.updateAddress = updateAddress;
const deleteAddress = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const { id } = req.params;
        const result = await customerService.deleteCustomerAddress(id, req.user.userId);
        res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteAddress = deleteAddress;
const setDefaultAddress = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const { id } = req.params;
        const address = await customerService.setDefaultAddress(id, req.user.userId);
        res.status(200).json({ success: true, data: address });
    }
    catch (error) {
        next(error);
    }
};
exports.setDefaultAddress = setDefaultAddress;
// Product & Category endpoints
const getCategories = async (req, res, next) => {
    try {
        const categories = await customerService.getCategories();
        res.status(200).json({
            success: true,
            data: categories.map((c) => {
                const icon = 'icon' in c ? c.icon : null;
                const image = 'image' in c ? c.image : null;
                return {
                    id: c.slug || c.id,
                    name: c.name,
                    icon: icon || 'shape-outline',
                    image: image || 'market.jpg',
                };
            }),
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getCategories = getCategories;
const getProducts = async (req, res, next) => {
    try {
        const { categoryId, search, sort, page, limit, vendorId, neighborhood, district, city, discount, special, expandToNeighbors, latitude, longitude, lat, lng, } = req.query;
        const parsedLatitude = Number(latitude ?? lat);
        const parsedLongitude = Number(longitude ?? lng);
        const hasCoordinates = Number.isFinite(parsedLatitude) && Number.isFinite(parsedLongitude);
        const result = await customerService.getProducts({
            categoryId: categoryId,
            search: search,
            sort: sort || 'newest',
            page: page ? parseInt(page) : 1,
            limit: limit ? parseInt(limit) : 20,
            vendorId: vendorId,
            neighborhood: neighborhood,
            district: district,
            city: city,
            latitude: hasCoordinates ? parsedLatitude : undefined,
            longitude: hasCoordinates ? parsedLongitude : undefined,
            expandToNeighbors: String(expandToNeighbors || '')
                .trim()
                .toLowerCase() === 'true',
            discountOnly: String(discount || '')
                .trim()
                .toLowerCase() === 'true',
            specialOnly: String(special || '')
                .trim()
                .toLowerCase() === 'true',
        });
        const rawProducts = Array.isArray(result.products) ? result.products : [];
        const productIds = rawProducts.map((p) => String(p?.id || '')).filter(Boolean);
        const [salesAgg, reviewsAgg] = await Promise.all([
            productIds.length > 0
                ? db_1.default
                    .orderItem.groupBy({
                    by: ['productId'],
                    where: {
                        productId: { in: productIds },
                        order: { status: 'DELIVERED' },
                    },
                    _sum: { quantity: true },
                })
                    .catch(() => [])
                : Promise.resolve([]),
            productIds.length > 0
                ? db_1.default
                    .productReview.groupBy({
                    by: ['productId'],
                    where: { productId: { in: productIds } },
                    _count: { _all: true },
                    _avg: { rating: true },
                })
                    .catch(() => [])
                : Promise.resolve([]),
        ]);
        const soldMap = new Map();
        for (const row of (salesAgg || [])) {
            soldMap.set(String(row.productId), Number(row?._sum?.quantity || 0));
        }
        const reviewMap = new Map();
        for (const row of (reviewsAgg || [])) {
            const avg = Number(row?._avg?.rating || 0);
            const count = Number(row?._count?._all || 0);
            reviewMap.set(String(row.productId), {
                rating: Number.isFinite(avg) ? Math.round(avg * 10) / 10 : 0,
                rating_count: Number.isFinite(count) ? count : 0,
            });
        }
        // Map to customer-app product shape
        const products = rawProducts.map((p) => {
            const images = Array.isArray(p?.images)
                ? p.images.map((im) => im?.imageUrl).filter(Boolean)
                : [];
            const primaryImage = p?.imageUrl || images[0];
            const normalizedImages = primaryImage
                ? [primaryImage, ...images.filter((u) => u !== primaryImage)]
                : images;
            const productId = String(p.id || '');
            const review = reviewMap.get(productId) || { rating: 0, rating_count: 0 };
            return {
                _id: p.id,
                name: p.name,
                price: Number(p?._discountedPrice ?? p.price ?? 0),
                created_at: p?.createdAt || null,
                images: normalizedImages,
                category: resolveProductDisplayCategory(p),
                categoryName: resolveProductDisplayCategory(p),
                categorySlug: String(p?.subCategory?.slug || p?.category?.slug || '').trim(),
                unit: p.unit,
                stock: Number(p.stock || 0),
                is_available: Boolean(p.isActive) && Number(p.stock || 0) > 0,
                discount_percentage: Number(p?._discountPercentage || 0),
                vendor_id: p?.vendor?.id || p.vendorId,
                vendor_name: p?.vendor?.shopName || null,
                description: p?.description || '',
                vendor_neighborhood: p?.vendor?.neighborhood || null,
                vendor_district: p?.vendor?.district || null,
                vendor_city: p?.vendor?.city || null,
                likes_count: review.rating_count,
                sold_count: Number(soldMap.get(productId) || 0),
                rating: review.rating,
                rating_count: review.rating_count,
                // Mahalle önceliklendirme bilgisi
                is_from_selected_neighborhood: p?._isFromSelectedNeighborhood ?? null,
                neighborhood_label: p?._neighborhoodLabel ?? null,
            };
        });
        res.status(200).json({
            success: true,
            data: {
                products,
                pagination: result.pagination,
                // Mahalle istatistikleri (eğer varsa)
                neighborhoodStats: result.neighborhoodStats || null,
            },
        });
    }
    catch (error) {
        if (isDatabaseRuntimeError(error)) {
            res.status(200).json({
                success: false,
                message: 'Catalog database is temporarily unavailable',
                reason: getErrorMessage(error),
                data: {
                    products: [],
                    pagination: {
                        total: 0,
                        page: 1,
                        limit: 20,
                        pages: 0,
                    },
                    neighborhoodStats: null,
                },
            });
            return;
        }
        next(error);
    }
};
exports.getProducts = getProducts;
const getBestSellerProducts = async (req, res, next) => {
    try {
        const vendorId = String(req.query.vendorId || '').trim();
        const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 12;
        if (!vendorId) {
            res.status(400).json({ success: false, message: 'vendorId is required' });
            return;
        }
        const list = await customerService.getBestSellerProductsForVendor({
            vendorId,
            limit,
        });
        const products = (list || []).map((p) => {
            const images = Array.isArray(p?.images)
                ? p.images.map((im) => im?.imageUrl).filter(Boolean)
                : [];
            const primaryImage = p?.imageUrl || images[0];
            const normalizedImages = primaryImage
                ? [primaryImage, ...images.filter((u) => u !== primaryImage)]
                : images;
            return {
                _id: p.id,
                name: p.name,
                price: Number(p?._discountedPrice ?? p.price ?? 0),
                images: normalizedImages,
                category: resolveProductDisplayCategory(p),
                categoryName: resolveProductDisplayCategory(p),
                categorySlug: String(p?.subCategory?.slug || p?.category?.slug || '').trim(),
                unit: p.unit,
                stock: Number(p.stock || 0),
                is_available: Boolean(p.isActive) && Number(p.stock || 0) > 0,
                discount_percentage: Number(p?._discountPercentage || 0),
                vendor_id: p?.vendor?.id || p.vendorId,
                vendor_name: p?.vendor?.shopName || 'Satıcı',
                vendor_delivery_coverage: p?.vendor?.deliveryCoverage || null,
                description: p?.description || '',
                vendor_neighborhood: p?.vendor?.neighborhood || null,
                vendor_district: p?.vendor?.district || null,
                vendor_city: p?.vendor?.city || null,
                likes_count: 0,
            };
        });
        res.status(200).json({
            success: true,
            data: {
                products,
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getBestSellerProducts = getBestSellerProducts;
const getProductById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const p = await customerService.getProductById(id);
        const reviews = await customerService.getProductReviews(id, 30).catch(() => []);
        const images = Array.isArray(p?.images)
            ? p.images.map((im) => im?.imageUrl).filter(Boolean)
            : [];
        const primaryImage = p?.imageUrl || images[0];
        const normalizedImages = primaryImage
            ? [primaryImage, ...images.filter((u) => u !== primaryImage)]
            : images;
        const mapped = {
            _id: p.id,
            name: p.name,
            price: Number(p?._discountedPrice ?? p.price ?? 0),
            images: normalizedImages,
            category: resolveProductDisplayCategory(p),
            categoryName: resolveProductDisplayCategory(p),
            categorySlug: String(p?.subCategory?.slug || p?.category?.slug || '').trim(),
            unit: p.unit,
            stock: Number(p.stock || 0),
            is_available: Boolean(p.isActive) && Number(p.stock || 0) > 0,
            discount_percentage: Number(p?._discountPercentage || 0),
            vendor_id: p?.vendor?.id || p.vendorId,
            vendor_delivery_coverage: p?.vendor?.deliveryCoverage || null,
            likes_count: 0,
            description: p.description || '',
            vendor_name: p?.vendor?.shopName || 'Satıcı',
            vendor_address: p?.vendor?.address || '',
            vendor_neighborhood: p?.vendor?.neighborhood || null,
            vendor_district: p?.vendor?.district || null,
            vendor_city: p?.vendor?.city || null,
            rating: (() => {
                if (!Array.isArray(reviews) || reviews.length === 0)
                    return 0;
                const rated = reviews
                    .map((r) => (typeof r?.rating === 'number' ? r.rating : null))
                    .filter((v) => typeof v === 'number' && Number.isFinite(v));
                if (rated.length === 0)
                    return 0;
                const avg = rated.reduce((sum, v) => sum + v, 0) / rated.length;
                return Math.round(avg * 10) / 10;
            })(),
            reviews: Array.isArray(reviews)
                ? reviews.map((r) => ({
                    id: r.id,
                    comment: r.comment,
                    rating: typeof r?.rating === 'number' ? r.rating : null,
                    vendorReply: r?.vendorReply ?? null,
                    createdAt: r.createdAt,
                    customer: r.customer ? { id: r.customer.id, name: r.customer.name } : null,
                }))
                : [],
        };
        res.status(200).json({ success: true, data: mapped });
    }
    catch (error) {
        next(error);
    }
};
exports.getProductById = getProductById;
const getProductReviews = async (req, res, next) => {
    try {
        const { id } = req.params;
        const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 30;
        const reviews = await customerService.getProductReviews(id, limit);
        res.status(200).json({
            success: true,
            data: reviews.map((r) => ({
                id: r.id,
                comment: r.comment,
                rating: typeof r?.rating === 'number' ? r.rating : null,
                vendorReply: r?.vendorReply ?? null,
                createdAt: r.createdAt,
                customer: r.customer ? { id: r.customer.id, name: r.customer.name } : null,
            })),
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getProductReviews = getProductReviews;
const addProductReview = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const { id } = req.params;
        const body = validationSchemas_1.CreateProductReviewSchema.parse(req.body);
        const review = await customerService.upsertProductReview({
            productId: id,
            customerId: req.user.userId,
            comment: body.comment,
            rating: body.rating,
        });
        res.status(201).json({
            success: true,
            data: {
                id: review.id,
                comment: review.comment,
                rating: typeof review?.rating === 'number' ? review.rating : null,
                vendorReply: review?.vendorReply ?? null,
                createdAt: review.createdAt,
                customer: review.customer ? { id: review.customer.id, name: review.customer.name } : null,
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.addProductReview = addProductReview;
const createOrderSellerRating = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const { id } = req.params;
        const body = validationSchemas_1.CreateSellerRatingSchema.parse(req.body);
        const created = await sellerRatingService.createSellerRating({
            orderId: id,
            customerId: req.user.userId,
            vendorId: body.vendorId,
            rating: body.rating,
            comment: body.comment,
        });
        res.status(201).json({
            success: true,
            data: created,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.createOrderSellerRating = createOrderSellerRating;
const updateOrderSellerRating = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const { id } = req.params;
        const body = validationSchemas_1.UpdateSellerRatingSchema.parse(req.body);
        const updated = await sellerRatingService.updateSellerRating({
            orderId: id,
            customerId: req.user.userId,
            vendorId: body.vendorId,
            rating: body.rating,
            comment: body.comment,
        });
        res.status(200).json({
            success: true,
            data: updated,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.updateOrderSellerRating = updateOrderSellerRating;
const getOrderSellerRating = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const { id } = req.params;
        const query = validationSchemas_1.GetOrderSellerRatingQuerySchema.parse(req.query);
        const result = await sellerRatingService.getOrderSellerRating({
            orderId: id,
            customerId: req.user.userId,
            vendorId: query.vendorId,
        });
        res.status(200).json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getOrderSellerRating = getOrderSellerRating;
const getVendorRatingsSummary = async (req, res, next) => {
    try {
        const { id } = req.params;
        const summary = await sellerRatingService.getSellerRatingSummary(id);
        res.status(200).json({ success: true, data: summary });
    }
    catch (error) {
        next(error);
    }
};
exports.getVendorRatingsSummary = getVendorRatingsSummary;
const getVendorRatings = async (req, res, next) => {
    try {
        const { id } = req.params;
        const query = validationSchemas_1.ListSellerRatingsQuerySchema.parse(req.query);
        const result = await sellerRatingService.getSellerRatings({
            vendorId: id,
            page: query.page,
            limit: query.limit,
        });
        res.status(200).json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getVendorRatings = getVendorRatings;
const getNeighborhoodLiveStats = async (req, res, next) => {
    try {
        const neighborhood = typeof req.query.neighborhood === 'string' ? req.query.neighborhood : undefined;
        const district = typeof req.query.district === 'string' ? req.query.district : undefined;
        const city = typeof req.query.city === 'string' ? req.query.city : undefined;
        const stats = await customerService.getNeighborhoodLiveStats({ neighborhood, district, city });
        res.status(200).json({ success: true, data: stats });
    }
    catch (error) {
        next(error);
    }
};
exports.getNeighborhoodLiveStats = getNeighborhoodLiveStats;
const computeVendorRatingsFromProductReviews = async (vendorIds) => {
    const ids = Array.from(new Set((vendorIds || []).map((x) => String(x || '').trim()).filter(Boolean)));
    if (ids.length === 0)
        return new Map();
    let rows = [];
    try {
        rows = await db_1.default.productReview.findMany({
            where: {
                rating: { not: null },
                product: { vendorId: { in: ids } },
            },
            select: {
                rating: true,
                product: { select: { vendorId: true } },
            },
        });
    }
    catch {
        // Rating enrichment is optional; return zeroed stats when reviews table is unavailable.
        rows = [];
    }
    const sums = new Map();
    for (const r of rows) {
        const vendorId = String(r?.product?.vendorId || '').trim();
        const rating = typeof r?.rating === 'number' ? r.rating : null;
        if (!vendorId || rating == null)
            continue;
        const prev = sums.get(vendorId) || { sum: 0, count: 0 };
        sums.set(vendorId, { sum: prev.sum + rating, count: prev.count + 1 });
    }
    const out = new Map();
    for (const id of ids) {
        const agg = sums.get(id);
        if (!agg || agg.count <= 0) {
            out.set(id, { rating: null, rating_count: 0 });
        }
        else {
            const avg = Math.round((agg.sum / agg.count) * 10) / 10;
            out.set(id, { rating: avg, rating_count: agg.count });
        }
    }
    return out;
};
// Vendor endpoints
const getVendors = async (req, res, next) => {
    try {
        const { city, district, neighborhood } = req.query;
        const whereClause = { status: 'APPROVED', user: { isActive: true } };
        const vendors = await db_1.default.vendorProfile.findMany({
            where: whereClause,
            select: {
                id: true,
                userId: true,
                createdAt: true,
                shopName: true,
                address: true,
                latitude: true,
                longitude: true,
                status: true,
                businessType: true,
                storeAbout: true,
                openingTime: true,
                closingTime: true,
                storeOpenOverride: true,
                storeCoverImageUrl: true,
                storeLogoImageUrl: true,
                preparationMinutes: true,
                deliveryMinutes: true,
                deliveryMaxMinutes: true,
                minimumOrderAmount: true,
                deliveryMode: true,
                deliveryCoverage: true,
                flatDeliveryFee: true,
                freeOverAmount: true,
                isActive: true,
                neighborhood: true,
                district: true,
                city: true,
                user: {
                    select: {
                        name: true,
                    },
                },
            },
        });
        const neighborhoodFilter = typeof neighborhood === 'string' ? (0, trNormalize_1.normalizeTrForCompare)(neighborhood) : '';
        const districtFilter = typeof district === 'string' ? (0, trNormalize_1.normalizeTrForCompare)(district) : '';
        const cityFilter = typeof city === 'string' ? (0, trNormalize_1.normalizeTrForCompare)(city) : '';
        const filteredVendors = vendors.filter((v) => {
            const vn = (0, trNormalize_1.normalizeTrForCompare)(v?.neighborhood);
            const vd = (0, trNormalize_1.normalizeTrForCompare)(v?.district);
            const vc = (0, trNormalize_1.normalizeTrForCompare)(v?.city);
            if (cityFilter && vc !== cityFilter)
                return false;
            if (districtFilter && vd !== districtFilter)
                return false;
            if (neighborhoodFilter && vn !== neighborhoodFilter)
                return false;
            return true;
        });
        const ratingMap = await computeVendorRatingsFromProductReviews(filteredVendors.map((v) => v.id));
        const campaignMap = await (0, sellerCampaignService_1.getActiveSellerCampaignMapForSellers)(filteredVendors.map((v) => String(v.id))).catch(() => new Map());
        const deliverySettingsMap = await (0, platformNeighborhoodDeliveryService_1.getPlatformNeighborhoodSettingsMap)(filteredVendors.map((v) => v.neighborhood)).catch(() => new Map());
        const campaignOnly = String(req.query?.campaignOnly || '').trim().toLowerCase() === 'true';
        const vendorCards = await Promise.all(filteredVendors
            .filter((v) => {
            if (!campaignOnly)
                return true;
            return campaignMap.has(String(v.id));
        })
            .map(async (v) => {
            const effectiveDelivery = await (0, platformNeighborhoodDeliveryService_1.resolveEffectiveVendorDeliverySettings)(v, deliverySettingsMap);
            const displayDeliveryMin = effectiveDelivery.deliveryTotalMinutes ?? effectiveDelivery.deliveryMinutes ?? null;
            const displayDeliveryMax = effectiveDelivery.deliveryMaxMinutes ?? null;
            const campaign = campaignMap.get(String(v.id));
            const campaignMinBasketAmount = campaign ? toMoney(campaign.minBasketAmount) : null;
            const campaignDiscountAmount = campaign ? toMoney(campaign.discountAmount) : null;
            const campaignShortLabel = campaign && campaignMinBasketAmount != null && campaignDiscountAmount != null
                ? (0, sellerCampaignService_1.formatCampaignShortLabel)(campaignMinBasketAmount, campaignDiscountAmount)
                : null;
            const isOpenNow = computeIsOpenNow(v.openingTime, v.closingTime, v.storeOpenOverride);
            return {
                ...(ratingMap.get(v.id) || { rating: null, rating_count: 0 }),
                _id: v.id,
                store_name: v.shopName || v.businessType || 'İşletme',
                address: v.address || 'Konum bilgisi yok',
                latitude: typeof v.latitude === 'number' ? v.latitude : 0,
                longitude: typeof v.longitude === 'number' ? v.longitude : 0,
                total_orders: 0,
                working_hours: v.openingTime && v.closingTime ? `${v.openingTime}-${v.closingTime}` : '09:00-21:00',
                is_open: isOpenNow,
                open_status: isOpenNow === false ? 'Kapalı' : 'Açık',
                store_image: v.storeLogoImageUrl || v.storeCoverImageUrl || undefined,
                logo_image: v.storeLogoImageUrl || undefined,
                cover_image: v.storeCoverImageUrl || undefined,
                store_about: v.storeAbout || undefined,
                business_type: normalizeBusinessType(v.businessType),
                category: normalizeBusinessType(v.businessType),
                seller_name: v?.user?.name || v.shopName || normalizeBusinessType(v.businessType),
                preparation_minutes: effectiveDelivery.preparationMinutes,
                pickup_minutes: effectiveDelivery.pickupMinutes,
                delivery_route_minutes: effectiveDelivery.deliveryMinutes,
                delivery_total_minutes: effectiveDelivery.deliveryTotalMinutes,
                delivery_minutes: displayDeliveryMin,
                delivery_max_minutes: displayDeliveryMax,
                delivery_time: formatDeliveryRangeText(displayDeliveryMin, displayDeliveryMax),
                minimum_order_amount: effectiveDelivery.minimumOrderAmount,
                delivery_fee: effectiveDelivery.flatDeliveryFee,
                free_over_amount: effectiveDelivery.freeOverAmount,
                delivery_mode: String(effectiveDelivery.deliveryMode || 'SELLER').toLowerCase(),
                registered_at: v.createdAt ? new Date(v.createdAt).toISOString() : null,
                tags: v.businessType ? [v.businessType] : [],
                neighborhood: v.neighborhood || null,
                district: v.district || null,
                city: v.city || null,
                campaign_id: campaign ? String(campaign.id) : null,
                campaign_min_basket_amount: campaignMinBasketAmount,
                campaign_discount_amount: campaignDiscountAmount,
                campaign_short_label: campaignShortLabel,
                campaign_start_date: campaign?.startDate ? new Date(campaign.startDate).toISOString() : null,
                campaign_end_date: campaign?.endDate ? new Date(campaign.endDate).toISOString() : null,
                campaign_usage_limit: campaign?.usageLimit == null ? null : Number(campaign.usageLimit),
                campaign_usage_count: campaign?.usageCount == null ? null : Number(campaign.usageCount),
            };
        }));
        res.status(200).json({
            success: true,
            data: vendorCards,
        });
    }
    catch (error) {
        if (isDatabaseRuntimeError(error)) {
            res.status(200).json({
                success: false,
                message: 'Vendor catalog database is temporarily unavailable',
                reason: getErrorMessage(error),
                data: [],
            });
            return;
        }
        next(error);
    }
};
exports.getVendors = getVendors;
const getVendorById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const vendor = await db_1.default.vendorProfile.findFirst({
            where: { id, status: 'APPROVED', user: { isActive: true } },
            include: {
                storeImages: { orderBy: { createdAt: 'desc' } },
                user: {
                    select: {
                        name: true,
                    },
                },
            },
        });
        if (!vendor) {
            res.status(404).json({ success: false, message: 'Vendor not found' });
            return;
        }
        const ratingMap = await computeVendorRatingsFromProductReviews([vendor.id]);
        const ratingInfo = ratingMap.get(vendor.id) || { rating: null, rating_count: 0 };
        const campaign = await (0, sellerCampaignService_1.getActiveSellerCampaignForSeller)(String(vendor.id));
        const deliverySettingsMap = await (0, platformNeighborhoodDeliveryService_1.getPlatformNeighborhoodSettingsMap)([vendor.neighborhood]);
        const effectiveDelivery = await (0, platformNeighborhoodDeliveryService_1.resolveEffectiveVendorDeliverySettings)(vendor, deliverySettingsMap);
        const displayDeliveryMin = effectiveDelivery.deliveryTotalMinutes ?? effectiveDelivery.deliveryMinutes ?? null;
        const displayDeliveryMax = effectiveDelivery.deliveryMaxMinutes ?? null;
        const campaignMinBasketAmount = campaign ? toMoney(campaign.minBasketAmount) : null;
        const campaignDiscountAmount = campaign ? toMoney(campaign.discountAmount) : null;
        const campaignShortLabel = campaign && campaignMinBasketAmount != null && campaignDiscountAmount != null
            ? (0, sellerCampaignService_1.formatCampaignShortLabel)(campaignMinBasketAmount, campaignDiscountAmount)
            : null;
        res.status(200).json({
            success: true,
            data: {
                is_open: computeIsOpenNow(vendor.openingTime, vendor.closingTime, vendor.storeOpenOverride),
                _id: vendor.id,
                store_name: vendor.shopName || vendor.businessType || 'İşletme',
                address: vendor.address || 'Konum bilgisi yok',
                latitude: typeof vendor.latitude === 'number' ? vendor.latitude : 0,
                longitude: typeof vendor.longitude === 'number' ? vendor.longitude : 0,
                ...ratingInfo,
                total_orders: 0,
                working_hours: vendor.openingTime && vendor.closingTime
                    ? `${vendor.openingTime}-${vendor.closingTime}`
                    : '09:00-21:00',
                store_image: vendor.storeLogoImageUrl || vendor.storeCoverImageUrl || undefined,
                logo_image: vendor.storeLogoImageUrl || undefined,
                cover_image: vendor.storeCoverImageUrl || undefined,
                store_images: Array.isArray(vendor.storeImages)
                    ? vendor.storeImages.map((x) => x.imageUrl)
                    : [],
                store_about: vendor.storeAbout || undefined,
                business_type: normalizeBusinessType(vendor.businessType),
                category: normalizeBusinessType(vendor.businessType),
                seller_name: vendor?.user?.name || vendor.shopName || normalizeBusinessType(vendor.businessType),
                preparation_minutes: effectiveDelivery.preparationMinutes,
                pickup_minutes: effectiveDelivery.pickupMinutes,
                delivery_route_minutes: effectiveDelivery.deliveryMinutes,
                delivery_total_minutes: effectiveDelivery.deliveryTotalMinutes,
                delivery_minutes: displayDeliveryMin,
                delivery_max_minutes: displayDeliveryMax,
                delivery_time: formatDeliveryRangeText(displayDeliveryMin, displayDeliveryMax),
                minimum_order_amount: effectiveDelivery.minimumOrderAmount,
                delivery_fee: effectiveDelivery.flatDeliveryFee,
                free_over_amount: effectiveDelivery.freeOverAmount,
                delivery_mode: String(effectiveDelivery.deliveryMode || 'SELLER').toLowerCase(),
                registered_at: vendor.createdAt ? new Date(vendor.createdAt).toISOString() : null,
                tags: vendor.businessType ? [vendor.businessType] : [],
                campaign_id: campaign ? String(campaign.id) : null,
                campaign_min_basket_amount: campaignMinBasketAmount,
                campaign_discount_amount: campaignDiscountAmount,
                campaign_short_label: campaignShortLabel,
                campaign_start_date: campaign?.startDate ? new Date(campaign.startDate).toISOString() : null,
                campaign_end_date: campaign?.endDate ? new Date(campaign.endDate).toISOString() : null,
                campaign_usage_limit: campaign?.usageLimit == null ? null : Number(campaign.usageLimit),
                campaign_usage_count: campaign?.usageCount == null ? null : Number(campaign.usageCount),
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getVendorById = getVendorById;
const mapCartForCustomerApp = (cart) => {
    const items = Array.isArray(cart?.items) ? cart.items : [];
    const mappedItems = items.map((item) => {
        const unitPrice = typeof item?.unitPrice === 'number'
            ? item.unitPrice
            : typeof item?.product?.price === 'number'
                ? item.product.price
                : 0;
        return {
            product_id: item.productId,
            quantity: Number(item.quantity || 0),
            price: Number(unitPrice || 0),
            vendor_id: String(item?.product?.vendorId || ''),
            vendor_name: String(item?.product?.vendor?.shopName || ''),
            vendor_neighborhood: String(item?.product?.vendor?.neighborhood || ''),
            vendor_district: String(item?.product?.vendor?.district || ''),
            vendor_city: String(item?.product?.vendor?.city || ''),
            product_name: String(item?.product?.name || ''),
            product_image: String(item?.product?.imageUrl || ''),
        };
    });
    const total = mappedItems.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0);
    return {
        _id: cart?.id,
        user_id: cart?.userId,
        items: mappedItems,
        total,
    };
};
// Cart endpoints
const getCart = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const cart = await orderService.getCart(req.user.userId);
        res.status(200).json({ success: true, data: mapCartForCustomerApp(cart) });
    }
    catch (error) {
        next(error);
    }
};
exports.getCart = getCart;
const addToCart = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const normalizedBody = req.body || {};
        if (normalizedBody.product_id && !normalizedBody.productId) {
            normalizedBody.productId = normalizedBody.product_id;
        }
        const data = validationSchemas_1.AddToCartSchema.parse(normalizedBody);
        await orderService.addToCart(req.user.userId, data.productId, data.quantity);
        const cart = await orderService.getCart(req.user.userId);
        res.status(201).json({ success: true, data: mapCartForCustomerApp(cart) });
    }
    catch (error) {
        next(error);
    }
};
exports.addToCart = addToCart;
const updateCartItem = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const normalizedBody = req.body || {};
        if (normalizedBody.product_id && !normalizedBody.productId) {
            normalizedBody.productId = normalizedBody.product_id;
        }
        const data = validationSchemas_1.UpdateCartItemSchema.parse(normalizedBody);
        await orderService.updateCartItem(req.user.userId, data.productId, data.quantity);
        const cart = await orderService.getCart(req.user.userId);
        res.status(200).json({ success: true, data: mapCartForCustomerApp(cart) });
    }
    catch (error) {
        next(error);
    }
};
exports.updateCartItem = updateCartItem;
const removeFromCart = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const productId = req.body?.productId || req.body?.product_id;
        if (!productId) {
            res.status(400).json({ success: false, message: 'productId is required' });
            return;
        }
        await orderService.removeFromCart(req.user.userId, productId);
        const cart = await orderService.getCart(req.user.userId);
        res.status(200).json({ success: true, data: mapCartForCustomerApp(cart) });
    }
    catch (error) {
        next(error);
    }
};
exports.removeFromCart = removeFromCart;
const clearCart = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const vendorId = String(req.body?.vendorId || req.body?.vendor_id || '').trim() || undefined;
        await orderService.clearCart(req.user.userId, vendorId);
        const cart = await orderService.getCart(req.user.userId);
        res.status(200).json({ success: true, data: mapCartForCustomerApp(cart) });
    }
    catch (error) {
        next(error);
    }
};
exports.clearCart = clearCart;
const getCartDeliveryEstimate = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const addressId = typeof req.query?.addressId === 'string' ? req.query.addressId.trim() : undefined;
        const vendorId = typeof req.query?.vendorId === 'string' ? req.query.vendorId.trim() : undefined;
        const orderType = typeof req.query?.orderType === 'string' ? req.query.orderType.trim() : undefined;
        const estimate = await orderService.estimateCartDelivery(req.user.userId, addressId, vendorId, orderType);
        res.status(200).json({ success: true, data: estimate });
    }
    catch (error) {
        next(error);
    }
};
exports.getCartDeliveryEstimate = getCartDeliveryEstimate;
// Order endpoints
const createOrder = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const rawBody = req.body || {};
        const normalizedBody = {
            ...rawBody,
            ...(rawBody?.vendor_id && !rawBody?.vendorId
                ? { vendorId: String(rawBody.vendor_id) }
                : {}),
        };
        const data = validationSchemas_1.CreateOrderSchema.parse(normalizedBody);
        const order = await orderService.createOrder(req.user.userId, data);
        // Create notifications for involved vendors
        try {
            const uniqueVendorProfileIds = Array.from(new Set(order.items
                .map((it) => String(it.vendorId || '').trim())
                .filter((id) => id.length > 0)));
            if (uniqueVendorProfileIds.length > 0) {
                const vendorProfiles = await db_1.default.vendorProfile.findMany({
                    where: { id: { in: uniqueVendorProfileIds } },
                    select: { id: true, userId: true, shopName: true },
                });
                const notifications = vendorProfiles
                    .map((vp) => ({
                    userId: vp.userId,
                    title: 'Yeni Sipariş',
                    message: `Yeni bir sipariş alındı. Sipariş No: ${order.id}`,
                    type: 'SYSTEM_MESSAGE',
                }))
                    .filter((n) => Boolean(n.userId));
                if (notifications.length > 0) {
                    await db_1.default.notification.createMany({ data: notifications });
                }
            }
        }
        catch (notifyError) {
            // Do not fail order creation if notifications fail
            console.error('Failed to create vendor notifications:', notifyError);
        }
        res.status(201).json({ success: true, data: order });
    }
    catch (error) {
        next(error);
    }
};
exports.createOrder = createOrder;
const getOrders = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const { page, limit } = req.query;
        const orders = await db_1.default.order.findMany({
            where: { customerId: req.user.userId },
            include: {
                items: {
                    include: {
                        product: { select: { id: true, name: true } },
                        vendor: { select: { id: true, shopName: true } },
                    },
                },
                shippingAddress: true,
            },
            orderBy: { createdAt: 'desc' },
            skip: page ? (parseInt(page) - 1) * (limit ? parseInt(limit) : 20) : 0,
            take: limit ? parseInt(limit) : 20,
        });
        res.status(200).json({ success: true, data: orders });
    }
    catch (error) {
        next(error);
    }
};
exports.getOrders = getOrders;
const getOrderById = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const { id } = req.params;
        const order = await db_1.default.order.findUnique({
            where: { id },
            include: {
                items: {
                    include: {
                        product: { select: { id: true, name: true, price: true } },
                        vendor: { select: { id: true, shopName: true } },
                    },
                },
                shippingAddress: true,
            },
        });
        if (!order || order.customerId !== req.user.userId) {
            res.status(404).json({ success: false, message: 'Order not found' });
            return;
        }
        res.status(200).json({ success: true, data: order });
    }
    catch (error) {
        next(error);
    }
};
exports.getOrderById = getOrderById;
