"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateAdminCampaignStatus = exports.getAdminCampaigns = exports.deleteVendorCampaign = exports.updateVendorCampaign = exports.createVendorCampaign = exports.getVendorCampaigns = exports.getActiveSellerCampaignMapForSellers = exports.getActiveSellerCampaignForSeller = exports.expireEndedSellerCampaigns = exports.validateCampaignInput = exports.formatCampaignShortLabel = exports.CAMPAIGN_RULES = void 0;
const db_1 = __importDefault(require("../config/db"));
const errorHandler_1 = require("../middleware/errorHandler");
const trNormalize_1 = require("../utils/trNormalize");
exports.CAMPAIGN_RULES = {
    minBasketAmountMin: 200,
    discountAmountMin: 20,
    maxDiscountRatio: 0.4,
    minDurationHours: 24,
    maxDurationDays: 30,
};
const CAMPAIGN_NOTIFICATION_BATCH_SIZE = 250;
const toMoney = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n))
        return 0;
    return Number(n.toFixed(2));
};
const toIso = (value) => {
    const d = value instanceof Date ? value : new Date(String(value || ''));
    return Number.isFinite(d.getTime()) ? d.toISOString() : '';
};
const normalizeStatus = (value) => {
    const normalized = String(value || '').trim().toUpperCase();
    if (normalized === 'ACTIVE')
        return 'ACTIVE';
    if (normalized === 'REJECTED')
        return 'REJECTED';
    if (normalized === 'EXPIRED')
        return 'EXPIRED';
    if (normalized === 'PASSIVE')
        return 'PASSIVE';
    return 'PENDING';
};
const formatNotificationMoney = (value) => {
    const amount = toMoney(value);
    return Number.isInteger(amount) ? `${amount.toFixed(0)} TL` : `${amount.toFixed(2)} TL`;
};
const TURKISH_THIN_VOWELS = new Set(['e', 'i', 'ö', 'ü']);
const TURKISH_HARD_CONSONANTS = new Set(['f', 's', 't', 'k', 'ç', 'ş', 'h', 'p']);
const toCampaignLocative = (shopName) => {
    const normalizedShopName = String(shopName || '').trim();
    if (!normalizedShopName)
        return 'Mahalle Esnafında';
    const lowered = normalizedShopName.toLocaleLowerCase('tr-TR');
    const letters = Array.from(lowered).filter((ch) => /[a-zçğıöşü]/i.test(ch));
    if (letters.length === 0) {
        return `${normalizedShopName}da`;
    }
    const lastLetter = letters[letters.length - 1];
    const lastVowel = [...letters].reverse().find((ch) => 'aeıioöuü'.includes(ch));
    const useThinVowel = lastVowel ? TURKISH_THIN_VOWELS.has(lastVowel) : false;
    const useHardConsonant = TURKISH_HARD_CONSONANTS.has(lastLetter);
    const suffix = `${useHardConsonant ? 't' : 'd'}${useThinVowel ? 'e' : 'a'}`;
    return `${normalizedShopName}${suffix}`;
};
const buildCampaignApprovalNotificationTitle = (shopName, discountAmount) => {
    return `${toCampaignLocative(shopName)} Sepette ${formatNotificationMoney(discountAmount)} indirim`;
};
const buildCampaignApprovalNotificationMessage = (shopName, discountAmount) => {
    return `Mahallendeki ${shopName} yeni kampanya başlattı, sepette ${formatNotificationMoney(discountAmount)} indirim fırsatını kaçırma.`;
};
const getCustomerNotificationAudienceForCampaign = async (tx, sellerId) => {
    const seller = await tx.vendorProfile.findUnique({
        where: { id: sellerId },
        select: {
            shopName: true,
            city: true,
            district: true,
            neighborhood: true,
        },
    });
    const shopName = String(seller?.shopName || 'Mahalle Esnafi').trim() || 'Mahalle Esnafi';
    const targetCity = (0, trNormalize_1.normalizeTrForCompare)(seller?.city);
    const targetDistrict = (0, trNormalize_1.normalizeTrForCompare)(seller?.district);
    const targetNeighborhood = (0, trNormalize_1.normalizeTrForCompare)(seller?.neighborhood);
    if (!targetNeighborhood) {
        return { shopName, userIds: [] };
    }
    const addresses = await tx.customerAddress.findMany({
        where: {
            isActive: true,
            isDefault: true,
        },
        select: {
            userId: true,
            city: true,
            district: true,
            neighborhood: true,
        },
    });
    const userIds = [];
    const seenUserIds = new Set();
    for (const address of addresses) {
        const userId = String(address?.userId || '').trim();
        if (!userId || seenUserIds.has(userId))
            continue;
        if ((0, trNormalize_1.normalizeTrForCompare)(address?.neighborhood) !== targetNeighborhood)
            continue;
        if (targetDistrict && (0, trNormalize_1.normalizeTrForCompare)(address?.district) !== targetDistrict)
            continue;
        if (targetCity && (0, trNormalize_1.normalizeTrForCompare)(address?.city) !== targetCity)
            continue;
        seenUserIds.add(userId);
        userIds.push(userId);
    }
    return { shopName, userIds };
};
const createCampaignApprovalNotifications = async (tx, params) => {
    const { shopName, userIds } = await getCustomerNotificationAudienceForCampaign(tx, params.sellerId);
    if (userIds.length > 0) {
        const title = buildCampaignApprovalNotificationTitle(shopName, params.discountAmount);
        const message = buildCampaignApprovalNotificationMessage(shopName, params.discountAmount);
        for (let index = 0; index < userIds.length; index += CAMPAIGN_NOTIFICATION_BATCH_SIZE) {
            const batch = userIds.slice(index, index + CAMPAIGN_NOTIFICATION_BATCH_SIZE);
            await tx.notification.createMany({
                data: batch.map((userId) => ({
                    userId,
                    title,
                    message,
                    type: 'CAMPAIGN_APPROVED',
                })),
            });
        }
    }
    await tx.sellerCampaign.update({
        where: { id: params.campaignId },
        data: { customerNotifiedAt: new Date() },
    });
};
const formatCampaignShortLabel = (minBasketAmount, discountAmount) => {
    return `${toMoney(discountAmount)} TL Sepette`;
};
exports.formatCampaignShortLabel = formatCampaignShortLabel;
const toSummary = (campaign) => ({
    id: String(campaign.id),
    sellerId: String(campaign.sellerId),
    minBasketAmount: toMoney(campaign.minBasketAmount),
    discountAmount: toMoney(campaign.discountAmount),
    startDate: toIso(campaign.startDate),
    endDate: toIso(campaign.endDate),
    usageLimit: campaign.usageLimit == null ? null : Number(campaign.usageLimit),
    usageCount: Number(campaign.usageCount || 0),
    status: normalizeStatus(campaign.status),
    rejectReason: campaign.rejectReason ? String(campaign.rejectReason) : null,
    createdAt: toIso(campaign.createdAt),
    updatedAt: toIso(campaign.updatedAt),
});
const validateCampaignInput = (input) => {
    const minBasketAmount = toMoney(input.minBasketAmount);
    const discountAmount = toMoney(input.discountAmount);
    const usageLimit = input.usageLimit == null ? null : Number(input.usageLimit);
    const startDate = new Date(input.startDate);
    const endDate = new Date(input.endDate);
    if (!Number.isFinite(minBasketAmount) || minBasketAmount < exports.CAMPAIGN_RULES.minBasketAmountMin) {
        throw new errorHandler_1.AppError(400, `Campaign minimum basket must be at least ${exports.CAMPAIGN_RULES.minBasketAmountMin} TL`);
    }
    if (!Number.isFinite(discountAmount) || discountAmount < exports.CAMPAIGN_RULES.discountAmountMin) {
        throw new errorHandler_1.AppError(400, `Campaign discount must be at least ${exports.CAMPAIGN_RULES.discountAmountMin} TL`);
    }
    if (discountAmount / minBasketAmount > exports.CAMPAIGN_RULES.maxDiscountRatio) {
        throw new errorHandler_1.AppError(400, 'Campaign discount ratio cannot exceed 40% of campaign minimum basket');
    }
    if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) {
        throw new errorHandler_1.AppError(400, 'Invalid campaign start or end date');
    }
    const durationMs = endDate.getTime() - startDate.getTime();
    if (durationMs < exports.CAMPAIGN_RULES.minDurationHours * 60 * 60 * 1000) {
        throw new errorHandler_1.AppError(400, 'Campaign duration must be at least 24 hours');
    }
    if (durationMs > exports.CAMPAIGN_RULES.maxDurationDays * 24 * 60 * 60 * 1000) {
        throw new errorHandler_1.AppError(400, 'Campaign duration cannot exceed 30 days');
    }
    if (usageLimit != null && (!Number.isInteger(usageLimit) || usageLimit <= 0)) {
        throw new errorHandler_1.AppError(400, 'Usage limit must be a positive integer');
    }
    return {
        minBasketAmount,
        discountAmount,
        startDate,
        endDate,
        usageLimit,
    };
};
exports.validateCampaignInput = validateCampaignInput;
const expireEndedSellerCampaigns = async () => {
    const now = new Date();
    await db_1.default.sellerCampaign.updateMany({
        where: {
            status: 'ACTIVE',
            endDate: { lt: now },
        },
        data: { status: 'EXPIRED' },
    });
};
exports.expireEndedSellerCampaigns = expireEndedSellerCampaigns;
const getActiveSellerCampaignForSeller = async (sellerId) => {
    await (0, exports.expireEndedSellerCampaigns)();
    const now = new Date();
    const campaign = await db_1.default.sellerCampaign.findFirst({
        where: {
            sellerId,
            status: 'ACTIVE',
            startDate: { lte: now },
            endDate: { gte: now },
        },
        orderBy: [{ createdAt: 'desc' }],
    });
    if (!campaign)
        return null;
    if (campaign.usageLimit != null && Number(campaign.usageCount || 0) >= Number(campaign.usageLimit)) {
        await db_1.default.sellerCampaign.update({
            where: { id: campaign.id },
            data: { status: 'EXPIRED' },
        });
        return null;
    }
    return campaign;
};
exports.getActiveSellerCampaignForSeller = getActiveSellerCampaignForSeller;
const getActiveSellerCampaignMapForSellers = async (sellerIds) => {
    await (0, exports.expireEndedSellerCampaigns)();
    const uniqueSellerIds = Array.from(new Set((sellerIds || []).map((id) => String(id || '').trim()).filter(Boolean)));
    if (uniqueSellerIds.length === 0)
        return new Map();
    const now = new Date();
    const campaigns = await db_1.default.sellerCampaign.findMany({
        where: {
            sellerId: { in: uniqueSellerIds },
            status: 'ACTIVE',
            startDate: { lte: now },
            endDate: { gte: now },
        },
        orderBy: [{ updatedAt: 'desc' }],
    });
    const map = new Map();
    for (const campaign of campaigns) {
        const sellerId = String(campaign.sellerId || '');
        if (!sellerId || map.has(sellerId))
            continue;
        if (campaign.usageLimit != null && Number(campaign.usageCount || 0) >= Number(campaign.usageLimit)) {
            await db_1.default.sellerCampaign.update({
                where: { id: campaign.id },
                data: { status: 'EXPIRED' },
            });
            continue;
        }
        map.set(sellerId, campaign);
    }
    return map;
};
exports.getActiveSellerCampaignMapForSellers = getActiveSellerCampaignMapForSellers;
const getVendorCampaigns = async (userId) => {
    const vendor = await db_1.default.vendorProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!vendor)
        throw new errorHandler_1.AppError(404, 'Vendor profile not found');
    await (0, exports.expireEndedSellerCampaigns)();
    const campaigns = await db_1.default.sellerCampaign.findMany({
        where: { sellerId: vendor.id },
        orderBy: [{ createdAt: 'desc' }],
    });
    return campaigns.map(toSummary);
};
exports.getVendorCampaigns = getVendorCampaigns;
const createVendorCampaign = async (userId, input) => {
    const vendor = await db_1.default.vendorProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!vendor)
        throw new errorHandler_1.AppError(404, 'Vendor profile not found');
    const payload = (0, exports.validateCampaignInput)(input);
    const created = await db_1.default.$transaction(async (tx) => {
        await tx.sellerCampaign.updateMany({
            where: { sellerId: vendor.id, status: 'ACTIVE' },
            data: { status: 'PASSIVE' },
        });
        return tx.sellerCampaign.create({
            data: {
                sellerId: vendor.id,
                minBasketAmount: payload.minBasketAmount,
                discountAmount: payload.discountAmount,
                startDate: payload.startDate,
                endDate: payload.endDate,
                usageLimit: payload.usageLimit,
                status: 'PENDING',
            },
        });
    });
    return toSummary(created);
};
exports.createVendorCampaign = createVendorCampaign;
const updateVendorCampaign = async (userId, campaignId, input) => {
    const vendor = await db_1.default.vendorProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!vendor)
        throw new errorHandler_1.AppError(404, 'Vendor profile not found');
    const existing = await db_1.default.sellerCampaign.findUnique({ where: { id: campaignId } });
    if (!existing || String(existing.sellerId) !== String(vendor.id)) {
        throw new errorHandler_1.AppError(404, 'Campaign not found');
    }
    if (normalizeStatus(existing.status) === 'ACTIVE') {
        throw new errorHandler_1.AppError(400, 'Active campaign cannot be edited directly. Make it passive first.');
    }
    const payload = (0, exports.validateCampaignInput)(input);
    const updated = await db_1.default.sellerCampaign.update({
        where: { id: campaignId },
        data: {
            minBasketAmount: payload.minBasketAmount,
            discountAmount: payload.discountAmount,
            startDate: payload.startDate,
            endDate: payload.endDate,
            usageLimit: payload.usageLimit,
            status: 'PENDING',
            rejectReason: null,
        },
    });
    return toSummary(updated);
};
exports.updateVendorCampaign = updateVendorCampaign;
const deleteVendorCampaign = async (userId, campaignId) => {
    const vendor = await db_1.default.vendorProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!vendor)
        throw new errorHandler_1.AppError(404, 'Vendor profile not found');
    const existing = await db_1.default.sellerCampaign.findUnique({ where: { id: campaignId } });
    if (!existing || String(existing.sellerId) !== String(vendor.id)) {
        throw new errorHandler_1.AppError(404, 'Campaign not found');
    }
    if (normalizeStatus(existing.status) === 'ACTIVE') {
        throw new errorHandler_1.AppError(400, 'Active campaign cannot be deleted. Make it passive first.');
    }
    await db_1.default.sellerCampaign.delete({ where: { id: campaignId } });
};
exports.deleteVendorCampaign = deleteVendorCampaign;
const getAdminCampaigns = async (params) => {
    await (0, exports.expireEndedSellerCampaigns)();
    const where = {};
    const status = String(params.status || '').trim().toUpperCase();
    if (status)
        where.status = status;
    if (Number.isFinite(params.endingInDays) && Number(params.endingInDays) > 0) {
        const now = new Date();
        const endLimit = new Date(now.getTime() + Number(params.endingInDays) * 24 * 60 * 60 * 1000);
        where.endDate = { gte: now, lte: endLimit };
    }
    const campaigns = await db_1.default.sellerCampaign.findMany({
        where,
        include: {
            seller: {
                select: {
                    id: true,
                    shopName: true,
                    storeLogoImageUrl: true,
                },
            },
        },
        orderBy: [{ createdAt: 'desc' }],
    });
    const ids = campaigns.map((c) => String(c.id));
    const orderAgg = ids.length
        ? await db_1.default.order.groupBy({
            by: ['sellerCampaignId'],
            where: { sellerCampaignId: { in: ids } },
            _count: { _all: true },
            _sum: { campaignDiscount: true },
        })
        : [];
    const perfByCampaign = new Map();
    for (const row of orderAgg) {
        const campaignId = String(row.sellerCampaignId || '').trim();
        if (!campaignId)
            continue;
        perfByCampaign.set(campaignId, {
            orderCount: Number(row?._count?._all || 0),
            totalDiscount: toMoney(row?._sum?.campaignDiscount || 0),
        });
    }
    return campaigns.map((campaign) => {
        const perf = perfByCampaign.get(String(campaign.id)) || { orderCount: 0, totalDiscount: 0 };
        return {
            ...toSummary(campaign),
            seller: {
                id: String(campaign.seller?.id || ''),
                shopName: String(campaign.seller?.shopName || ''),
                storeLogoImageUrl: campaign.seller?.storeLogoImageUrl || null,
            },
            performance: {
                usageCount: Number(campaign.usageCount || 0),
                totalDiscountAmount: perf.totalDiscount,
                orderCount: perf.orderCount,
            },
        };
    });
};
exports.getAdminCampaigns = getAdminCampaigns;
const updateAdminCampaignStatus = async (params) => {
    const campaign = await db_1.default.sellerCampaign.findUnique({ where: { id: params.campaignId } });
    if (!campaign)
        throw new errorHandler_1.AppError(404, 'Campaign not found');
    const currentStatus = normalizeStatus(campaign.status);
    const nextStatus = normalizeStatus(params.status);
    const rejectReason = String(params.rejectReason || '').trim();
    const shouldNotifyCustomers = currentStatus === 'PENDING' && nextStatus === 'ACTIVE' && !campaign.customerNotifiedAt;
    if (nextStatus === 'REJECTED' && rejectReason.length < 3) {
        throw new errorHandler_1.AppError(400, 'Rejection reason is required');
    }
    const updated = await db_1.default.$transaction(async (tx) => {
        if (nextStatus === 'ACTIVE') {
            await tx.sellerCampaign.updateMany({
                where: {
                    sellerId: campaign.sellerId,
                    status: 'ACTIVE',
                    id: { not: campaign.id },
                },
                data: { status: 'PASSIVE' },
            });
        }
        const updatedCampaign = await tx.sellerCampaign.update({
            where: { id: campaign.id },
            data: {
                status: nextStatus,
                rejectReason: nextStatus === 'REJECTED' ? rejectReason : null,
            },
        });
        if (shouldNotifyCustomers) {
            await createCampaignApprovalNotifications(tx, {
                campaignId: String(campaign.id),
                sellerId: String(campaign.sellerId),
                discountAmount: Number(campaign.discountAmount || 0),
            });
        }
        return updatedCampaign;
    });
    return toSummary(updated);
};
exports.updateAdminCampaignStatus = updateAdminCampaignStatus;
