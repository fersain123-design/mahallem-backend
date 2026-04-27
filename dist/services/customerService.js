"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNeighborhoodLiveStats = exports.upsertProductReview = exports.getProductReviews = exports.getProductById = exports.getBestSellerProductsForVendor = exports.getProducts = exports.getCategories = exports.setDefaultAddress = exports.deleteCustomerAddress = exports.updateCustomerAddress = exports.addCustomerAddress = exports.getCustomerAddressById = exports.getCustomerAddresses = exports.updateCustomerProfile = exports.getCustomerProfile = void 0;
const db_1 = __importDefault(require("../config/db"));
const errorHandler_1 = require("../middleware/errorHandler");
const trNormalize_1 = require("../utils/trNormalize");
const geoUtils_1 = require("../utils/geoUtils");
const MAX_DELIVERY_RADIUS_KM = 1;
const getCustomerProfile = async (userId) => {
    const user = await db_1.default.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            createdAt: true,
            updatedAt: true,
        },
    });
    if (!user) {
        throw new errorHandler_1.AppError(404, 'Customer not found');
    }
    return user;
};
exports.getCustomerProfile = getCustomerProfile;
const updateCustomerProfile = async (userId, data) => {
    const user = await db_1.default.user.update({
        where: { id: userId },
        data: {
            ...(data.name && { name: data.name }),
            ...(data.phone && { phone: data.phone }),
        },
        select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            updatedAt: true,
        },
    });
    return user;
};
exports.updateCustomerProfile = updateCustomerProfile;
const getCustomerAddresses = async (userId) => {
    const addresses = await db_1.default.customerAddress.findMany({
        where: { userId, isActive: true },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return addresses;
};
exports.getCustomerAddresses = getCustomerAddresses;
const getCustomerAddressById = async (addressId, userId) => {
    const address = await db_1.default.customerAddress.findUnique({
        where: { id: addressId },
    });
    if (!address || address.userId !== userId) {
        throw new errorHandler_1.AppError(404, 'Address not found');
    }
    return address;
};
exports.getCustomerAddressById = getCustomerAddressById;
const addCustomerAddress = async (userId, data) => {
    const address = await db_1.default.customerAddress.create({
        data: {
            userId,
            ...data,
        },
    });
    return address;
};
exports.addCustomerAddress = addCustomerAddress;
const updateCustomerAddress = async (addressId, userId, data) => {
    const address = await db_1.default.customerAddress.findUnique({
        where: { id: addressId },
    });
    if (!address || address.userId !== userId) {
        throw new errorHandler_1.AppError(404, 'Address not found');
    }
    const updated = await db_1.default.customerAddress.update({
        where: { id: addressId },
        data,
    });
    return updated;
};
exports.updateCustomerAddress = updateCustomerAddress;
const deleteCustomerAddress = async (addressId, userId) => {
    const address = await db_1.default.customerAddress.findUnique({
        where: { id: addressId },
    });
    if (!address || address.userId !== userId) {
        throw new errorHandler_1.AppError(404, 'Address not found');
    }
    // If an address is referenced by any orders, soft-delete instead of hard-delete
    // to preserve order history integrity (foreign key constraint).
    const usedInOrders = await db_1.default.order.count({
        where: { customerId: userId, shippingAddressId: addressId },
    });
    if (usedInOrders > 0) {
        // Soft-delete: mark inactive, keep for order references
        await db_1.default.customerAddress.update({
            where: { id: addressId },
            data: {
                isActive: false,
                deactivatedAt: new Date(),
                deactivationReason: 'Kullanıcı tarafından silindi (siparişlerde kullanılmış)',
            },
        });
    }
    else {
        // No orders reference this address, safe to hard-delete
        await db_1.default.customerAddress.delete({
            where: { id: addressId },
        });
    }
    // If the deleted address was default, try to set another one as default.
    if (address.isDefault) {
        const next = await db_1.default.customerAddress.findFirst({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            select: { id: true },
        });
        if (next?.id) {
            await db_1.default.customerAddress.update({
                where: { id: next.id },
                data: { isDefault: true },
            });
        }
    }
    return { success: true };
};
exports.deleteCustomerAddress = deleteCustomerAddress;
const setDefaultAddress = async (addressId, userId) => {
    const address = await db_1.default.customerAddress.findUnique({
        where: { id: addressId },
    });
    if (!address || address.userId !== userId) {
        throw new errorHandler_1.AppError(404, 'Address not found');
    }
    // Remove default from all other addresses
    await db_1.default.customerAddress.updateMany({
        where: { userId },
        data: { isDefault: false },
    });
    // Set this address as default
    const updated = await db_1.default.customerAddress.update({
        where: { id: addressId },
        data: { isDefault: true },
    });
    return updated;
};
exports.setDefaultAddress = setDefaultAddress;
const getCategories = async () => {
    const subCategories = await db_1.default.subCategory.findMany({
        where: {
            isActive: true,
            category: {
                isActive: true,
                OR: [{ vendorId: { not: null } }, { slug: 'ozel-urunler' }],
            },
            products: {
                some: {
                    isActive: true,
                    vendor: { status: 'APPROVED', user: { isActive: true } },
                },
            },
        },
        orderBy: { name: 'asc' },
        select: {
            id: true,
            slug: true,
            name: true,
            categoryId: true,
            category: {
                select: {
                    id: true,
                    slug: true,
                    name: true,
                    icon: true,
                    image: true,
                },
            },
        },
    });
    return subCategories;
};
exports.getCategories = getCategories;
const buildPublicProductWhere = () => ({
    isActive: true,
    vendor: { status: 'APPROVED', user: { isActive: true } },
    OR: [{ subCategoryId: null }, { subCategory: { isActive: true, category: { isActive: true } } }],
});
const safeJsonArray = (raw) => {
    try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return Array.isArray(parsed) ? parsed.map((x) => String(x)) : [];
    }
    catch {
        return [];
    }
};
const computeDiscountForProduct = (params) => {
    const price = Number(params.price || 0);
    if (!Number.isFinite(price) || price <= 0) {
        return { discountPercentage: 0, discountedPrice: price };
    }
    let bestPct = 0;
    let bestPrice = price;
    for (const c of params.campaigns) {
        const scope = String(c.scope || '').toLowerCase();
        if (scope === 'selected') {
            const selected = safeJsonArray(c.selectedProducts);
            if (!selected.includes(params.productId))
                continue;
        }
        const type = String(c.discountType || '').toLowerCase();
        const amount = Number(c.discountAmount || 0);
        if (!Number.isFinite(amount) || amount <= 0)
            continue;
        let pct = 0;
        let discounted = price;
        if (type === 'percentage') {
            pct = Math.max(0, Math.min(100, amount));
            discounted = price * (1 - pct / 100);
        }
        else if (type === 'fixed') {
            discounted = Math.max(0, price - amount);
            pct = price > 0 ? (amount / price) * 100 : 0;
        }
        else {
            continue;
        }
        if (discounted < bestPrice - 1e-6 ||
            (Math.abs(discounted - bestPrice) < 1e-6 && pct > bestPct)) {
            bestPrice = discounted;
            bestPct = pct;
        }
    }
    const roundedPct = Math.max(0, Math.min(100, Math.round(bestPct)));
    return {
        discountPercentage: roundedPct,
        discountedPrice: Math.max(0, Number(bestPrice.toFixed(2))),
    };
};
const attachActiveCampaignDiscounts = async (products) => {
    if (!Array.isArray(products) || products.length === 0)
        return products;
    const vendorIds = Array.from(new Set(products.map((p) => p?.vendor?.id || p?.vendorId).filter(Boolean).map(String)));
    if (vendorIds.length === 0)
        return products;
    const now = new Date();
    let campaigns = [];
    try {
        campaigns = await db_1.default.campaign.findMany({
            where: {
                vendorProfileId: { in: vendorIds },
                startDate: { lte: now },
                endDate: { gte: now },
                status: { in: ['active', 'pending'] },
            },
            select: {
                vendorProfileId: true,
                scope: true,
                discountType: true,
                discountAmount: true,
                selectedProducts: true,
            },
            orderBy: { discountAmount: 'desc' },
        });
    }
    catch (error) {
        // Campaign enrichment is optional for customer catalog; do not break product listing.
        console.warn('[customerService] campaign enrichment skipped:', String(error?.message || error));
        campaigns = [];
    }
    const campaignsByVendor = new Map();
    for (const c of campaigns) {
        const k = String(c.vendorProfileId);
        const prev = campaignsByVendor.get(k);
        if (prev)
            prev.push(c);
        else
            campaignsByVendor.set(k, [c]);
    }
    return products.map((p) => {
        const vendorId = String(p?.vendor?.id || p?.vendorId || '');
        const list = (campaignsByVendor.get(vendorId) || []);
        const { discountPercentage, discountedPrice } = computeDiscountForProduct({
            price: Number(p.price || 0),
            campaigns: list,
            productId: String(p.id),
        });
        return {
            ...p,
            _discountPercentage: discountPercentage,
            _discountedPrice: discountedPrice,
        };
    });
};
const getProducts = async (options) => {
    const { categoryId, vendorId, search, sort = 'newest', page = 1, limit = 20, neighborhood, district, city, latitude, longitude, expandToNeighbors = false, discountOnly = false, specialOnly = false, } = options;
    const skip = (page - 1) * limit;
    const baseWhere = {
        ...buildPublicProductWhere(),
    };
    if (categoryId) {
        const normalizedCategoryId = String(categoryId).trim();
        const resolvedSubCategory = await db_1.default.subCategory.findFirst({
            where: {
                isActive: true,
                category: { isActive: true },
                OR: [{ id: normalizedCategoryId }, { slug: normalizedCategoryId }],
            },
            select: { id: true, slug: true, categoryId: true },
        });
        if (resolvedSubCategory) {
            baseWhere.subCategoryId = resolvedSubCategory.id;
        }
        else {
            const resolvedCategory = await db_1.default.category.findFirst({
                where: {
                    OR: [{ id: normalizedCategoryId }, { slug: normalizedCategoryId }],
                },
                select: { id: true, slug: true },
            });
            if (resolvedCategory) {
                baseWhere.categoryId = resolvedCategory.id;
            }
            else {
                baseWhere.category = { slug: normalizedCategoryId };
            }
        }
    }
    if (vendorId) {
        baseWhere.vendorId = vendorId;
    }
    if (search) {
        baseWhere.OR = [
            { name: { contains: search } },
            { description: { contains: search } },
        ];
    }
    if (specialOnly) {
        baseWhere.category = { slug: 'ozel-urunler' };
    }
    let orderBy = { createdAt: 'desc' };
    if (sort === 'price-asc') {
        orderBy = { price: 'asc' };
    }
    else if (sort === 'price-desc') {
        orderBy = { price: 'desc' };
    }
    const hasCenter = Number.isFinite(latitude) && Number.isFinite(longitude);
    if (neighborhood || hasCenter) {
        const normalizedNeighborhood = neighborhood ? (0, trNormalize_1.normalizeTrForCompare)(neighborhood) : '';
        const normalizedDistrict = district ? (0, trNormalize_1.normalizeTrForCompare)(district) : '';
        const normalizedCity = city ? (0, trNormalize_1.normalizeTrForCompare)(city) : '';
        const allProductsResult = await db_1.default.product.findMany({
            where: baseWhere,
            include: {
                vendor: {
                    select: {
                        id: true,
                        shopName: true,
                        status: true,
                        neighborhood: true,
                        district: true,
                        city: true,
                        latitude: true,
                        longitude: true,
                    },
                },
                category: { select: { id: true, name: true } },
                subCategory: { select: { id: true, name: true, slug: true } },
                images: { orderBy: { sortOrder: 'asc' } },
            },
            orderBy,
        });
        const withinRadiusProducts = [];
        const sameNeighborhoodProducts = [];
        const neighborProducts = [];
        for (const product of allProductsResult) {
            const vendorLat = Number(product.vendor?.latitude);
            const vendorLng = Number(product.vendor?.longitude);
            if (hasCenter) {
                if (!Number.isFinite(vendorLat) || !Number.isFinite(vendorLng)) {
                    continue;
                }
                const distanceKm = (0, geoUtils_1.haversineKm)(Number(latitude), Number(longitude), vendorLat, vendorLng);
                if (!Number.isFinite(distanceKm) || distanceKm > MAX_DELIVERY_RADIUS_KM) {
                    continue;
                }
            }
            withinRadiusProducts.push(product);
            const vendorNeighborhood = (0, trNormalize_1.normalizeTrForCompare)(product.vendor?.neighborhood);
            const vendorDistrict = (0, trNormalize_1.normalizeTrForCompare)(product.vendor?.district);
            const vendorCity = (0, trNormalize_1.normalizeTrForCompare)(product.vendor?.city);
            const neighborhoodMatch = normalizedNeighborhood &&
                vendorNeighborhood &&
                vendorNeighborhood === normalizedNeighborhood;
            const districtMatch = normalizedDistrict ? vendorDistrict === normalizedDistrict : true;
            const cityMatch = normalizedCity ? vendorCity === normalizedCity : true;
            if (neighborhoodMatch && districtMatch && cityMatch) {
                sameNeighborhoodProducts.push(product);
            }
            else {
                neighborProducts.push(product);
            }
        }
        const neighborhoodLabel = [neighborhood, district, city]
            .map((x) => String(x || '').trim())
            .filter(Boolean)
            .join(', ');
        const taggedSameNeighborhood = sameNeighborhoodProducts.map((p) => ({
            ...p,
            _isFromSelectedNeighborhood: true,
            _neighborhoodLabel: neighborhoodLabel || neighborhood || p.vendor?.neighborhood || 'Mahalle',
        }));
        const taggedNeighbors = neighborProducts.map((p) => ({
            ...p,
            _isFromSelectedNeighborhood: false,
            _neighborhoodLabel: p.vendor?.neighborhood || 'Komşu Mahalle',
        }));
        let selectedProducts = [];
        if (neighborhood) {
            if (taggedSameNeighborhood.length > 0) {
                selectedProducts = taggedSameNeighborhood;
            }
            else if (expandToNeighbors) {
                selectedProducts = taggedNeighbors;
            }
            else {
                selectedProducts = [];
            }
        }
        else {
            selectedProducts = withinRadiusProducts.map((p) => ({
                ...p,
                _isFromSelectedNeighborhood: null,
                _neighborhoodLabel: p.vendor?.neighborhood || 'Mahalle',
            }));
        }
        let allProducts = await attachActiveCampaignDiscounts(selectedProducts);
        if (discountOnly) {
            allProducts = allProducts
                .filter((p) => Number(p?._discountPercentage || 0) > 0)
                .sort((a, b) => {
                const pct = Number(b?._discountPercentage || 0) - Number(a?._discountPercentage || 0);
                if (pct !== 0)
                    return pct;
                const bOld = Number(b?.price || 0);
                const aOld = Number(a?.price || 0);
                const bNew = Number(b?._discountedPrice || b?.price || 0);
                const aNew = Number(a?._discountedPrice || a?.price || 0);
                const bAbs = bOld - bNew;
                const aAbs = aOld - aNew;
                if (bAbs !== aAbs)
                    return bAbs - aAbs;
                return new Date(String(b?.createdAt || 0)).getTime() - new Date(String(a?.createdAt || 0)).getTime();
            });
        }
        const total = allProducts.length;
        const paginatedProducts = allProducts.slice(skip, skip + limit);
        return {
            products: paginatedProducts,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            },
            neighborhoodStats: {
                selectedNeighborhood: neighborhood || null,
                maxDeliveryRadiusKm: MAX_DELIVERY_RADIUS_KM,
                hasCenter,
                fromSelectedNeighborhood: sameNeighborhoodProducts.length,
                fromNeighborNeighborhoods: neighborProducts.length,
                canExpandToNeighbors: Boolean(neighborhood) && sameNeighborhoodProducts.length === 0 && neighborProducts.length > 0,
                expandedToNeighbors: Boolean(neighborhood) && sameNeighborhoodProducts.length === 0 && Boolean(expandToNeighbors),
            },
        };
    }
    // Mahalle belirtilmemişse normal sorgulama
    const [products, total] = await Promise.all([
        db_1.default.product.findMany({
            where: baseWhere,
            include: {
                vendor: {
                    select: { id: true, shopName: true, status: true, neighborhood: true, district: true, city: true },
                },
                category: { select: { id: true, name: true } },
                subCategory: { select: { id: true, name: true, slug: true } },
                images: { orderBy: { sortOrder: 'asc' } },
            },
            orderBy,
            skip: discountOnly ? 0 : skip,
            take: discountOnly ? 5000 : limit,
        }),
        db_1.default.product.count({ where: baseWhere }),
    ]);
    let enriched = await attachActiveCampaignDiscounts(products);
    // `discountOnly` requires post-filter + pagination on the server side.
    if (discountOnly) {
        enriched = enriched
            .filter((p) => Number(p?._discountPercentage || 0) > 0)
            .sort((a, b) => {
            const pct = Number(b?._discountPercentage || 0) - Number(a?._discountPercentage || 0);
            if (pct !== 0)
                return pct;
            const bOld = Number(b?.price || 0);
            const aOld = Number(a?.price || 0);
            const bNew = Number(b?._discountedPrice || b?.price || 0);
            const aNew = Number(a?._discountedPrice || a?.price || 0);
            const bAbs = bOld - bNew;
            const aAbs = aOld - aNew;
            if (bAbs !== aAbs)
                return bAbs - aAbs;
            return new Date(String(b?.createdAt || 0)).getTime() - new Date(String(a?.createdAt || 0)).getTime();
        });
        const totalDiscounted = enriched.length;
        const paginated = enriched.slice(skip, skip + limit);
        return {
            products: paginated,
            pagination: {
                total: totalDiscounted,
                page,
                limit,
                pages: Math.ceil(totalDiscounted / limit),
            },
        };
    }
    return {
        products: enriched,
        pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
        },
    };
};
exports.getProducts = getProducts;
const getBestSellerProductsForVendor = async (params) => {
    const vendorId = String(params.vendorId || '').trim();
    const limit = Math.max(1, Math.min(40, Number(params.limit || 12) || 12));
    if (!vendorId) {
        throw new errorHandler_1.AppError(400, 'vendorId is required');
    }
    // Count only delivered orders to represent actual best-sellers.
    const grouped = await db_1.default.orderItem.groupBy({
        by: ['productId'],
        where: {
            vendorId,
            order: { status: 'DELIVERED' },
        },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: limit,
    });
    const productIds = Array.isArray(grouped)
        ? grouped.map((g) => String(g.productId)).filter(Boolean)
        : [];
    if (productIds.length === 0) {
        // Fallback: if there are no delivered orders yet, return newest vendor products.
        const newest = await db_1.default.product.findMany({
            where: {
                vendorId,
                ...buildPublicProductWhere(),
            },
            include: {
                vendor: {
                    select: { id: true, shopName: true, status: true, neighborhood: true, district: true, city: true },
                },
                category: { select: { id: true, name: true } },
                subCategory: { select: { id: true, name: true, slug: true } },
                images: { orderBy: { sortOrder: 'asc' } },
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
        return await attachActiveCampaignDiscounts(newest);
    }
    const products = await db_1.default.product.findMany({
        where: {
            id: { in: productIds },
            ...buildPublicProductWhere(),
        },
        include: {
            vendor: {
                select: { id: true, shopName: true, status: true, neighborhood: true, district: true, city: true },
            },
            category: { select: { id: true, name: true } },
            subCategory: { select: { id: true, name: true, slug: true } },
            images: { orderBy: { sortOrder: 'asc' } },
        },
    });
    const enriched = await attachActiveCampaignDiscounts(products);
    const byId = new Map(enriched.map((p) => [String(p.id), p]));
    // Keep the ranking order from groupBy
    return productIds.map((id) => byId.get(String(id))).filter(Boolean);
};
exports.getBestSellerProductsForVendor = getBestSellerProductsForVendor;
const getProductById = async (productId) => {
    const product = await db_1.default.product.findFirst({
        where: {
            id: productId,
            ...buildPublicProductWhere(),
        },
        include: {
            vendor: {
                select: {
                    id: true,
                    shopName: true,
                    address: true,
                    deliveryCoverage: true,
                    status: true,
                },
            },
            category: { select: { id: true, name: true } },
            subCategory: { select: { id: true, name: true, slug: true } },
            images: { orderBy: { sortOrder: 'asc' } },
        },
    });
    if (!product) {
        throw new errorHandler_1.AppError(404, 'Product not found');
    }
    const enriched = await attachActiveCampaignDiscounts([product]);
    return enriched[0] || product;
};
exports.getProductById = getProductById;
const getProductReviews = async (productId, limit = 30) => {
    const product = await db_1.default.product.findFirst({
        where: {
            id: productId,
            ...buildPublicProductWhere(),
        },
        select: { id: true },
    });
    if (!product) {
        throw new errorHandler_1.AppError(404, 'Product not found');
    }
    const reviews = await db_1.default.productReview.findMany({
        where: { productId },
        include: {
            customer: {
                select: { id: true, name: true },
            },
        },
        orderBy: { createdAt: 'desc' },
        take: Math.max(1, Math.min(100, Number(limit) || 30)),
    });
    return reviews;
};
exports.getProductReviews = getProductReviews;
const upsertProductReview = async (params) => {
    const { productId, customerId, comment, rating } = params;
    const product = await db_1.default.product.findUnique({
        where: { id: productId },
        select: {
            id: true,
            isActive: true,
            vendor: {
                select: {
                    status: true,
                    user: { select: { isActive: true } },
                },
            },
        },
    });
    if (!product ||
        !product.isActive ||
        product.vendor?.status !== 'APPROVED' ||
        !product.vendor?.user?.isActive) {
        throw new errorHandler_1.AppError(404, 'Product not found');
    }
    const existing = await db_1.default.productReview.findFirst({
        where: { productId, customerId },
        select: { id: true },
    });
    if (existing) {
        return db_1.default.productReview.update({
            where: { id: existing.id },
            data: { comment, ...(typeof rating === 'number' ? { rating } : {}) },
            include: { customer: { select: { id: true, name: true } } },
        });
    }
    return db_1.default.productReview.create({
        data: { productId, customerId, comment, ...(typeof rating === 'number' ? { rating } : {}) },
        include: { customer: { select: { id: true, name: true } } },
    });
};
exports.upsertProductReview = upsertProductReview;
const getNeighborhoodLiveStats = async (neighborhood) => {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const input = neighborhood && typeof neighborhood === 'object'
        ? neighborhood
        : { neighborhood };
    const neighborhoodTrimmed = typeof input.neighborhood === 'string' ? input.neighborhood.trim() : '';
    const districtTrimmed = typeof input.district === 'string' ? input.district.trim() : '';
    const cityTrimmed = typeof input.city === 'string' ? input.city.trim() : '';
    const shippingAddress = {};
    if (neighborhoodTrimmed) {
        // Use contains so "Gazi Paşa" can match stored "Gazi Paşa Mahallesi".
        // Prisma SQLite does not support `mode: 'insensitive'` in string filters.
        shippingAddress.neighborhood = { contains: neighborhoodTrimmed };
    }
    if (districtTrimmed) {
        // Prisma SQLite does not support `mode: 'insensitive'` in string filters.
        shippingAddress.district = { equals: districtTrimmed };
    }
    if (cityTrimmed) {
        // Prisma SQLite does not support `mode: 'insensitive'` in string filters.
        shippingAddress.city = { equals: cityTrimmed };
    }
    const neighborhoodFilter = Object.keys(shippingAddress).length
        ? { shippingAddress }
        : {};
    const ordersToday = await db_1.default.order.count({
        where: {
            createdAt: { gte: start, lt: end },
            ...neighborhoodFilter,
        },
    });
    const preparingVendors = await db_1.default.orderItem.findMany({
        where: {
            order: {
                status: 'PREPARING',
                createdAt: { gte: start, lt: end },
                ...neighborhoodFilter,
            },
        },
        distinct: ['vendorId'],
        select: { vendorId: true },
    });
    return {
        neighborhood: neighborhoodTrimmed || null,
        ordersToday,
        vendorsPreparing: preparingVendors.length,
        generatedAt: now.toISOString(),
    };
};
exports.getNeighborhoodLiveStats = getNeighborhoodLiveStats;
