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
exports.cancelCustomerOrder = exports.getOrderById = exports.updateOrderStatus = exports.getVendorOrdersByUserId = exports.estimateCartDelivery = exports.getVendorOrders = exports.getCustomerOrders = exports.createOrder = exports.clearCart = exports.removeFromCart = exports.updateCartItem = exports.addToCart = exports.getCart = void 0;
const db_1 = __importDefault(require("../config/db"));
const errorHandler_1 = require("../middleware/errorHandler");
const settingsService = __importStar(require("./settingsService"));
const geoUtils_1 = require("../utils/geoUtils");
const neighborhoodPolygonService_1 = require("../data/neighborhoodPolygonService");
const trNormalize_1 = require("../utils/trNormalize");
const sellerCampaignService_1 = require("./sellerCampaignService");
const orderCode_1 = require("../utils/orderCode");
const platformNeighborhoodDeliveryService_1 = require("./platformNeighborhoodDeliveryService");
const mailHandler_1 = require("./mail/mailHandler");
const mailEvents_1 = require("./mail/mailEvents");
const MAX_DELIVERY_RADIUS_KM = 1;
const POLYGON_ANOMALY_DISTANCE_KM = 5;
const normalizeOrderType = (value) => {
    const raw = String(value || '').trim().toUpperCase();
    return raw === 'PICKUP' ? 'PICKUP' : 'DELIVERY';
};
const toMoney = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n))
        return 0;
    return Number(n.toFixed(2));
};
const safeJsonArray = (raw) => {
    try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return Array.isArray(parsed) ? parsed.map((x) => String(x)) : [];
    }
    catch {
        return [];
    }
};
const computeAppliedProductPricing = (params) => {
    const price = Number(params.price || 0);
    if (!Number.isFinite(price) || price <= 0) {
        return {
            originalUnitPrice: 0,
            unitPrice: 0,
            discountPerUnit: 0,
            discountType: null,
            discountLabel: null,
        };
    }
    let bestPrice = price;
    let appliedCampaign = null;
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
        let discounted = price;
        if (type === 'percentage')
            discounted = price * (1 - Math.max(0, Math.min(100, amount)) / 100);
        else if (type === 'fixed')
            discounted = Math.max(0, price - amount);
        else
            continue;
        if (discounted < bestPrice) {
            bestPrice = discounted;
            appliedCampaign = c;
        }
    }
    const unitPrice = Math.max(0, Number(bestPrice.toFixed(2)));
    const discountPerUnit = Math.max(0, Number((price - unitPrice).toFixed(2)));
    const rawDiscountType = String(appliedCampaign?.discountType || '').toLowerCase();
    return {
        originalUnitPrice: Number(price.toFixed(2)),
        unitPrice,
        discountPerUnit,
        discountType: discountPerUnit > 0
            ? rawDiscountType === 'percentage'
                ? 'PERCENTAGE'
                : rawDiscountType === 'fixed'
                    ? 'FIXED'
                    : null
            : null,
        discountLabel: discountPerUnit > 0
            ? 'Ürün İndirimi'
            : null,
    };
};
const computeDiscountedUnitPrice = (params) => {
    return computeAppliedProductPricing(params).unitPrice;
};
const getActiveCampaignsForVendor = async (vendorProfileId) => {
    const now = new Date();
    return db_1.default.campaign.findMany({
        where: {
            vendorProfileId,
            startDate: { lte: now },
            endDate: { gte: now },
            status: { in: ['active', 'pending'] },
        },
        select: {
            scope: true,
            discountType: true,
            discountAmount: true,
            selectedProducts: true,
        },
        orderBy: { discountAmount: 'desc' },
    });
};
const normalizeVendorDeliveryMode = (vendorProfile) => {
    const explicit = String(vendorProfile?.deliveryMode || '')
        .trim()
        .toUpperCase();
    if (explicit === 'PLATFORM')
        return 'PLATFORM';
    if (explicit === 'SELLER')
        return 'SELLER';
    const legacyCoverage = String(vendorProfile?.deliveryCoverage || 'SELF')
        .trim()
        .toUpperCase();
    return legacyCoverage === 'PLATFORM' ? 'PLATFORM' : 'SELLER';
};
const toCompatDeliveryCoverage = (deliveryMode) => {
    return deliveryMode === 'SELLER' ? 'SELF' : 'PLATFORM';
};
const normalizeNullableMoney = (value) => {
    if (value === null || value === undefined || value === '')
        return null;
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0)
        return null;
    return Number(num.toFixed(2));
};
const calculateStoreDeliveryFee = async (params) => {
    const sellerSubtotal = Number(params.sellerSubtotal || 0);
    const vendor = params.vendorProfile || {};
    if (vendor?.isActive === false) {
        throw new errorHandler_1.AppError(400, 'Store is not active');
    }
    const deliveryMode = normalizeVendorDeliveryMode(vendor);
    const effectiveDeliverySettings = deliveryMode === 'PLATFORM'
        ? await (0, platformNeighborhoodDeliveryService_1.requireReadyPlatformNeighborhoodSettings)(vendor)
        : await (0, platformNeighborhoodDeliveryService_1.resolveEffectiveVendorDeliverySettings)(vendor);
    const flatDeliveryFee = normalizeNullableMoney(effectiveDeliverySettings.flatDeliveryFee);
    const freeOverAmount = normalizeNullableMoney(effectiveDeliverySettings.freeOverAmount);
    const defaultStoreFee = Math.max(0, Number(params.defaultStoreFee || 0));
    if (deliveryMode === 'PLATFORM') {
        return {
            deliveryMode,
            deliveryFee: Number((flatDeliveryFee ?? 0).toFixed(2)),
            appliedRule: 'PLATFORM_NEIGHBORHOOD',
            flatDeliveryFee,
            freeOverAmount,
            defaultStoreFee: flatDeliveryFee ?? defaultStoreFee,
        };
    }
    if (freeOverAmount != null && sellerSubtotal >= freeOverAmount) {
        return {
            deliveryMode,
            deliveryFee: 0,
            appliedRule: 'FREE_OVER',
            flatDeliveryFee,
            freeOverAmount,
            defaultStoreFee,
        };
    }
    if (flatDeliveryFee != null) {
        return {
            deliveryMode,
            deliveryFee: flatDeliveryFee,
            appliedRule: 'FLAT',
            flatDeliveryFee,
            freeOverAmount,
            defaultStoreFee,
        };
    }
    return {
        deliveryMode,
        deliveryFee: Number(defaultStoreFee.toFixed(2)),
        appliedRule: 'DEFAULT',
        flatDeliveryFee,
        freeOverAmount,
        defaultStoreFee,
    };
};
const createOrderActionHistory = async (tx, input) => {
    if (!input.orderId)
        return;
    await tx.orderActionHistory.create({
        data: {
            orderId: input.orderId,
            actionType: input.actionType,
            actorRole: input.actorRole || null,
            actorId: input.actorId || null,
            note: input.note || null,
            metadata: input.metadata || undefined,
        },
    });
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
const isVendorOpenNow = (openingTime, closingTime) => {
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
const buildNextDayOpeningDeliverySlot = (openingTime) => {
    const openText = String(openingTime || '09:00').trim();
    const openMin = parseTimeToMinutes(openText) ?? 9 * 60;
    const hh = Math.floor(openMin / 60);
    const mm = openMin % 60;
    const timeText = `${`${hh}`.padStart(2, '0')}:${`${mm}`.padStart(2, '0')}`;
    const nextDay = new Date();
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(hh, mm, 0, 0);
    const dayText = nextDay.toLocaleDateString('tr-TR');
    return `Yarın (${dayText}) ${timeText}`;
};
const toFiniteCoord = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
};
const computeVendorAddressDistanceKm = (vendorProfile, address) => {
    const vendorLat = toFiniteCoord(vendorProfile?.latitude);
    const vendorLng = toFiniteCoord(vendorProfile?.longitude);
    const addressLat = toFiniteCoord(address?.latitude);
    const addressLng = toFiniteCoord(address?.longitude);
    if (vendorLat == null || vendorLng == null || addressLat == null || addressLng == null) {
        return null;
    }
    const distanceKm = (0, geoUtils_1.haversineKm)(vendorLat, vendorLng, addressLat, addressLng);
    return Number.isFinite(distanceKm) ? Number(distanceKm.toFixed(3)) : null;
};
const computeVendorNeighborhoodBoundaryDistanceKm = (vendorProfile, address) => {
    const vendorLat = toFiniteCoord(vendorProfile?.latitude);
    const vendorLng = toFiniteCoord(vendorProfile?.longitude);
    const addressLat = toFiniteCoord(address?.latitude);
    const addressLng = toFiniteCoord(address?.longitude);
    const directDistanceKm = computeVendorAddressDistanceKm(vendorProfile, address);
    if (addressLat == null || addressLng == null) {
        return null;
    }
    const vendorNeighborhoodKey = (0, trNormalize_1.normalizeTrForCompare)(String(vendorProfile?.neighborhood || ''));
    const addressNeighborhoodKey = (0, trNormalize_1.normalizeTrForCompare)(String(address?.neighborhood || ''));
    if (vendorNeighborhoodKey && addressNeighborhoodKey && vendorNeighborhoodKey === addressNeighborhoodKey) {
        return 0;
    }
    let containingBoundaryDistanceKm = null;
    if (vendorLat != null && vendorLng != null) {
        containingBoundaryDistanceKm = (0, neighborhoodPolygonService_1.getDistanceToBoundaryOfNeighborhoodContainingPointKm)({
            targetLat: addressLat,
            targetLng: addressLng,
            referenceLat: vendorLat,
            referenceLng: vendorLng,
        });
    }
    if (typeof containingBoundaryDistanceKm === 'number' && Number.isFinite(containingBoundaryDistanceKm)) {
        if (containingBoundaryDistanceKm > POLYGON_ANOMALY_DISTANCE_KM &&
            typeof directDistanceKm === 'number' &&
            Number.isFinite(directDistanceKm) &&
            directDistanceKm <= MAX_DELIVERY_RADIUS_KM) {
            return Number(directDistanceKm.toFixed(3));
        }
        return Number(containingBoundaryDistanceKm.toFixed(3));
    }
    let nearestBoundaryDistanceKm = null;
    if (vendorLat != null && vendorLng != null) {
        nearestBoundaryDistanceKm = (0, neighborhoodPolygonService_1.getDistanceToBoundaryOfNearestNeighborhoodToReferencePointKm)({
            targetLat: addressLat,
            targetLng: addressLng,
            referenceLat: vendorLat,
            referenceLng: vendorLng,
        });
    }
    if (typeof nearestBoundaryDistanceKm === 'number' && Number.isFinite(nearestBoundaryDistanceKm)) {
        if (nearestBoundaryDistanceKm > POLYGON_ANOMALY_DISTANCE_KM &&
            typeof directDistanceKm === 'number' &&
            Number.isFinite(directDistanceKm) &&
            directDistanceKm <= MAX_DELIVERY_RADIUS_KM) {
            return Number(directDistanceKm.toFixed(3));
        }
        return Number(nearestBoundaryDistanceKm.toFixed(3));
    }
    if (vendorLat != null && vendorLng != null) {
        const resolvedVendorPolygon = (0, neighborhoodPolygonService_1.findNeighborhoodByCoordinate)(vendorLat, vendorLng);
        if (!resolvedVendorPolygon) {
            return directDistanceKm;
        }
    }
    const neighborhoodName = String(vendorProfile?.neighborhood || '').trim();
    if (!neighborhoodName)
        return null;
    const namedBoundaryDistanceKm = vendorLat != null && vendorLng != null
        ? (0, neighborhoodPolygonService_1.getDistanceToNeighborhoodBoundaryUsingReferencePointKm)({
            targetLat: addressLat,
            targetLng: addressLng,
            referenceLat: vendorLat,
            referenceLng: vendorLng,
            neighborhood: neighborhoodName,
            district: vendorProfile?.district ?? null,
            city: vendorProfile?.city ?? null,
        })
        : (0, neighborhoodPolygonService_1.getDistanceToNeighborhoodBoundaryKm)({
            lat: addressLat,
            lng: addressLng,
            neighborhood: neighborhoodName,
            district: vendorProfile?.district ?? null,
            city: vendorProfile?.city ?? null,
        });
    if (typeof namedBoundaryDistanceKm === 'number' && Number.isFinite(namedBoundaryDistanceKm)) {
        if (namedBoundaryDistanceKm > POLYGON_ANOMALY_DISTANCE_KM &&
            typeof directDistanceKm === 'number' &&
            Number.isFinite(directDistanceKm) &&
            directDistanceKm <= MAX_DELIVERY_RADIUS_KM) {
            return Number(directDistanceKm.toFixed(3));
        }
        return Number(namedBoundaryDistanceKm.toFixed(3));
    }
    if (typeof directDistanceKm === 'number' && Number.isFinite(directDistanceKm)) {
        return Number(directDistanceKm.toFixed(3));
    }
    return null;
};
const computeDeliveryEligibilityDistanceKm = (vendorProfile, address) => {
    return computeVendorNeighborhoodBoundaryDistanceKm(vendorProfile, address);
};
const ensureWithinDeliveryRadius = (params) => {
    const { distanceKm } = params;
    if (distanceKm == null) {
        throw new errorHandler_1.AppError(400, 'Bu adres teslimat alanı dışında');
    }
    if (distanceKm > MAX_DELIVERY_RADIUS_KM) {
        throw new errorHandler_1.AppError(400, 'Bu adres teslimat alanı dışında');
    }
};
const getCart = async (userId) => {
    const cart = await db_1.default.cart.findUnique({
        where: { userId },
        include: {
            items: {
                include: {
                    product: {
                        include: {
                            vendor: {
                                select: { id: true, shopName: true, status: true, neighborhood: true, district: true, city: true },
                            },
                        },
                    },
                },
            },
        },
    });
    if (!cart) {
        // Be resilient for legacy users: ensure an empty cart exists.
        return await db_1.default.cart.create({
            data: { userId },
            include: {
                items: {
                    include: {
                        product: {
                            include: {
                                vendor: {
                                    select: { id: true, shopName: true, status: true, neighborhood: true, district: true, city: true },
                                },
                            },
                        },
                    },
                },
            },
        });
    }
    return cart;
};
exports.getCart = getCart;
const addToCart = async (userId, productId, quantity) => {
    const cart = await db_1.default.cart.findUnique({
        where: { userId },
    });
    const ensuredCart = cart ||
        (await db_1.default.cart.create({
            data: { userId },
        }));
    const product = await db_1.default.product.findUnique({
        where: { id: productId },
    });
    if (!product) {
        throw new errorHandler_1.AppError(404, 'Product not found');
    }
    if (!product.isActive) {
        throw new errorHandler_1.AppError(400, 'Product is not available');
    }
    if (product.stock < quantity) {
        throw new errorHandler_1.AppError(400, 'Not enough stock available');
    }
    // Apply active vendor campaigns to unitPrice so cart totals match what the customer sees.
    const campaigns = await getActiveCampaignsForVendor(product.vendorId);
    const unitPrice = computeDiscountedUnitPrice({
        price: product.price,
        campaigns: campaigns,
        productId: product.id,
    });
    const existingItem = await db_1.default.cartItem.findUnique({
        where: {
            cartId_productId: {
                cartId: ensuredCart.id,
                productId,
            },
        },
    });
    let cartItem;
    if (existingItem) {
        cartItem = await db_1.default.cartItem.update({
            where: {
                cartId_productId: {
                    cartId: ensuredCart.id,
                    productId,
                },
            },
            data: {
                quantity: existingItem.quantity + quantity,
                unitPrice,
            },
            include: {
                product: true,
            },
        });
    }
    else {
        cartItem = await db_1.default.cartItem.create({
            data: {
                cartId: ensuredCart.id,
                productId,
                quantity,
                unitPrice,
            },
            include: {
                product: true,
            },
        });
    }
    return cartItem;
};
exports.addToCart = addToCart;
const updateCartItem = async (userId, productId, quantity) => {
    const cart = await db_1.default.cart.findUnique({
        where: { userId },
    });
    const ensuredCart = cart ||
        (await db_1.default.cart.create({
            data: { userId },
        }));
    if (quantity <= 0) {
        await db_1.default.cartItem.deleteMany({
            where: {
                cartId: ensuredCart.id,
                productId,
            },
        });
        return { success: true };
    }
    const product = await db_1.default.product.findUnique({
        where: { id: productId },
    });
    if (!product || product.stock < quantity) {
        throw new errorHandler_1.AppError(400, 'Not enough stock available');
    }
    const campaigns = await getActiveCampaignsForVendor(product.vendorId);
    const unitPrice = computeDiscountedUnitPrice({
        price: product.price,
        campaigns: campaigns,
        productId: product.id,
    });
    const cartItem = await db_1.default.cartItem.update({
        where: {
            cartId_productId: {
                cartId: ensuredCart.id,
                productId,
            },
        },
        data: { quantity, unitPrice },
        include: {
            product: true,
        },
    });
    return cartItem;
};
exports.updateCartItem = updateCartItem;
const removeFromCart = async (userId, productId) => {
    const cart = await db_1.default.cart.findUnique({
        where: { userId },
    });
    const ensuredCart = cart ||
        (await db_1.default.cart.create({
            data: { userId },
        }));
    await db_1.default.cartItem.deleteMany({
        where: {
            cartId: ensuredCart.id,
            productId,
        },
    });
    return { success: true };
};
exports.removeFromCart = removeFromCart;
const clearCart = async (userId, vendorId) => {
    const cart = await db_1.default.cart.findUnique({
        where: { userId },
    });
    const ensuredCart = cart ||
        (await db_1.default.cart.create({
            data: { userId },
        }));
    const requestedVendorId = String(vendorId || '').trim() || null;
    await db_1.default.cartItem.deleteMany({
        where: {
            cartId: ensuredCart.id,
            ...(requestedVendorId ? { product: { vendorId: requestedVendorId } } : {}),
        },
    });
    return { success: true };
};
exports.clearCart = clearCart;
// Order functions
const createOrder = async (customerId, data) => {
    const loadCartWithItems = () => db_1.default.cart.findUnique({
        where: { userId: customerId },
        include: { items: { include: { product: { include: { vendor: true } } } } },
    });
    // Guard against short-lived race where add-to-cart commits slightly after checkout tap.
    let cart = await loadCartWithItems();
    if (!cart || cart.items.length === 0) {
        await new Promise((resolve) => setTimeout(resolve, 180));
        cart = await loadCartWithItems();
    }
    if (!cart || cart.items.length === 0) {
        throw new errorHandler_1.AppError(400, 'Cart is empty. Please add at least one product before checkout.');
    }
    const requestedVendorId = String(data?.vendorId || '').trim() || null;
    const itemsToOrder = requestedVendorId
        ? cart.items.filter((it) => String(it.product?.vendorId || '') === requestedVendorId)
        : cart.items;
    if (itemsToOrder.length === 0) {
        throw new errorHandler_1.AppError(400, requestedVendorId ? 'Cart is empty for this store' : 'Cart is empty');
    }
    // Calculate product total
    let productTotal = 0;
    const vendorIds = new Set();
    const orderItems = [];
    let vendorCampaigns = null;
    let vendorCampaignsVendorId = null;
    let appliedProductDiscountTotal = 0;
    const appliedProductDiscountTypes = new Set();
    const appliedProductDiscountLabels = new Set();
    for (const item of itemsToOrder) {
        if (item.product.stock < item.quantity) {
            throw new errorHandler_1.AppError(400, `Insufficient stock for ${item.product.name}`);
        }
        vendorIds.add(item.product.vendorId);
        if (!vendorCampaigns || vendorCampaignsVendorId !== item.product.vendorId) {
            vendorCampaignsVendorId = item.product.vendorId;
            vendorCampaigns = await getActiveCampaignsForVendor(item.product.vendorId);
        }
        const appliedPricing = computeAppliedProductPricing({
            price: item.product.price,
            campaigns: vendorCampaigns,
            productId: item.product.id,
        });
        const unitPrice = appliedPricing.unitPrice;
        const itemDiscountTotal = toMoney(appliedPricing.discountPerUnit * item.quantity);
        if (itemDiscountTotal > 0) {
            appliedProductDiscountTotal = toMoney(appliedProductDiscountTotal + itemDiscountTotal);
            if (appliedPricing.discountType) {
                appliedProductDiscountTypes.add(appliedPricing.discountType);
            }
            if (appliedPricing.discountLabel) {
                appliedProductDiscountLabels.add(appliedPricing.discountLabel);
            }
        }
        productTotal += unitPrice * item.quantity;
        orderItems.push({
            productId: item.productId,
            vendorId: item.product.vendorId,
            quantity: item.quantity,
            unitPrice,
            subtotal: unitPrice * item.quantity,
        });
    }
    const appliedProductDiscountType = appliedProductDiscountTotal > 0
        ? appliedProductDiscountTypes.size > 1
            ? 'MIXED'
            : Array.from(appliedProductDiscountTypes)[0] || null
        : null;
    const appliedProductDiscountLabel = appliedProductDiscountTotal > 0
        ? appliedProductDiscountLabels.size > 1
            ? 'Birden Fazla Ürün İndirimi'
            : Array.from(appliedProductDiscountLabels)[0] || 'Ürün İndirimi'
        : null;
    if (vendorIds.size !== 1) {
        throw new errorHandler_1.AppError(400, 'vendorId is required when cart contains multiple stores');
    }
    productTotal = toMoney(productTotal);
    // Enforce platform order limits (subtotal-based)
    const settings = await settingsService.getSettings();
    const commissionRateRaw = Number(settings?.commissionRate ?? 0);
    const commissionRate = Number.isFinite(commissionRateRaw)
        ? Math.min(Math.max(commissionRateRaw, 0), 100)
        : 0;
    const maxOrderAmount = Number(settings?.maxOrderAmount ?? 0);
    const currency = String(settings?.currency ?? 'TRY');
    const vendorProfile = itemsToOrder[0]?.product?.vendor;
    const deliveryMode = normalizeVendorDeliveryMode(vendorProfile);
    const effectiveDeliverySettings = await (0, platformNeighborhoodDeliveryService_1.resolveEffectiveVendorDeliverySettings)(vendorProfile);
    const normalizedOrderType = normalizeOrderType(data?.orderType);
    const isPickupOrder = normalizedOrderType === 'PICKUP';
    // Resolve and validate shipping address before any payment/order-rule checks.
    // This enforces the mandatory pre-payment distance checkpoint.
    let address = null;
    let deliveryDistanceKm = null;
    if (!isPickupOrder) {
        const requestedShippingAddressId = String(data?.shippingAddressId || '').trim();
        address = requestedShippingAddressId
            ? await db_1.default.customerAddress.findUnique({ where: { id: requestedShippingAddressId } })
            : await db_1.default.customerAddress.findFirst({
                where: { userId: customerId },
                orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
            });
        if (!address || address.userId !== customerId) {
            throw new errorHandler_1.AppError(400, 'Invalid shipping address');
        }
        deliveryDistanceKm = computeDeliveryEligibilityDistanceKm(vendorProfile, address);
        ensureWithinDeliveryRadius({
            distanceKm: deliveryDistanceKm,
            vendorProfile,
            address,
        });
    }
    if (deliveryMode === 'PLATFORM' &&
        Number.isFinite(Number(effectiveDeliverySettings.minimumOrderAmount ?? 0)) &&
        Number(effectiveDeliverySettings.minimumOrderAmount ?? 0) > 0 &&
        productTotal < Number(effectiveDeliverySettings.minimumOrderAmount ?? 0)) {
        throw new errorHandler_1.AppError(400, `Minimum order amount is ${Number(effectiveDeliverySettings.minimumOrderAmount ?? 0)} ${currency}`);
    }
    if (Number.isFinite(maxOrderAmount) && maxOrderAmount > 0 && productTotal > maxOrderAmount) {
        throw new errorHandler_1.AppError(400, `Maximum order amount is ${maxOrderAmount} ${currency}`);
    }
    const orderItemsWithFinancials = orderItems.map((item) => {
        const itemSubtotal = toMoney(item.subtotal);
        const itemCommissionAmount = toMoney(itemSubtotal * (commissionRate / 100));
        const itemVendorNetAmount = toMoney(itemSubtotal - itemCommissionAmount);
        return {
            ...item,
            commissionRateSnapshot: commissionRate,
            commissionAmount: itemCommissionAmount,
            vendorNetAmount: itemVendorNetAmount,
        };
    });
    // Enforce seller-specific minimum basket only when vendor covers delivery.
    const sellerMinimumBasket = Number(vendorProfile?.minimumOrderAmount ?? 0);
    if (deliveryMode === 'SELLER' &&
        Number.isFinite(sellerMinimumBasket) &&
        sellerMinimumBasket > 0 &&
        productTotal < sellerMinimumBasket) {
        throw new errorHandler_1.AppError(400, `Minimum basket amount for this store is ${sellerMinimumBasket} ${currency}`);
    }
    // Store-based delivery fee
    const defaultStoreFee = Number(settings?.defaultStoreFee ?? 0);
    const resolvedDeliveryResult = isPickupOrder
        ? {
            deliveryMode,
            deliveryFee: 0,
            appliedRule: 'PICKUP',
            flatDeliveryFee: null,
            freeOverAmount: null,
            defaultStoreFee,
        }
        : await calculateStoreDeliveryFee({
            sellerSubtotal: productTotal,
            vendorProfile,
            defaultStoreFee,
        });
    const deliveryFee = isPickupOrder ? 0 : toMoney(resolvedDeliveryResult.deliveryFee || 0);
    // Apply at most one active seller campaign over discounted product subtotal.
    // Campaign never discounts delivery.
    const sellerId = String(vendorProfile?.id || '');
    const activeSellerCampaign = sellerId
        ? await (0, sellerCampaignService_1.getActiveSellerCampaignForSeller)(sellerId)
        : null;
    const campaignThreshold = toMoney(activeSellerCampaign?.minBasketAmount || 0);
    const campaignEligible = Boolean(activeSellerCampaign) &&
        campaignThreshold > 0 &&
        productTotal >= campaignThreshold;
    const campaignDiscount = campaignEligible
        ? Math.min(productTotal, toMoney(activeSellerCampaign?.discountAmount || 0))
        : 0;
    const campaignLabel = campaignEligible
        ? (0, sellerCampaignService_1.formatCampaignShortLabel)(campaignThreshold, campaignDiscount)
        : null;
    const productTotalAfterCampaign = toMoney(productTotal - campaignDiscount);
    const deliveryBreakdown = [
        {
            seller_id: String(vendorProfile?.id || ''),
            seller_subtotal: Number(productTotal.toFixed(2)),
            campaign_discount: Number(campaignDiscount.toFixed(2)),
            seller_subtotal_after_campaign: Number(productTotalAfterCampaign.toFixed(2)),
            delivery_fee: Number(deliveryFee.toFixed(2)),
            delivery_mode: String(resolvedDeliveryResult.deliveryMode || 'SELLER').toLowerCase(),
            applied_rule: resolvedDeliveryResult.appliedRule,
            free_over_amount: resolvedDeliveryResult.freeOverAmount,
            flat_delivery_fee: resolvedDeliveryResult.flatDeliveryFee,
            default_store_fee: Number(resolvedDeliveryResult.defaultStoreFee || 0),
        },
    ];
    const totalPrice = toMoney(productTotalAfterCampaign + deliveryFee);
    let deliveryTimeSlot = typeof data?.deliveryTimeSlot === 'string' ? data.deliveryTimeSlot.trim() : undefined;
    const customerNote = typeof data?.note === 'string' ? data.note.trim().slice(0, 300) : '';
    const paymentMethod = data?.paymentMethod === 'test_card' ? 'TEST_CARD' : 'CASH_ON_DELIVERY';
    const vendorOpenNow = isVendorOpenNow(vendorProfile?.openingTime, vendorProfile?.closingTime);
    if (vendorOpenNow === false) {
        deliveryTimeSlot = buildNextDayOpeningDeliverySlot(vendorProfile?.openingTime);
    }
    const order = await db_1.default.$transaction(async (tx) => {
        const txAny = tx;
        let appliedCampaignId = null;
        let appliedCampaignDiscount = 0;
        let appliedCampaignLabel = null;
        if (campaignEligible && activeSellerCampaign?.id) {
            const now = new Date();
            const usageLimit = activeSellerCampaign.usageLimit == null ? null : Number(activeSellerCampaign.usageLimit);
            const reserveResult = await txAny.sellerCampaign.updateMany({
                where: {
                    id: activeSellerCampaign.id,
                    sellerId,
                    status: 'ACTIVE',
                    startDate: { lte: now },
                    endDate: { gte: now },
                    ...(usageLimit != null ? { usageCount: { lt: usageLimit } } : {}),
                },
                data: { usageCount: { increment: 1 } },
            });
            if (Number(reserveResult?.count || 0) === 1) {
                appliedCampaignId = String(activeSellerCampaign.id);
                appliedCampaignDiscount = campaignDiscount;
                appliedCampaignLabel = campaignLabel;
            }
        }
        const finalProductTotal = toMoney(productTotal - appliedCampaignDiscount);
        const finalTotalPrice = toMoney(finalProductTotal + deliveryFee);
        const finalBreakdown = [
            {
                ...deliveryBreakdown[0],
                campaign_discount: Number(appliedCampaignDiscount.toFixed(2)),
                seller_subtotal_after_campaign: Number(finalProductTotal.toFixed(2)),
            },
        ];
        const createdOrder = await txAny.order.create({
            data: {
                customerId,
                ...(address?.id ? { shippingAddressId: address.id } : {}),
                sellerCampaignId: appliedCampaignId,
                campaignDiscount: appliedCampaignDiscount,
                campaignLabel: appliedCampaignLabel,
                appliedProductDiscountTotal,
                appliedProductDiscountLabel,
                appliedProductDiscountType,
                totalPrice: finalTotalPrice,
                deliveryFee,
                deliveryTotal: deliveryFee,
                deliveryBreakdown: JSON.stringify(finalBreakdown),
                deliveryModeSnapshot: resolvedDeliveryResult.deliveryMode,
                deliveryFeeSnapshot: deliveryFee,
                deliveryDistanceKm,
                orderType: normalizedOrderType,
                ...(deliveryTimeSlot ? { deliveryTimeSlot } : {}),
                status: 'PENDING',
                paymentStatus: data?.paymentMethod === 'test_card' ? 'PAID' : 'PENDING',
                paymentMethod,
                items: {
                    create: orderItemsWithFinancials.map((oi) => ({
                        quantity: oi.quantity,
                        unitPrice: oi.unitPrice,
                        subtotal: oi.subtotal,
                        commissionRateSnapshot: oi.commissionRateSnapshot,
                        commissionAmount: oi.commissionAmount,
                        vendorNetAmount: oi.vendorNetAmount,
                        product: { connect: { id: oi.productId } },
                        vendor: { connect: { id: oi.vendorId } },
                    })),
                },
            },
            include: {
                items: {
                    include: {
                        product: true,
                        vendor: { select: { shopName: true, deliveryCoverage: true, deliveryMode: true } },
                    },
                },
            },
        });
        if (customerNote.length > 0) {
            await createOrderActionHistory(tx, {
                orderId: createdOrder.id,
                actionType: 'MESSAGE_SENT',
                actorRole: 'CUSTOMER',
                actorId: customerId,
                note: customerNote,
                metadata: {
                    source: 'customer_checkout_note',
                },
            });
        }
        for (const item of itemsToOrder) {
            // Atomic reservation/decrement to avoid race conditions on concurrent checkouts.
            const decremented = await tx.product.updateMany({
                where: {
                    id: item.productId,
                    stock: { gte: item.quantity },
                },
                data: { stock: { decrement: item.quantity } },
            });
            if (Number(decremented?.count || 0) !== 1) {
                throw new errorHandler_1.AppError(409, `Insufficient stock for ${item.product.name}`);
            }
            // Hide products from customer catalog when stock is depleted.
            await tx.product.updateMany({
                where: {
                    id: item.productId,
                    stock: { lte: 0 },
                    isActive: true,
                },
                data: {
                    isActive: false,
                },
            });
        }
        await tx.cartItem.deleteMany({
            where: {
                cartId: cart.id,
                productId: { in: itemsToOrder.map((it) => it.productId) },
            },
        });
        return createdOrder;
    });
    try {
        const vendorIdForOrder = String(orderItemsWithFinancials[0]?.vendorId || '').trim();
        if (vendorIdForOrder) {
            const vendorProfile = await db_1.default.vendorProfile.findUnique({
                where: { id: vendorIdForOrder },
                select: {
                    user: {
                        select: {
                            email: true,
                        },
                    },
                },
            });
            const vendorEmail = String(vendorProfile?.user?.email || '').trim();
            if (vendorEmail) {
                const mailItems = (Array.isArray(order?.items) ? order.items : []).map((item) => ({
                    name: String(item?.product?.name || 'Ürün').trim() || 'Ürün',
                    quantity: Number(item?.quantity || 0),
                    unit: String(item?.product?.unit || 'adet').trim() || 'adet',
                    unitPrice: Number(item?.unitPrice || 0),
                    subtotal: Number(item?.subtotal || 0),
                }));
                const productTotalForMail = mailItems.reduce((sum, item) => toMoney(sum + Number(item.subtotal || 0)), 0);
                await (0, mailHandler_1.handleMailEvent)(mailEvents_1.MailEvents.NEW_ORDER, {
                    email: vendorEmail,
                    orderId: String(order.orderCode || order.id || '').trim(),
                    items: mailItems,
                    productTotal: productTotalForMail,
                    deliveryFee: Number(order?.deliveryFee || 0),
                    totalPrice: Number(order?.totalPrice || 0),
                });
            }
        }
    }
    catch (error) {
        console.warn('[orderService] new order mail failed:', error);
    }
    return (0, orderCode_1.attachOrderCode)(order);
};
exports.createOrder = createOrder;
const getCustomerOrders = async (customerId) => {
    const orders = await db_1.default.order.findMany({
        where: { customerId },
        include: {
            shippingAddress: true,
            sellerRatings: {
                select: {
                    id: true,
                    orderId: true,
                    customerId: true,
                    vendorId: true,
                    rating: true,
                    comment: true,
                    createdAt: true,
                    updatedAt: true,
                },
            },
            items: {
                include: {
                    product: true,
                    vendor: { select: { shopName: true, deliveryCoverage: true } },
                },
            },
        },
        orderBy: { createdAt: 'desc' },
    });
    return (0, orderCode_1.attachOrderCodeList)(orders);
};
exports.getCustomerOrders = getCustomerOrders;
const getVendorOrders = async (vendorId) => {
    const orders = await db_1.default.order.findMany({
        where: {
            items: {
                some: { vendorId },
            },
        },
        include: {
            items: {
                where: { vendorId },
                include: {
                    product: true,
                },
            },
            customer: {
                select: { name: true, email: true },
            },
        },
        orderBy: { createdAt: 'desc' },
    });
    return (0, orderCode_1.attachOrderCodeList)(orders);
};
exports.getVendorOrders = getVendorOrders;
const estimateCartDelivery = async (customerId, addressId, vendorId, orderType) => {
    const cart = await db_1.default.cart.findUnique({
        where: { userId: customerId },
        include: { items: { include: { product: { include: { vendor: true } } } } },
    });
    if (!cart || cart.items.length === 0) {
        return { deliveryFee: 0, deliveryDistanceKm: null, deliveryCoverage: null };
    }
    const requestedVendorId = String(vendorId || '').trim() || null;
    const itemsToEstimate = requestedVendorId
        ? cart.items.filter((it) => String(it.product?.vendorId || '') === requestedVendorId)
        : cart.items;
    if (itemsToEstimate.length === 0) {
        return { deliveryFee: 0, deliveryDistanceKm: null, deliveryCoverage: null };
    }
    const vendorIds = new Set();
    for (const item of itemsToEstimate) {
        vendorIds.add(item.product.vendorId);
    }
    if (vendorIds.size !== 1) {
        throw new errorHandler_1.AppError(400, 'vendorId is required when cart contains multiple stores');
    }
    const normalizedOrderType = normalizeOrderType(orderType);
    const isPickupOrder = normalizedOrderType === 'PICKUP';
    let address = null;
    if (!isPickupOrder) {
        const requestedAddressId = String(addressId || '').trim();
        address = requestedAddressId
            ? await db_1.default.customerAddress.findUnique({ where: { id: requestedAddressId } })
            : await db_1.default.customerAddress.findFirst({
                where: { userId: customerId },
                orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
            });
        if (!address || address.userId !== customerId) {
            throw new errorHandler_1.AppError(400, 'Invalid shipping address');
        }
    }
    let sellerSubtotal = 0;
    let vendorCampaigns = null;
    let vendorCampaignsVendorId = null;
    for (const item of itemsToEstimate) {
        if (!vendorCampaigns || vendorCampaignsVendorId !== item.product.vendorId) {
            vendorCampaignsVendorId = item.product.vendorId;
            vendorCampaigns = await getActiveCampaignsForVendor(item.product.vendorId);
        }
        const unitPrice = computeDiscountedUnitPrice({
            price: item.product.price,
            campaigns: vendorCampaigns,
            productId: item.product.id,
        });
        sellerSubtotal += unitPrice * Number(item?.quantity || 0);
    }
    const vendorProfile = itemsToEstimate[0]?.product?.vendor;
    const deliveryDistanceKm = isPickupOrder
        ? null
        : computeDeliveryEligibilityDistanceKm(vendorProfile, address);
    const hasDistance = typeof deliveryDistanceKm === 'number' && Number.isFinite(deliveryDistanceKm);
    const outsideDeliveryArea = isPickupOrder
        ? false
        : hasDistance
            ? Number(deliveryDistanceKm) > MAX_DELIVERY_RADIUS_KM
            : true;
    const validationMessage = outsideDeliveryArea ? 'Bu adres teslimat alanı dışında' : null;
    const settings = await settingsService.getSettings();
    const defaultStoreFee = Number(settings?.defaultStoreFee ?? 0);
    const resolvedDeliveryResult = isPickupOrder
        ? {
            deliveryMode: normalizeVendorDeliveryMode(vendorProfile),
            deliveryFee: 0,
            appliedRule: 'PICKUP',
            flatDeliveryFee: null,
            freeOverAmount: null,
            defaultStoreFee,
        }
        : await calculateStoreDeliveryFee({
            sellerSubtotal,
            vendorProfile,
            defaultStoreFee,
        });
    const activeSellerCampaign = vendorProfile?.id
        ? await (0, sellerCampaignService_1.getActiveSellerCampaignForSeller)(String(vendorProfile.id))
        : null;
    const effectiveDeliverySettings = await (0, platformNeighborhoodDeliveryService_1.resolveEffectiveVendorDeliverySettings)(vendorProfile);
    const preparationMinutes = (0, platformNeighborhoodDeliveryService_1.resolveVendorPreparationMinutes)(vendorProfile);
    const routeDeliveryMinutes = isPickupOrder ? null : Number(effectiveDeliverySettings.deliveryMinutes ?? null);
    const estimatedMinutes = (0, platformNeighborhoodDeliveryService_1.composeCustomerEtaMinutes)({
        preparationMinutes,
        routeDeliveryMinutes,
        orderType: normalizedOrderType,
    });
    const campaignMinBasketAmount = toMoney(activeSellerCampaign?.minBasketAmount || 0);
    const campaignEligible = Boolean(activeSellerCampaign) &&
        campaignMinBasketAmount > 0 &&
        sellerSubtotal >= campaignMinBasketAmount;
    const campaignDiscount = campaignEligible
        ? Math.min(toMoney(sellerSubtotal), toMoney(activeSellerCampaign?.discountAmount || 0))
        : 0;
    const campaignRemainingToThreshold = Math.max(0, toMoney(campaignMinBasketAmount - sellerSubtotal));
    return {
        deliveryFee: isPickupOrder ? 0 : Number(resolvedDeliveryResult.deliveryFee || 0),
        deliveryDistanceKm,
        deliveryCoverage: toCompatDeliveryCoverage(resolvedDeliveryResult.deliveryMode),
        deliveryMode: String(resolvedDeliveryResult.deliveryMode || 'SELLER').toLowerCase(),
        preparationMinutes,
        routeDeliveryMinutes,
        estimatedMinutes,
        sellerSubtotal: Number(sellerSubtotal.toFixed(2)),
        campaignDiscount: Number(campaignDiscount.toFixed(2)),
        campaignLabel: campaignEligible
            ? (0, sellerCampaignService_1.formatCampaignShortLabel)(campaignMinBasketAmount, campaignDiscount)
            : activeSellerCampaign
                ? (0, sellerCampaignService_1.formatCampaignShortLabel)(campaignMinBasketAmount, toMoney(activeSellerCampaign.discountAmount || 0))
                : null,
        sellerCampaignId: activeSellerCampaign?.id ? String(activeSellerCampaign.id) : null,
        campaignMinBasketAmount: campaignMinBasketAmount > 0 ? campaignMinBasketAmount : null,
        campaignRemainingToThreshold: Number(campaignRemainingToThreshold.toFixed(2)),
        appliedRule: resolvedDeliveryResult.appliedRule,
        freeOverAmount: resolvedDeliveryResult.freeOverAmount,
        flatDeliveryFee: resolvedDeliveryResult.flatDeliveryFee,
        defaultStoreFee: Number(resolvedDeliveryResult.defaultStoreFee || 0),
        storeActive: vendorProfile?.isActive !== false,
        maxDeliveryRadiusKm: MAX_DELIVERY_RADIUS_KM,
        canCheckout: !outsideDeliveryArea,
        outsideDeliveryArea,
        validationMessage,
    };
};
exports.estimateCartDelivery = estimateCartDelivery;
const getVendorOrdersByUserId = async (userId) => {
    // Get vendor profile for user
    const user = await db_1.default.user.findUnique({
        where: { id: userId },
        include: { vendorProfile: true },
    });
    if (!user?.vendorProfile) {
        throw new errorHandler_1.AppError(403, 'Not a vendor');
    }
    return (0, exports.getVendorOrders)(user.vendorProfile.id);
};
exports.getVendorOrdersByUserId = getVendorOrdersByUserId;
const updateOrderStatus = async (orderId, userId, status) => {
    const user = await db_1.default.user.findUnique({
        where: { id: userId },
        include: { vendorProfile: true },
    });
    if (!user?.vendorProfile) {
        throw new errorHandler_1.AppError(403, 'Not a vendor');
    }
    const vendorId = user.vendorProfile.id;
    // Check if vendor owns at least one item in this order
    const order = await db_1.default.order.findFirst({
        where: {
            id: orderId,
            items: {
                some: { vendorId },
            },
        },
    });
    if (!order) {
        throw new errorHandler_1.AppError(404, 'Order not found or access denied');
    }
    const currentStatus = String(order.status || '').toUpperCase();
    const nextStatus = String(status || '').toUpperCase();
    const allowedTransitions = {
        PENDING: ['PREPARING', 'CANCELLED'],
        PREPARING: ['ON_THE_WAY', 'CANCELLED'],
        ON_THE_WAY: ['DELIVERED', 'CANCELLED'],
        DELIVERED: [],
        CANCELLED: [],
    };
    const allowed = allowedTransitions[currentStatus] || [];
    if (!allowed.includes(nextStatus)) {
        throw new errorHandler_1.AppError(400, `Invalid status transition: ${currentStatus} -> ${nextStatus}`);
    }
    const cancellationPatch = nextStatus === 'CANCELLED'
        ? {
            cancelReason: 'OTHER',
            cancelledAt: new Date(),
            cancelledBy: 'VENDOR',
            ...(String(order.paymentStatus || '') === 'PAID' ? { paymentStatus: 'REFUNDED' } : {}),
        }
        : {};
    const updated = await db_1.default.order.update({
        where: { id: orderId },
        data: {
            status: nextStatus,
            ...cancellationPatch,
        },
        include: {
            items: {
                include: {
                    product: true,
                    vendor: { select: { shopName: true, deliveryCoverage: true } },
                },
            },
        },
    });
    if (nextStatus === 'DELIVERED') {
        try {
            const customer = await db_1.default.user.findUnique({
                where: { id: order.customerId },
                select: { email: true, name: true },
            });
            const customerEmail = String(customer?.email || '').trim();
            if (customerEmail) {
                await (0, mailHandler_1.handleMailEvent)(mailEvents_1.MailEvents.ORDER_DELIVERED, {
                    email: customerEmail,
                    name: String(customer?.name || 'Müşteri').trim() || 'Müşteri',
                    orderId: String(updated.orderCode || orderId).trim(),
                });
            }
        }
        catch (error) {
            console.warn('[orderService] delivered mail failed:', error);
        }
    }
    return (0, orderCode_1.attachOrderCode)(updated);
};
exports.updateOrderStatus = updateOrderStatus;
const getOrderById = async (orderId, userId) => {
    const order = await db_1.default.order.findFirst({
        where: {
            id: orderId,
            OR: [
                { customerId: userId },
                {
                    items: {
                        some: { vendorId: userId },
                    },
                },
            ],
        },
        include: {
            shippingAddress: true,
            sellerRatings: {
                select: {
                    id: true,
                    orderId: true,
                    customerId: true,
                    vendorId: true,
                    rating: true,
                    comment: true,
                    createdAt: true,
                    updatedAt: true,
                },
            },
            items: {
                include: {
                    product: true,
                    vendor: { select: { shopName: true, deliveryCoverage: true } },
                },
            },
            customer: {
                select: { name: true, email: true },
            },
        },
    });
    if (!order) {
        throw new errorHandler_1.AppError(404, 'Order not found');
    }
    return (0, orderCode_1.attachOrderCode)(order);
};
exports.getOrderById = getOrderById;
const cancelCustomerOrder = async (customerId, orderId, data) => {
    const order = await db_1.default.order.findUnique({
        where: { id: orderId },
        include: {
            items: {
                include: {
                    product: true,
                    vendor: { select: { shopName: true, deliveryCoverage: true } },
                },
            },
            shippingAddress: true,
        },
    });
    if (!order || order.customerId !== customerId) {
        throw new errorHandler_1.AppError(404, 'Order not found');
    }
    if (order.status === 'CANCELLED') {
        throw new errorHandler_1.AppError(400, 'Order is already cancelled');
    }
    const allowed = order.status === 'PENDING' || order.status === 'PREPARING';
    if (!allowed) {
        throw new errorHandler_1.AppError(400, 'Order cannot be cancelled at this stage');
    }
    const reason = String(data.reason || '').trim();
    const otherDescription = String(data.otherDescription || '').trim();
    const now = new Date();
    const shouldRefund = order.paymentStatus === 'PAID';
    const updated = await db_1.default.$transaction(async (tx) => {
        const updatedOrder = await tx.order.update({
            where: { id: orderId },
            data: {
                status: 'CANCELLED',
                cancelReason: reason,
                cancelOtherDescription: reason === 'OTHER' ? otherDescription : null,
                cancelledAt: now,
                cancelledBy: 'CUSTOMER',
                ...(shouldRefund ? { paymentStatus: 'REFUNDED' } : {}),
            },
            include: {
                shippingAddress: true,
                items: {
                    include: {
                        product: true,
                        vendor: { select: { shopName: true, deliveryCoverage: true } },
                    },
                },
            },
        });
        for (const item of updatedOrder.items) {
            await tx.product.update({
                where: { id: item.productId },
                data: { stock: { increment: item.quantity } },
            });
            // If cancelled order restores stock, reactivate only previously approved products.
            await tx.product.updateMany({
                where: {
                    id: item.productId,
                    stock: { gt: 0 },
                    approvalStatus: 'APPROVED',
                },
                data: { isActive: true },
            });
        }
        await createOrderActionHistory(tx, {
            orderId,
            actionType: 'ORDER_CANCELLED',
            actorRole: 'CUSTOMER',
            actorId: customerId,
            note: reason === 'OTHER' ? otherDescription : reason,
            metadata: {
                reason,
                otherDescription: reason === 'OTHER' ? otherDescription : null,
                refunded: shouldRefund,
            },
        });
        return updatedOrder;
    });
    return (0, orderCode_1.attachOrderCode)(updated);
};
exports.cancelCustomerOrder = cancelCustomerOrder;
