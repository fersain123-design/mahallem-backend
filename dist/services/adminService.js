"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.markNotificationAsRead = exports.createNotification = exports.getNotifications = exports.markPayoutAsPaid = exports.getPayoutById = exports.getPayouts = exports.updateOrderStatus = exports.getOrderById = exports.getOrders = exports.rejectProductForPricing = exports.deleteProductByAdmin = exports.setProductActive = exports.toggleProductActive = exports.bulkAssignProductSubCategories = exports.getUncategorizedProducts = exports.getProducts = exports.unsuspendUser = exports.suspendUser = exports.getUserById = exports.getCustomers = exports.getUsers = exports.createVendorViolation = exports.getVendorViolations = exports.reviewVendorDocument = exports.rejectVendor = exports.approveVendor = exports.unsuspendVendor = exports.suspendVendor = exports.deactivateVendor = exports.getVendorById = exports.openVendorIbanChange = exports.approveVendorIban = exports.rejectVendorDeliveryCoverageChange = exports.approveVendorDeliveryCoverageChange = exports.updateVendorDeliverySettingsByAdmin = exports.savePlatformNeighborhoodDeliverySetting = exports.getPlatformNeighborhoodDeliverySettings = exports.getVendorDeliveryOverview = exports.getVendors = exports.getAdminDashboard = void 0;
const db_1 = __importDefault(require("../config/db"));
const errorHandler_1 = require("../middleware/errorHandler");
const payment_service_1 = require("../modules/payment/payment.service");
const orderCode_1 = require("../utils/orderCode");
const commission_1 = require("../utils/commission");
const platformNeighborhoodDeliveryService_1 = require("./platformNeighborhoodDeliveryService");
const subcategoryService_1 = require("./subcategoryService");
const accountStatusEmails_1 = require("./mail/accountStatusEmails");
const mailHandler_1 = require("./mail/mailHandler");
const mailEvents_1 = require("./mail/mailEvents");
const ACCOUNT_SUSPEND_REASON_PREFIX = '[SUSPENDED] ';
const ACCOUNT_DEACTIVATED_REASON_PREFIX = '[DEACTIVATED] ';
const VENDOR_DOCUMENT_FIELD_MAP = {
    taxSheet: {
        urlField: 'taxSheetUrl',
        statusField: 'taxSheetReviewStatus',
        noteField: 'taxSheetReviewNote',
        verifiedField: 'taxSheetVerified',
        title: 'Vergi Levhasi',
    },
    residenceDoc: {
        urlField: 'residenceDocUrl',
        statusField: 'residenceDocReviewStatus',
        noteField: 'residenceDocReviewNote',
        verifiedField: 'residenceVerified',
        title: 'Ikamet Belgesi',
    },
    idPhotoFront: {
        urlField: 'idPhotoFrontUrl',
        statusField: 'idPhotoFrontReviewStatus',
        noteField: 'idPhotoFrontReviewNote',
        title: 'Kimlik On Yuz',
    },
    idPhotoBack: {
        urlField: 'idPhotoBackUrl',
        statusField: 'idPhotoBackReviewStatus',
        noteField: 'idPhotoBackReviewNote',
        title: 'Kimlik Arka Yuz',
    },
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
const computeIsOpenNow = (openingTime, closingTime) => {
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
const summarizeFinancialOrderItems = (items, fallbackCommissionRate) => {
    return items.reduce((acc, item) => {
        const financials = (0, commission_1.resolveOrderItemFinancials)(item, fallbackCommissionRate);
        acc.grossAmount = (0, commission_1.toMoney)(acc.grossAmount + financials.subtotal);
        acc.commissionAmount = (0, commission_1.toMoney)(acc.commissionAmount + financials.commissionAmount);
        acc.netAmount = (0, commission_1.toMoney)(acc.netAmount + financials.vendorNetAmount);
        return acc;
    }, { grossAmount: 0, commissionAmount: 0, netAmount: 0 });
};
const mapPayoutWithFinancials = (payout, fallbackCommissionRate) => {
    const derived = summarizeFinancialOrderItems(Array.isArray(payout?.items) ? payout.items.map((item) => item?.orderItem || item) : [], fallbackCommissionRate);
    const storedGrossAmount = Number(payout?.grossAmount);
    const storedCommissionAmount = Number(payout?.commissionAmount);
    const storedNetAmount = Number(payout?.amount);
    return {
        ...payout,
        grossAmount: Number.isFinite(storedGrossAmount) && storedGrossAmount > 0 ? (0, commission_1.toMoney)(storedGrossAmount) : derived.grossAmount,
        commissionAmount: Number.isFinite(storedCommissionAmount) && storedCommissionAmount > 0
            ? (0, commission_1.toMoney)(storedCommissionAmount)
            : derived.commissionAmount,
        amount: Number.isFinite(storedNetAmount) ? (0, commission_1.toMoney)(storedNetAmount) : derived.netAmount,
        netAmount: Number.isFinite(storedNetAmount) ? (0, commission_1.toMoney)(storedNetAmount) : derived.netAmount,
    };
};
const getAdminDashboard = async () => {
    const commissionRate = (0, commission_1.clampCommissionRate)((await db_1.default.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} })).commissionRate);
    const [totalUsers, totalCustomers, totalVendors, totalProducts, vendorsByStatus, totalOrders, settledOrderItems, pendingOrders, pendingVendors, topProducts,] = await Promise.all([
        db_1.default.user.count(),
        db_1.default.user.count({ where: { role: 'CUSTOMER' } }),
        db_1.default.user.count({ where: { role: 'VENDOR' } }),
        db_1.default.product.count(),
        db_1.default.vendorProfile.groupBy({ by: ['status'], _count: true }),
        db_1.default.order.count(),
        db_1.default.orderItem.findMany({
            where: {
                order: {
                    status: 'DELIVERED',
                    paymentStatus: 'PAID',
                },
            },
            select: {
                id: true,
                productId: true,
                quantity: true,
                subtotal: true,
                commissionRateSnapshot: true,
                commissionAmount: true,
                vendorNetAmount: true,
            },
        }),
        db_1.default.order.count({ where: { status: 'PENDING' } }),
        db_1.default.vendorProfile.count({ where: { status: 'PENDING' } }),
        db_1.default.orderItem.groupBy({
            by: ['productId'],
            _sum: { quantity: true },
            orderBy: {
                _sum: { quantity: 'desc' },
            },
            take: 10,
        }),
    ]);
    const topProductsData = await Promise.all(topProducts.map(async (tp) => {
        const product = await db_1.default.product.findUnique({
            where: { id: tp.productId },
            include: {
                vendor: {
                    select: { shopName: true },
                },
            },
        });
        return {
            product,
            totalQuantitySold: tp._sum.quantity,
        };
    }));
    const settledSummary = summarizeFinancialOrderItems(settledOrderItems, commissionRate);
    return {
        totalUsers,
        totalCustomers,
        totalVendors,
        totalProducts,
        vendorsByStatus: vendorsByStatus.reduce((acc, item) => {
            acc[item.status] = item._count;
            return acc;
        }, {}),
        totalOrders,
        totalRevenue: settledSummary.grossAmount,
        totalCommissions: settledSummary.commissionAmount,
        netProfit: settledSummary.commissionAmount,
        totalPayoutableNet: settledSummary.netAmount,
        pendingOrders,
        pendingVendors,
        commissionRate,
        topProducts: topProductsData,
    };
};
exports.getAdminDashboard = getAdminDashboard;
const getVendors = async (status, search, ibanStatusIn, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const where = {};
    if (status) {
        where.status = status;
    }
    if (search) {
        where.OR = [
            { shopName: { contains: search } },
            { user: { name: { contains: search } } },
            { user: { email: { contains: search } } },
        ];
    }
    if (Array.isArray(ibanStatusIn) && ibanStatusIn.length > 0) {
        where.ibanStatus = { in: ibanStatusIn };
    }
    const orderBy = Array.isArray(ibanStatusIn) && ibanStatusIn.length > 0
        ? { updatedAt: 'desc' }
        : { createdAt: 'desc' };
    const [vendors, total] = await Promise.all([
        db_1.default.vendorProfile.findMany({
            where,
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                    },
                },
            },
            orderBy,
            skip,
            take: limit,
        }),
        db_1.default.vendorProfile.count({ where }),
    ]);
    const vendorsWithOpenState = vendors.map((vendor) => ({
        ...vendor,
        isOpenNow: computeIsOpenNow(vendor.openingTime, vendor.closingTime),
    }));
    return {
        vendors: vendorsWithOpenState,
        pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
        },
    };
};
exports.getVendors = getVendors;
const getVendorDeliveryOverview = async () => {
    const select = {
        id: true,
        shopName: true,
        neighborhood: true,
        deliveryCoverage: true,
        deliveryMode: true,
        deliveryMinutes: true,
        minimumOrderAmount: true,
        flatDeliveryFee: true,
        freeOverAmount: true,
        isActive: true,
        pendingDeliveryCoverage: true,
        deliveryCoverageChangeRequestedAt: true,
        createdAt: true,
        updatedAt: true,
        user: {
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
            },
        },
    };
    const [selfCovered, platformCovered, pending] = await Promise.all([
        db_1.default.vendorProfile.findMany({
            where: { deliveryMode: 'SELLER', pendingDeliveryCoverage: null },
            select,
            orderBy: { updatedAt: 'desc' },
        }),
        db_1.default.vendorProfile.findMany({
            where: { deliveryMode: 'PLATFORM', pendingDeliveryCoverage: null },
            select,
            orderBy: { updatedAt: 'desc' },
        }),
        db_1.default.vendorProfile.findMany({
            where: { pendingDeliveryCoverage: { not: null } },
            select,
            orderBy: { deliveryCoverageChangeRequestedAt: 'desc' },
        }),
    ]);
    const settingsMap = await (0, platformNeighborhoodDeliveryService_1.getPlatformNeighborhoodSettingsMap)([
        ...selfCovered.map((vendor) => vendor.neighborhood),
        ...platformCovered.map((vendor) => vendor.neighborhood),
        ...pending.map((vendor) => vendor.neighborhood),
    ]);
    const enrich = async (vendors) => Promise.all(vendors.map(async (vendor) => {
        const effective = await (0, platformNeighborhoodDeliveryService_1.resolveEffectiveVendorDeliverySettings)(vendor, settingsMap);
        return {
            ...vendor,
            effectiveMinimumOrderAmount: effective.minimumOrderAmount,
            effectiveFlatDeliveryFee: effective.flatDeliveryFee,
            effectiveFreeOverAmount: effective.freeOverAmount,
            effectiveDeliveryMinutes: effective.deliveryMinutes,
            missingPlatformNeighborhoodSetting: effective.isMissingPlatformSetting,
            platformNeighborhoodSetting: effective.platformNeighborhoodSetting,
        };
    }));
    return {
        selfCovered: await enrich(selfCovered),
        platformCovered: await enrich(platformCovered),
        pending: await enrich(pending),
    };
};
exports.getVendorDeliveryOverview = getVendorDeliveryOverview;
const getPlatformNeighborhoodDeliverySettings = async (query) => {
    return (0, platformNeighborhoodDeliveryService_1.listPlatformNeighborhoodDeliverySettings)(query);
};
exports.getPlatformNeighborhoodDeliverySettings = getPlatformNeighborhoodDeliverySettings;
const savePlatformNeighborhoodDeliverySetting = async (payload) => {
    const normalizedDeliveryFee = Number(payload.deliveryFee ?? 0);
    const shouldDisableFreeOver = Number.isFinite(normalizedDeliveryFee) && normalizedDeliveryFee <= 0;
    return (0, platformNeighborhoodDeliveryService_1.upsertPlatformNeighborhoodDeliverySetting)({
        ...payload,
        freeOverAmount: shouldDisableFreeOver ? null : payload.freeOverAmount ?? null,
    });
};
exports.savePlatformNeighborhoodDeliverySetting = savePlatformNeighborhoodDeliverySetting;
const updateVendorDeliverySettingsByAdmin = async (vendorProfileId, payload) => {
    const vendor = await db_1.default.vendorProfile.findUnique({ where: { id: vendorProfileId } });
    if (!vendor)
        throw new errorHandler_1.AppError(404, 'Vendor not found');
    const settings = await db_1.default.settings.upsert({
        where: { id: 1 },
        create: { id: 1 },
        update: {},
    });
    if (payload.deliveryMode === 'platform' && !Boolean(settings.platformDeliveryEnabled)) {
        throw new errorHandler_1.AppError(400, 'Platform delivery mode is not enabled yet');
    }
    if (payload.deliveryMode === 'platform') {
        await (0, platformNeighborhoodDeliveryService_1.ensurePlatformNeighborhoodSettingFromVendor)(vendor);
    }
    const hasIncomingFlatDeliveryFee = Object.prototype.hasOwnProperty.call(payload, 'flatDeliveryFee');
    const hasIncomingFreeOverAmount = Object.prototype.hasOwnProperty.call(payload, 'freeOverAmount');
    const effectiveFlatDeliveryFee = hasIncomingFlatDeliveryFee
        ? Number(payload.flatDeliveryFee ?? 0)
        : Number(vendor.flatDeliveryFee ?? 0);
    const shouldDisableFreeOverAmount = Number.isFinite(effectiveFlatDeliveryFee) && effectiveFlatDeliveryFee <= 0;
    const updated = await db_1.default.vendorProfile.update({
        where: { id: vendorProfileId },
        data: {
            ...(payload.deliveryMode !== undefined
                ? {
                    deliveryMode: payload.deliveryMode === 'platform' ? 'PLATFORM' : 'SELLER',
                    deliveryCoverage: payload.deliveryMode === 'platform' ? 'PLATFORM' : 'SELF',
                    pendingDeliveryCoverage: null,
                    deliveryCoverageChangeRequestedAt: null,
                }
                : {}),
            ...(payload.flatDeliveryFee !== undefined ? { flatDeliveryFee: payload.flatDeliveryFee } : {}),
            ...((hasIncomingFreeOverAmount || shouldDisableFreeOverAmount)
                ? { freeOverAmount: shouldDisableFreeOverAmount ? null : payload.freeOverAmount }
                : {}),
            ...(payload.isActive !== undefined ? { isActive: Boolean(payload.isActive) } : {}),
        },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                },
            },
        },
    });
    return updated;
};
exports.updateVendorDeliverySettingsByAdmin = updateVendorDeliverySettingsByAdmin;
const approveVendorDeliveryCoverageChange = async (vendorProfileId) => {
    const vendor = await db_1.default.vendorProfile.findUnique({
        where: { id: vendorProfileId },
        include: { user: true },
    });
    if (!vendor)
        throw new errorHandler_1.AppError(404, 'Vendor not found');
    const pending = String(vendor.pendingDeliveryCoverage || '').trim();
    if (!pending)
        throw new errorHandler_1.AppError(400, 'No pending delivery coverage change');
    if (pending !== 'SELF' && pending !== 'PLATFORM') {
        throw new errorHandler_1.AppError(400, 'Invalid pending delivery coverage');
    }
    if (pending === 'PLATFORM') {
        await (0, platformNeighborhoodDeliveryService_1.ensurePlatformNeighborhoodSettingFromVendor)(vendor);
    }
    const updated = await db_1.default.vendorProfile.update({
        where: { id: vendorProfileId },
        data: {
            deliveryCoverage: pending,
            deliveryMode: pending === 'PLATFORM' ? 'PLATFORM' : 'SELLER',
            pendingDeliveryCoverage: null,
            deliveryCoverageChangeRequestedAt: null,
        },
    });
    // Notify vendor (best-effort)
    try {
        await db_1.default.notification.create({
            data: {
                userId: vendor.userId,
                type: 'ACCOUNT_UPDATE',
                title: 'Teslimat Seçeneği Güncellendi',
                message: 'Teslimat seçeneği değişikliği talebiniz onaylandı.',
            },
        });
    }
    catch {
        // ignore
    }
    return updated;
};
exports.approveVendorDeliveryCoverageChange = approveVendorDeliveryCoverageChange;
const rejectVendorDeliveryCoverageChange = async (vendorProfileId) => {
    const vendor = await db_1.default.vendorProfile.findUnique({
        where: { id: vendorProfileId },
        include: { user: true },
    });
    if (!vendor)
        throw new errorHandler_1.AppError(404, 'Vendor not found');
    const pending = String(vendor.pendingDeliveryCoverage || '').trim();
    if (!pending)
        throw new errorHandler_1.AppError(400, 'No pending delivery coverage change');
    const updated = await db_1.default.vendorProfile.update({
        where: { id: vendorProfileId },
        data: {
            pendingDeliveryCoverage: null,
            deliveryCoverageChangeRequestedAt: null,
        },
    });
    // Notify vendor (best-effort)
    try {
        await db_1.default.notification.create({
            data: {
                userId: vendor.userId,
                type: 'ACCOUNT_UPDATE',
                title: 'Teslimat Seçeneği Talebi Reddedildi',
                message: 'Teslimat seçeneği değişikliği talebiniz reddedildi.',
            },
        });
    }
    catch {
        // ignore
    }
    return updated;
};
exports.rejectVendorDeliveryCoverageChange = rejectVendorDeliveryCoverageChange;
const approveVendorIban = async (vendorProfileId) => {
    const vendor = await db_1.default.vendorProfile.findUnique({ where: { id: vendorProfileId } });
    if (!vendor)
        throw new errorHandler_1.AppError(404, 'Vendor not found');
    const ibanStatus = String(vendor.ibanStatus || 'CHANGE_OPEN');
    if (ibanStatus !== 'WAITING_APPROVAL') {
        throw new errorHandler_1.AppError(400, 'IBAN onayı için uygun durumda değil');
    }
    const updated = await db_1.default.vendorProfile.update({
        where: { id: vendorProfileId },
        data: { ibanStatus: 'COMPLETED', ibanChangeRequestedAt: null },
    });
    try {
        await payment_service_1.paymentService.syncVendorSubmerchantReadiness(vendorProfileId, 'iban_approve');
    }
    catch (error) {
        console.warn('[adminService] iban approve submerchant sync failed:', error);
    }
    return updated;
};
exports.approveVendorIban = approveVendorIban;
const openVendorIbanChange = async (vendorProfileId) => {
    const vendor = await db_1.default.vendorProfile.findUnique({ where: { id: vendorProfileId } });
    if (!vendor)
        throw new errorHandler_1.AppError(404, 'Vendor not found');
    const ibanStatus = String(vendor.ibanStatus || 'CHANGE_OPEN');
    if (ibanStatus !== 'COMPLETED') {
        throw new errorHandler_1.AppError(400, 'IBAN değişikliği için uygun durumda değil');
    }
    const updated = await db_1.default.vendorProfile.update({
        where: { id: vendorProfileId },
        data: {
            iban: '',
            bankName: '',
            ibanStatus: 'CHANGE_OPEN',
            // Mark this as an admin-opened change flow so the next vendor submission can be auto-completed.
            ibanChangeRequestedAt: new Date(),
        },
    });
    try {
        await payment_service_1.paymentService.syncVendorSubmerchantReadiness(vendorProfileId, 'vendor_profile_update');
    }
    catch (error) {
        console.warn('[adminService] open iban change submerchant sync failed:', error);
    }
    return updated;
};
exports.openVendorIbanChange = openVendorIbanChange;
const getVendorById = async (vendorId) => {
    const vendor = await db_1.default.vendorProfile.findUnique({
        where: { id: vendorId },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                    isActive: true,
                    deactivatedAt: true,
                    deactivationReason: true,
                },
            },
            products: {
                select: {
                    id: true,
                    name: true,
                    price: true,
                    stock: true,
                    isActive: true,
                    imageUrl: true,
                },
            },
        },
    });
    if (!vendor) {
        throw new errorHandler_1.AppError(404, 'Vendor not found');
    }
    return {
        ...vendor,
        isOpenNow: computeIsOpenNow(vendor.openingTime, vendor.closingTime),
    };
};
exports.getVendorById = getVendorById;
const deactivateVendor = async (vendorProfileId, reason) => {
    const vendor = await db_1.default.vendorProfile.findUnique({
        where: { id: vendorProfileId },
        include: { user: true },
    });
    if (!vendor) {
        throw new errorHandler_1.AppError(404, 'Vendor not found');
    }
    const updatedUser = await db_1.default.user.update({
        where: { id: vendor.userId },
        data: {
            isActive: false,
            deactivatedAt: new Date(),
            deactivationReason: `${ACCOUNT_DEACTIVATED_REASON_PREFIX}${reason.trim()}`,
        },
        select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            isActive: true,
            deactivatedAt: true,
            deactivationReason: true,
        },
    });
    await db_1.default.notification.create({
        data: {
            userId: vendor.userId,
            type: 'ACCOUNT_UPDATE',
            title: 'Hesabınız kapatıldı',
            message: reason,
        },
    });
    return {
        vendorProfileId: vendorProfileId,
        user: updatedUser,
    };
};
exports.deactivateVendor = deactivateVendor;
const suspendVendor = async (vendorProfileId, reason) => {
    const vendor = await db_1.default.vendorProfile.findUnique({
        where: { id: vendorProfileId },
        include: { user: true },
    });
    if (!vendor) {
        throw new errorHandler_1.AppError(404, 'Vendor not found');
    }
    const updatedUser = await db_1.default.user.update({
        where: { id: vendor.userId },
        data: {
            isActive: false,
            deactivatedAt: new Date(),
            deactivationReason: `${ACCOUNT_SUSPEND_REASON_PREFIX}${reason.trim()}`,
        },
        select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            isActive: true,
            deactivatedAt: true,
            deactivationReason: true,
        },
    });
    await db_1.default.notification.create({
        data: {
            userId: vendor.userId,
            type: 'ACCOUNT_UPDATE',
            title: 'Hesabınız askıya alındı',
            message: 'Hesabınız kötüye kullanıldığı için askıya alınmıştır. Size bir e-posta gönderdik.',
        },
    });
    try {
        await (0, accountStatusEmails_1.sendSuspensionEmail)({
            to: String(updatedUser.email || '').trim(),
            name: updatedUser.name,
            role: 'VENDOR',
            reason,
            shopName: vendor.shopName,
        });
    }
    catch (error) {
        console.warn('[adminService] suspendVendor mail failed:', error);
    }
    return {
        vendorProfileId,
        user: updatedUser,
    };
};
exports.suspendVendor = suspendVendor;
const unsuspendVendor = async (vendorProfileId) => {
    const vendor = await db_1.default.vendorProfile.findUnique({
        where: { id: vendorProfileId },
        include: { user: true },
    });
    if (!vendor) {
        throw new errorHandler_1.AppError(404, 'Vendor not found');
    }
    const updatedUser = await db_1.default.user.update({
        where: { id: vendor.userId },
        data: {
            isActive: true,
            deactivatedAt: null,
            deactivationReason: null,
        },
        select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            isActive: true,
            deactivatedAt: true,
            deactivationReason: true,
        },
    });
    await db_1.default.notification.create({
        data: {
            userId: vendor.userId,
            type: 'ACCOUNT_UPDATE',
            title: 'Hesabınız askıdan çıkarıldı',
            message: 'Hesabınız admin tarafından yeniden aktif hale getirildi.',
        },
    });
    try {
        await (0, accountStatusEmails_1.sendUnsuspensionEmail)({
            to: String(updatedUser.email || '').trim(),
            name: updatedUser.name,
            role: 'VENDOR',
            shopName: vendor.shopName,
        });
    }
    catch (error) {
        console.warn('[adminService] unsuspendVendor mail failed:', error);
    }
    return {
        vendorProfileId,
        user: updatedUser,
    };
};
exports.unsuspendVendor = unsuspendVendor;
const approveVendor = async (vendorId) => {
    const vendor = await db_1.default.vendorProfile.findUnique({
        where: { id: vendorId },
        select: {
            id: true,
            userId: true,
            user: {
                select: {
                    email: true,
                    name: true,
                },
            },
        },
    });
    if (!vendor) {
        throw new errorHandler_1.AppError(404, 'Vendor not found');
    }
    const updated = await db_1.default.vendorProfile.update({
        where: { id: vendorId },
        data: {
            status: 'APPROVED',
            rejectionReason: null,
            taxSheetReviewStatus: 'APPROVED',
            taxSheetReviewNote: null,
            taxSheetVerified: true,
            residenceDocReviewStatus: 'APPROVED',
            residenceDocReviewNote: null,
            residenceVerified: true,
            idPhotoFrontReviewStatus: 'APPROVED',
            idPhotoFrontReviewNote: null,
            idPhotoBackReviewStatus: 'APPROVED',
            idPhotoBackReviewNote: null,
            addressVerified: true,
            verificationNotes: null,
        },
    });
    try {
        await db_1.default.notification.create({
            data: {
                userId: vendor.userId,
                type: 'ACCOUNT_UPDATE',
                title: '🎉 Mağazanız Onaylandı',
                message: 'Başvurunuz incelendi ve onaylandı.\nArtık ürün ekleyebilir ve sipariş almaya başlayabilirsiniz.',
            },
        });
    }
    catch {
        // ignore notification failures
    }
    try {
        await (0, mailHandler_1.handleMailEvent)(mailEvents_1.MailEvents.SELLER_APPROVED, {
            email: String(vendor.user?.email || '').trim(),
            name: String(vendor.user?.name || '').trim() || undefined,
        });
    }
    catch (error) {
        console.warn('[adminService] seller approved mail failed:', error);
    }
    try {
        await payment_service_1.paymentService.syncVendorSubmerchantReadiness(vendorId, 'admin_approve');
    }
    catch (error) {
        console.warn('[adminService] vendor approve submerchant sync failed:', error);
    }
    return updated;
};
exports.approveVendor = approveVendor;
const rejectVendor = async (vendorId, rejectionReason) => {
    const vendor = await db_1.default.vendorProfile.findUnique({
        where: { id: vendorId },
    });
    if (!vendor) {
        throw new errorHandler_1.AppError(404, 'Vendor not found');
    }
    const updated = await db_1.default.vendorProfile.update({
        where: { id: vendorId },
        data: {
            status: 'REJECTED',
            rejectionReason,
        },
    });
    return updated;
};
exports.rejectVendor = rejectVendor;
const reviewVendorDocument = async (vendorId, input) => {
    const vendor = await db_1.default.vendorProfile.findUnique({
        where: { id: vendorId },
        include: { user: { select: { id: true } } },
    });
    if (!vendor) {
        throw new errorHandler_1.AppError(404, 'Vendor not found');
    }
    const config = VENDOR_DOCUMENT_FIELD_MAP[input.documentType];
    const currentDocumentUrl = String(vendor?.[config.urlField] || '').trim();
    if (!currentDocumentUrl) {
        throw new errorHandler_1.AppError(400, 'Belge yüklenmeden inceleme yapılamaz');
    }
    const reviewNote = String(input.note || '').trim() || null;
    const updateData = {
        [config.statusField]: input.status,
        [config.noteField]: reviewNote,
    };
    if (config.verifiedField) {
        updateData[config.verifiedField] = input.status === 'APPROVED';
    }
    if (input.status === 'APPROVED') {
        updateData.rejectionReason = null;
    }
    const updated = await db_1.default.vendorProfile.update({
        where: { id: vendorId },
        data: updateData,
    });
    try {
        await db_1.default.notification.create({
            data: {
                userId: vendor.userId,
                type: 'ACCOUNT_UPDATE',
                title: input.status === 'APPROVED'
                    ? `${config.title} onaylandi`
                    : `${config.title} icin tekrar gonderim istendi`,
                message: input.status === 'APPROVED'
                    ? `${config.title} belgeniz admin tarafindan onaylandi.`
                    : `${config.title} belgeniz icin tekrar gonderim istendi.${reviewNote ? ` Not: ${reviewNote}` : ''}`,
            },
        });
    }
    catch {
        // ignore notification failures
    }
    return updated;
};
exports.reviewVendorDocument = reviewVendorDocument;
const getVendorViolations = async (vendorProfileId) => {
    const vendor = await db_1.default.vendorProfile.findUnique({
        where: { id: vendorProfileId },
        select: { id: true },
    });
    if (!vendor) {
        throw new errorHandler_1.AppError(404, 'Vendor not found');
    }
    const violations = await db_1.default.vendorViolation.findMany({
        where: { vendorProfileId },
        include: {
            createdBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
    });
    return violations;
};
exports.getVendorViolations = getVendorViolations;
const createVendorViolation = async (adminUserId, vendorProfileId, data) => {
    const vendor = await db_1.default.vendorProfile.findUnique({
        where: { id: vendorProfileId },
        include: { user: { select: { id: true } } },
    });
    if (!vendor) {
        throw new errorHandler_1.AppError(404, 'Vendor not found');
    }
    const created = await db_1.default.vendorViolation.create({
        data: {
            vendorProfileId,
            createdByUserId: adminUserId,
            type: data.type,
            note: data.note,
        },
    });
    await db_1.default.notification.create({
        data: {
            userId: vendor.userId,
            type: 'ACCOUNT_UPDATE',
            title: 'İhlal Aldınız',
            message: `${data.type}: ${data.note}`,
        },
    });
    return created;
};
exports.createVendorViolation = createVendorViolation;
const getUsers = async (role, search, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const where = {};
    if (role) {
        where.role = role;
    }
    if (search) {
        where.OR = [
            { name: { contains: search } },
            { email: { contains: search } },
        ];
    }
    const [users, total] = await Promise.all([
        db_1.default.user.findMany({
            where,
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true,
                isActive: true,
                authProvider: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
        }),
        db_1.default.user.count({ where }),
    ]);
    return {
        users,
        pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
        },
    };
};
exports.getUsers = getUsers;
const getCustomers = async (search, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const where = { role: 'CUSTOMER' };
    if (search) {
        where.OR = [
            { name: { contains: search } },
            { email: { contains: search } },
            { phone: { contains: search } },
        ];
    }
    const [users, total] = await Promise.all([
        db_1.default.user.findMany({
            where,
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                isActive: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: Math.min(Math.max(limit, 1), 100),
        }),
        db_1.default.user.count({ where }),
    ]);
    const customerIds = users.map((u) => u.id);
    const orderAgg = customerIds.length
        ? await db_1.default.order.groupBy({
            by: ['customerId'],
            where: { customerId: { in: customerIds } },
            _sum: { totalPrice: true },
            _count: { _all: true },
        })
        : [];
    const orderAggMap = new Map(orderAgg.map((a) => [
        a.customerId,
        {
            total_spending: a._sum.totalPrice || 0,
            order_count: a._count._all || 0,
        },
    ]));
    const customers = users.map((u) => {
        const agg = orderAggMap.get(u.id) || { total_spending: 0, order_count: 0 };
        return {
            id: u.id,
            name: u.name,
            email: u.email,
            phone: u.phone,
            total_spending: agg.total_spending,
            order_count: agg.order_count,
            status: u.isActive ? 'Active' : 'Suspended',
            created_at: u.createdAt,
        };
    });
    return {
        customers,
        pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
        },
    };
};
exports.getCustomers = getCustomers;
const getUserById = async (userId) => {
    const user = await db_1.default.user.findUnique({
        where: { id: userId },
        include: {
            vendorProfile: true,
        },
    });
    if (!user) {
        throw new errorHandler_1.AppError(404, 'User not found');
    }
    return user;
};
exports.getUserById = getUserById;
const suspendUser = async (userId, reason) => {
    const user = await db_1.default.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            role: true,
            isActive: true,
        },
    });
    if (!user) {
        throw new errorHandler_1.AppError(404, 'User not found');
    }
    if (user.role !== 'CUSTOMER') {
        throw new errorHandler_1.AppError(400, 'Only customer accounts can be suspended from this endpoint');
    }
    const updatedUser = await db_1.default.user.update({
        where: { id: userId },
        data: {
            isActive: false,
            deactivatedAt: new Date(),
            deactivationReason: `${ACCOUNT_SUSPEND_REASON_PREFIX}${reason.trim()}`,
        },
        select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            isActive: true,
            deactivatedAt: true,
            deactivationReason: true,
        },
    });
    await db_1.default.notification.create({
        data: {
            userId,
            type: 'ACCOUNT_UPDATE',
            title: 'Hesabınız askıya alındı',
            message: 'Hesabınız kötüye kullanıldığı için askıya alınmıştır. Size bir e-posta gönderdik.',
        },
    });
    try {
        await (0, accountStatusEmails_1.sendSuspensionEmail)({
            to: String(updatedUser.email || '').trim(),
            name: updatedUser.name,
            role: 'CUSTOMER',
            reason,
        });
    }
    catch (error) {
        console.warn('[adminService] suspendUser mail failed:', error);
    }
    return updatedUser;
};
exports.suspendUser = suspendUser;
const unsuspendUser = async (userId) => {
    const user = await db_1.default.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            role: true,
        },
    });
    if (!user) {
        throw new errorHandler_1.AppError(404, 'User not found');
    }
    if (user.role !== 'CUSTOMER') {
        throw new errorHandler_1.AppError(400, 'Only customer accounts can be unsuspended from this endpoint');
    }
    const updatedUser = await db_1.default.user.update({
        where: { id: userId },
        data: {
            isActive: true,
            deactivatedAt: null,
            deactivationReason: null,
        },
        select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            isActive: true,
            deactivatedAt: true,
            deactivationReason: true,
        },
    });
    await db_1.default.notification.create({
        data: {
            userId,
            type: 'ACCOUNT_UPDATE',
            title: 'Hesabınız askıdan çıkarıldı',
            message: 'Hesabınız admin tarafından yeniden aktif hale getirildi.',
        },
    });
    try {
        await (0, accountStatusEmails_1.sendUnsuspensionEmail)({
            to: String(updatedUser.email || '').trim(),
            name: updatedUser.name,
            role: 'CUSTOMER',
        });
    }
    catch (error) {
        console.warn('[adminService] unsuspendUser mail failed:', error);
    }
    return updatedUser;
};
exports.unsuspendUser = unsuspendUser;
const getProducts = async (isActive, approvalStatus, categorySlug, search, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const where = {};
    if (isActive !== undefined) {
        where.isActive = isActive;
    }
    if (approvalStatus) {
        where.approvalStatus = approvalStatus;
    }
    if (categorySlug) {
        where.category = { slug: String(categorySlug) };
    }
    if (search) {
        where.OR = [
            { name: { contains: search } },
            { description: { contains: search } },
            { vendor: { shopName: { contains: search } } },
            { category: { name: { contains: search } } },
        ];
    }
    const [products, total] = await Promise.all([
        db_1.default.product.findMany({
            where,
            include: {
                vendor: {
                    select: { id: true, shopName: true },
                },
                category: true,
                subCategory: true,
                images: {
                    select: { imageUrl: true, sortOrder: true },
                    orderBy: { sortOrder: 'asc' },
                },
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
        }),
        db_1.default.product.count({ where }),
    ]);
    return {
        products,
        pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
        },
    };
};
exports.getProducts = getProducts;
const getUncategorizedProducts = async (search, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const where = {
        subCategoryId: null,
    };
    if (search) {
        where.OR = [
            { name: { contains: search } },
            { description: { contains: search } },
            { vendor: { shopName: { contains: search } } },
        ];
    }
    const [products, total] = await Promise.all([
        db_1.default.product.findMany({
            where,
            include: {
                vendor: {
                    select: {
                        id: true,
                        shopName: true,
                        categoryId: true,
                        businessType: true,
                    },
                },
                category: {
                    select: { id: true, name: true, slug: true },
                },
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
        }),
        db_1.default.product.count({ where }),
    ]);
    return {
        products,
        pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
        },
    };
};
exports.getUncategorizedProducts = getUncategorizedProducts;
const bulkAssignProductSubCategories = async (data) => {
    await (0, subcategoryService_1.ensureBaseCategorySystem)();
    const ids = Array.isArray(data.productIds)
        ? data.productIds.map((id) => String(id).trim()).filter(Boolean)
        : [];
    if (ids.length === 0) {
        throw new errorHandler_1.AppError(400, 'productIds is required');
    }
    const products = await db_1.default.product.findMany({
        where: { id: { in: ids } },
        include: {
            vendor: {
                select: {
                    id: true,
                    businessType: true,
                    categoryId: true,
                },
            },
        },
    });
    if (products.length === 0) {
        return { updatedCount: 0, updatedProductIds: [] };
    }
    const useAutoMatch = Boolean(data.autoMatch) || !String(data.subCategoryId || '').trim();
    const requestedSubCategoryId = String(data.subCategoryId || '').trim();
    const updatedProductIds = [];
    for (const product of products) {
        let categoryIdToSet;
        let subCategoryIdToSet;
        if (!useAutoMatch && requestedSubCategoryId) {
            const direct = await db_1.default.subCategory.findFirst({
                where: {
                    OR: [{ id: requestedSubCategoryId }, { slug: requestedSubCategoryId }],
                    isActive: true,
                },
                select: { id: true, categoryId: true },
            });
            if (!direct) {
                throw new errorHandler_1.AppError(404, 'Subcategory not found');
            }
            const vendorCategoryId = String(product.vendor?.categoryId || '').trim();
            if (vendorCategoryId && direct.categoryId !== vendorCategoryId) {
                throw new errorHandler_1.AppError(400, `Product ${product.id} icin secilen alt kategori satici kategorisi ile uyumsuz`);
            }
            categoryIdToSet = direct.categoryId;
            subCategoryIdToSet = direct.id;
        }
        else {
            const resolved = await (0, subcategoryService_1.resolveVendorScopedCategoryMeta)({
                id: product.vendor.id,
                businessType: product.vendor.businessType,
                categoryId: product.vendor.categoryId,
            }, { name: product.name }, true);
            if (!resolved.subCategory) {
                throw new errorHandler_1.AppError(400, `Product ${product.id} icin alt kategori bulunamadi`);
            }
            categoryIdToSet = resolved.category.id;
            subCategoryIdToSet = resolved.subCategory.id;
        }
        await db_1.default.product.update({
            where: { id: product.id },
            data: {
                ...(categoryIdToSet ? { categoryId: categoryIdToSet } : {}),
                ...(subCategoryIdToSet ? { subCategoryId: subCategoryIdToSet } : {}),
            },
        });
        updatedProductIds.push(product.id);
    }
    return {
        updatedCount: updatedProductIds.length,
        updatedProductIds,
    };
};
exports.bulkAssignProductSubCategories = bulkAssignProductSubCategories;
const toggleProductActive = async (productId) => {
    const product = await db_1.default.product.findUnique({
        where: { id: productId },
    });
    if (!product) {
        throw new errorHandler_1.AppError(404, 'Product not found');
    }
    const updated = await db_1.default.product.update({
        where: { id: productId },
        data: {
            isActive: !product.isActive,
            approvalStatus: product.isActive ? 'REJECTED' : 'APPROVED',
            rejectionReason: product.isActive ? 'Admin moderasyonu nedeniyle reddedildi.' : null,
        },
    });
    return updated;
};
exports.toggleProductActive = toggleProductActive;
const setProductActive = async (productId, isActive) => {
    const product = await db_1.default.product.findUnique({
        where: { id: productId },
    });
    if (!product) {
        throw new errorHandler_1.AppError(404, 'Product not found');
    }
    const updated = await db_1.default.product.update({
        where: { id: productId },
        data: {
            isActive: Boolean(isActive),
            approvalStatus: isActive ? 'APPROVED' : 'REJECTED',
            rejectionReason: isActive ? null : product.rejectionReason || 'Admin moderasyonu nedeniyle reddedildi.',
        },
    });
    return updated;
};
exports.setProductActive = setProductActive;
const deleteProductByAdmin = async (productId) => {
    const product = await db_1.default.product.findUnique({
        where: { id: productId },
        include: {
            vendor: {
                select: {
                    userId: true,
                    shopName: true,
                },
            },
        },
    });
    if (!product) {
        throw new errorHandler_1.AppError(404, 'Product not found');
    }
    await db_1.default.product.delete({
        where: { id: productId },
    });
    if (product.vendor?.userId) {
        await db_1.default.notification.create({
            data: {
                userId: product.vendor.userId,
                type: 'ACCOUNT_UPDATE',
                title: 'Urun kaldirildi',
                message: `"${product.name}" urunu admin tarafindan kaldirildi. Lutfen urun bilgilerini kontrol ederek tekrar ekleyin.`,
            },
        });
    }
    return {
        success: true,
        deletedProductId: productId,
    };
};
exports.deleteProductByAdmin = deleteProductByAdmin;
const rejectProductForPricing = async (productId, reasonMessage, reasonTitle) => {
    const product = await db_1.default.product.findUnique({
        where: { id: productId },
        include: {
            vendor: {
                select: {
                    userId: true,
                    shopName: true,
                },
            },
        },
    });
    if (!product) {
        throw new errorHandler_1.AppError(404, 'Product not found');
    }
    const normalizedReason = String(reasonMessage || '').trim();
    if (normalizedReason.length < 5) {
        throw new errorHandler_1.AppError(400, 'Reason is required');
    }
    const updated = await db_1.default.product.update({
        where: { id: productId },
        data: {
            isActive: false,
            approvalStatus: 'REJECTED',
            rejectionReason: normalizedReason,
        },
    });
    if (product.vendor?.userId) {
        const title = String(reasonTitle || '').trim() || 'Fiyat duzeltmesi gerekli';
        await db_1.default.notification.create({
            data: {
                userId: product.vendor.userId,
                type: 'ACCOUNT_UPDATE',
                title,
                message: `"${product.name}" urunu fiyat bilgisi nedeniyle reddedildi: ${normalizedReason}`,
            },
        });
    }
    return {
        ...updated,
        moderationReason: normalizedReason,
    };
};
exports.rejectProductForPricing = rejectProductForPricing;
const getOrders = async (status, vendorId, customerId, cancelReason, paymentStatus, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const where = {};
    if (status) {
        where.status = status;
    }
    if (customerId) {
        where.customerId = customerId;
    }
    if (vendorId) {
        where.items = {
            some: { vendorId },
        };
    }
    if (cancelReason) {
        where.cancelReason = cancelReason;
    }
    if (paymentStatus) {
        where.paymentStatus = paymentStatus;
    }
    const [orders, total] = await Promise.all([
        db_1.default.order.findMany({
            where,
            include: {
                customer: {
                    select: { id: true, name: true, email: true },
                },
                items: {
                    include: {
                        product: { select: { id: true, name: true } },
                        vendor: { select: { id: true, shopName: true } },
                    },
                },
                actionHistory: {
                    where: { actionType: 'ORDER_CANCELLED' },
                    select: { note: true, metadata: true, createdAt: true },
                    orderBy: { createdAt: 'desc' },
                    take: 3,
                },
                shippingAddress: true,
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
        }),
        db_1.default.order.count({ where }),
    ]);
    const orderIds = orders.map((item) => item.id);
    const supportConversations = orderIds.length
        ? await db_1.default.supportConversation.findMany({
            where: {
                orderId: { in: orderIds },
                category: 'PAYMENT',
            },
            include: {
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: { body: true, createdAt: true },
                },
            },
            orderBy: { updatedAt: 'desc' },
        })
        : [];
    const refundDetailMap = new Map();
    const refundReasonTitleMap = new Map();
    for (const conv of supportConversations) {
        const orderId = String(conv?.orderId || '').trim();
        if (!orderId || refundDetailMap.has(orderId))
            continue;
        const subject = String(conv?.subject || '').trim();
        const subjectMatch = subject.match(/^İade talebi\s*\|\s*(.+)$/i);
        const subjectReasonTitle = String(subjectMatch?.[1] || '').trim();
        if (subjectReasonTitle) {
            refundReasonTitleMap.set(orderId, subjectReasonTitle);
        }
        const rawMessage = String(conv?.messages?.[0]?.body || '').trim();
        if (!rawMessage)
            continue;
        const normalizedMessage = rawMessage
            .replace(/^İade talebi\s*-\s*Sipariş\s*#[^\n]+\n*/i, '')
            .trim();
        refundDetailMap.set(orderId, normalizedMessage || rawMessage);
    }
    const enrichedOrders = orders.map((order) => {
        const cancelActionNote = String(order?.actionHistory?.[0]?.note || '').trim();
        const cancelActionReasonTitle = String(order?.actionHistory?.[0]?.metadata?.reasonTitle || '').trim();
        const cancelOtherDescription = String(order?.cancelOtherDescription || '').trim();
        const cancellationDetail = cancelOtherDescription || cancelActionNote || null;
        const cancellationReasonTitle = cancelActionReasonTitle || null;
        const refundDetail = refundDetailMap.get(order.id) || cancellationDetail || null;
        const refundReasonTitle = refundReasonTitleMap.get(order.id) || cancellationReasonTitle || null;
        return {
            ...order,
            cancellationDetail,
            cancellationReasonTitle,
            refundDetail,
            refundReasonTitle,
        };
    });
    return {
        orders: (0, orderCode_1.attachOrderCodeList)(enrichedOrders),
        pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
        },
    };
};
exports.getOrders = getOrders;
const getOrderById = async (orderId) => {
    const order = await db_1.default.order.findUnique({
        where: { id: orderId },
        include: {
            customer: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                },
            },
            items: {
                include: {
                    product: { select: { id: true, name: true, price: true } },
                    vendor: { select: { id: true, shopName: true } },
                },
            },
            shippingAddress: true,
        },
    });
    if (!order) {
        throw new errorHandler_1.AppError(404, 'Order not found');
    }
    return (0, orderCode_1.attachOrderCode)(order);
};
exports.getOrderById = getOrderById;
const updateOrderStatus = async (orderId, status) => {
    const order = await db_1.default.order.findUnique({
        where: { id: orderId },
        include: {
            customer: {
                select: {
                    email: true,
                    name: true,
                },
            },
        },
    });
    if (!order) {
        throw new errorHandler_1.AppError(404, 'Order not found');
    }
    const updated = await db_1.default.order.update({
        where: { id: orderId },
        data: { status: status },
    });
    if (String(status || '').toUpperCase() === 'DELIVERED') {
        try {
            const customerEmail = String(order.customer?.email || '').trim();
            if (customerEmail) {
                await (0, mailHandler_1.handleMailEvent)(mailEvents_1.MailEvents.ORDER_DELIVERED, {
                    email: customerEmail,
                    name: String(order.customer?.name || 'Müşteri').trim() || 'Müşteri',
                    orderId: String(updated.orderCode || orderId).trim(),
                });
            }
        }
        catch (error) {
            console.warn('[adminService] delivered mail failed:', error);
        }
    }
    return (0, orderCode_1.attachOrderCode)(updated);
};
exports.updateOrderStatus = updateOrderStatus;
const getPayouts = async (status, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const commissionRate = (0, commission_1.clampCommissionRate)((await db_1.default.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} })).commissionRate);
    const where = {};
    if (status)
        where.status = status;
    const [payouts, total] = await Promise.all([
        db_1.default.payout.findMany({
            where,
            include: {
                vendorProfile: {
                    select: {
                        id: true,
                        shopName: true,
                        iban: true,
                        bankName: true,
                        status: true,
                        user: {
                            select: { id: true, name: true, email: true, phone: true },
                        },
                    },
                },
                items: {
                    include: {
                        orderItem: {
                            select: {
                                id: true,
                                subtotal: true,
                                commissionRateSnapshot: true,
                                commissionAmount: true,
                                vendorNetAmount: true,
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
        }),
        db_1.default.payout.count({ where }),
    ]);
    return {
        payouts: payouts.map((payout) => mapPayoutWithFinancials(payout, commissionRate)),
        pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
        },
    };
};
exports.getPayouts = getPayouts;
const getPayoutById = async (payoutId) => {
    const commissionRate = (0, commission_1.clampCommissionRate)((await db_1.default.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} })).commissionRate);
    const payout = await db_1.default.payout.findUnique({
        where: { id: payoutId },
        include: {
            vendorProfile: {
                select: {
                    id: true,
                    shopName: true,
                    iban: true,
                    bankName: true,
                    status: true,
                    user: {
                        select: { id: true, name: true, email: true, phone: true },
                    },
                },
            },
            items: {
                include: {
                    order: true,
                    orderItem: {
                        include: {
                            product: { select: { id: true, name: true } },
                        },
                    },
                },
            },
        },
    });
    if (!payout) {
        throw new errorHandler_1.AppError(404, 'Payout not found');
    }
    return mapPayoutWithFinancials(payout, commissionRate);
};
exports.getPayoutById = getPayoutById;
const markPayoutAsPaid = async (payoutId) => {
    const payout = await db_1.default.payout.findUnique({
        where: { id: payoutId },
        include: {
            vendorProfile: {
                select: {
                    userId: true,
                    user: {
                        select: {
                            email: true,
                        },
                    },
                },
            },
        },
    });
    if (!payout) {
        throw new errorHandler_1.AppError(404, 'Payout not found');
    }
    const updated = await db_1.default.payout.update({
        where: { id: payoutId },
        data: { status: 'PAID' },
    });
    try {
        const userId = payout?.vendorProfile?.userId;
        if (userId) {
            await db_1.default.notification.create({
                data: {
                    userId,
                    type: 'ACCOUNT_UPDATE',
                    title: 'Ödeme Hesabınıza Aktarıldı',
                    message: `₺${Number(updated.amount || 0).toFixed(2)} tutarındaki ödeme talebiniz tamamlandı ve bankaya aktarım süreci başlatıldı.`,
                },
            });
        }
    }
    catch {
        // best effort notification
    }
    try {
        const vendorEmail = String(payout?.vendorProfile?.user?.email || '').trim();
        if (vendorEmail) {
            await (0, mailHandler_1.handleMailEvent)(mailEvents_1.MailEvents.PAYMENT_COMPLETED, {
                email: vendorEmail,
                amount: `₺${Number(updated.amount || 0).toFixed(2)}`,
            });
        }
    }
    catch (error) {
        console.warn('[adminService] payment completed mail failed:', error);
    }
    return updated;
};
exports.markPayoutAsPaid = markPayoutAsPaid;
// Notifications
const getNotifications = async (userId, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const notifications = await db_1.default.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
    });
    const total = await db_1.default.notification.count({
        where: { userId },
    });
    return {
        notifications,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
        },
    };
};
exports.getNotifications = getNotifications;
const createNotification = async (adminId, title, message, type, targetUsers, targetAudience) => {
    const normalizedType = (() => {
        const raw = String(type || '').trim().toUpperCase();
        if (['ORDER_UPDATE', 'PAYOUT_UPDATE', 'ACCOUNT_UPDATE', 'SYSTEM_MESSAGE'].includes(raw)) {
            return raw;
        }
        return 'SYSTEM_MESSAGE';
    })();
    const normalizedAudience = String(targetAudience || '').trim().toUpperCase();
    if (targetUsers && targetUsers.length > 0) {
        const notifications = targetUsers.map(userId => ({
            userId,
            type: normalizedType,
            title,
            message,
        }));
        const result = await db_1.default.notification.createMany({
            data: notifications,
        });
        return {
            deliveredCount: result.count,
            title,
            message,
            type: normalizedType,
            targetAudience: 'CUSTOM_USERS',
            createdAt: new Date().toISOString(),
        };
    }
    else {
        const users = await db_1.default.user.findMany({
            where: normalizedAudience === 'CUSTOMERS'
                ? { role: 'CUSTOMER' }
                : normalizedAudience === 'VENDORS'
                    ? { role: 'VENDOR' }
                    : { role: { in: ['CUSTOMER', 'VENDOR'] } },
        });
        const notifications = users.map(user => ({
            userId: user.id,
            type: normalizedType,
            title,
            message,
        }));
        const result = await db_1.default.notification.createMany({
            data: notifications,
        });
        return {
            deliveredCount: result.count,
            title,
            message,
            type: normalizedType,
            targetAudience: normalizedAudience || 'ALL',
            createdAt: new Date().toISOString(),
        };
    }
};
exports.createNotification = createNotification;
const markNotificationAsRead = async (notificationId, userId) => {
    const notification = await db_1.default.notification.findFirst({
        where: { id: notificationId, userId },
    });
    if (!notification) {
        throw new errorHandler_1.AppError(404, 'Notification not found');
    }
    return await db_1.default.notification.update({
        where: { id: notificationId },
        data: { isRead: true },
    });
};
exports.markNotificationAsRead = markNotificationAsRead;
