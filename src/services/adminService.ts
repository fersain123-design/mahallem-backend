import prisma from '../config/db';
import { AppError } from '../middleware/errorHandler';
import { paymentService } from '../modules/payment/payment.service';
import { CreateVendorViolationInput, ReviewVendorDocumentInput } from '../utils/validationSchemas';
import { attachOrderCode, attachOrderCodeList } from '../utils/orderCode';
import { clampCommissionRate, resolveOrderItemFinancials, toMoney } from '../utils/commission';
import {
  ensurePlatformNeighborhoodSettingFromVendor,
  listPlatformNeighborhoodDeliverySettings,
  getPlatformNeighborhoodSettingsMap,
  requirePlatformNeighborhoodSetting,
  requireReadyPlatformNeighborhoodSettings,
  resolveEffectiveVendorDeliverySettings,
  upsertPlatformNeighborhoodDeliverySetting,
} from './platformNeighborhoodDeliveryService';
import { ensureBaseCategorySystem, resolveVendorScopedCategoryMeta } from './subcategoryService';
import { sendSuspensionEmail, sendUnsuspensionEmail } from './mail/accountStatusEmails';
import { handleMailEvent } from './mail/mailHandler';
import { MailEvents } from './mail/mailEvents';

type VendorDocumentType = ReviewVendorDocumentInput['documentType'];

const ACCOUNT_SUSPEND_REASON_PREFIX = '[SUSPENDED] ';
const ACCOUNT_DEACTIVATED_REASON_PREFIX = '[DEACTIVATED] ';

const VENDOR_DOCUMENT_FIELD_MAP: Record<
  VendorDocumentType,
  {
    urlField: string;
    statusField: string;
    noteField: string;
    verifiedField?: string;
    title: string;
  }
> = {
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

const parseTimeToMinutes = (timeText?: string | null): number | null => {
  const m = String(timeText || '').trim().match(/^(\d{1,2})[:.](\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
};

const computeIsOpenNow = (openingTime?: string | null, closingTime?: string | null): boolean | null => {
  const openText = String(openingTime || '09:00').trim();
  const closeText = String(closingTime || '21:00').trim();
  const openMin = parseTimeToMinutes(openText);
  const closeMin = parseTimeToMinutes(closeText);
  if (openMin == null || closeMin == null) return null;

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  if (closeMin < openMin) {
    return nowMin >= openMin || nowMin < closeMin;
  }
  return nowMin >= openMin && nowMin < closeMin;
};

const summarizeFinancialOrderItems = (items: any[], fallbackCommissionRate: number) => {
  return items.reduce(
    (acc, item) => {
      const financials = resolveOrderItemFinancials(item, fallbackCommissionRate);
      acc.grossAmount = toMoney(acc.grossAmount + financials.subtotal);
      acc.commissionAmount = toMoney(acc.commissionAmount + financials.commissionAmount);
      acc.netAmount = toMoney(acc.netAmount + financials.vendorNetAmount);
      return acc;
    },
    { grossAmount: 0, commissionAmount: 0, netAmount: 0 }
  );
};

const mapPayoutWithFinancials = (payout: any, fallbackCommissionRate: number) => {
  const derived = summarizeFinancialOrderItems(
    Array.isArray(payout?.items) ? payout.items.map((item: any) => item?.orderItem || item) : [],
    fallbackCommissionRate
  );
  const storedGrossAmount = Number(payout?.grossAmount);
  const storedCommissionAmount = Number(payout?.commissionAmount);
  const storedNetAmount = Number(payout?.amount);

  return {
    ...payout,
    grossAmount:
      Number.isFinite(storedGrossAmount) && storedGrossAmount > 0 ? toMoney(storedGrossAmount) : derived.grossAmount,
    commissionAmount:
      Number.isFinite(storedCommissionAmount) && storedCommissionAmount > 0
        ? toMoney(storedCommissionAmount)
        : derived.commissionAmount,
    amount: Number.isFinite(storedNetAmount) ? toMoney(storedNetAmount) : derived.netAmount,
    netAmount: Number.isFinite(storedNetAmount) ? toMoney(storedNetAmount) : derived.netAmount,
  };
};

export const getAdminDashboard = async () => {
  const commissionRate = clampCommissionRate((await prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} })).commissionRate);

  const [
    totalUsers,
    totalCustomers,
    totalVendors,
    totalProducts,
    vendorsByStatus,
    totalOrders,
    settledOrderItems,
    pendingOrders,
    pendingVendors,
    topProducts,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: 'CUSTOMER' } }),
    prisma.user.count({ where: { role: 'VENDOR' } }),
    prisma.product.count(),
    prisma.vendorProfile.groupBy({ by: ['status'], _count: true }),
    prisma.order.count(),
    prisma.orderItem.findMany({
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
    prisma.order.count({ where: { status: 'PENDING' } }),
    prisma.vendorProfile.count({ where: { status: 'PENDING' } }),
    prisma.orderItem.groupBy({
      by: ['productId'],
      _sum: { quantity: true },
      orderBy: {
        _sum: { quantity: 'desc' },
      },
      take: 10,
    }),
  ]);

  const topProductsData = await Promise.all(
    topProducts.map(async (tp) => {
      const product = await prisma.product.findUnique({
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
    })
  );

  const settledSummary = summarizeFinancialOrderItems(settledOrderItems, commissionRate);

  return {
    totalUsers,
    totalCustomers,
    totalVendors,
    totalProducts,
    vendorsByStatus: vendorsByStatus.reduce(
      (acc, item) => {
        acc[item.status] = item._count;
        return acc;
      },
      {} as Record<string, number>
    ),
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

export const getVendors = async (
  status?: string,
  search?: string,
  ibanStatusIn?: string[],
  page: number = 1,
  limit: number = 20
) => {
  const skip = (page - 1) * limit;

  const where: any = {};

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
    ? { updatedAt: 'desc' as const }
    : { createdAt: 'desc' as const };

  const [vendors, total] = await Promise.all([
    prisma.vendorProfile.findMany({
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
    prisma.vendorProfile.count({ where }),
  ]);

  const vendorsWithOpenState = vendors.map((vendor) => ({
    ...vendor,
    isOpenNow: computeIsOpenNow((vendor as any).openingTime, (vendor as any).closingTime),
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

export const getVendorDeliveryOverview = async () => {
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
  } as const;

  const [selfCovered, platformCovered, pending] = await Promise.all([
    prisma.vendorProfile.findMany({
      where: { deliveryMode: 'SELLER', pendingDeliveryCoverage: null },
      select,
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.vendorProfile.findMany({
      where: { deliveryMode: 'PLATFORM', pendingDeliveryCoverage: null },
      select,
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.vendorProfile.findMany({
      where: { pendingDeliveryCoverage: { not: null } },
      select,
      orderBy: { deliveryCoverageChangeRequestedAt: 'desc' },
    }),
  ]);

  const settingsMap = await getPlatformNeighborhoodSettingsMap([
    ...selfCovered.map((vendor) => (vendor as any).neighborhood),
    ...platformCovered.map((vendor) => (vendor as any).neighborhood),
    ...pending.map((vendor) => (vendor as any).neighborhood),
  ]);

  const enrich = async (vendors: any[]) =>
    Promise.all(
      vendors.map(async (vendor) => {
        const effective = await resolveEffectiveVendorDeliverySettings(vendor, settingsMap);
        return {
          ...vendor,
          effectiveMinimumOrderAmount: effective.minimumOrderAmount,
          effectiveFlatDeliveryFee: effective.flatDeliveryFee,
          effectiveFreeOverAmount: effective.freeOverAmount,
          effectiveDeliveryMinutes: effective.deliveryMinutes,
          missingPlatformNeighborhoodSetting: effective.isMissingPlatformSetting,
          platformNeighborhoodSetting: effective.platformNeighborhoodSetting,
        };
      })
    );

  return {
    selfCovered: await enrich(selfCovered),
    platformCovered: await enrich(platformCovered),
    pending: await enrich(pending),
  };
};

export const getPlatformNeighborhoodDeliverySettings = async (query?: string) => {
  return listPlatformNeighborhoodDeliverySettings(query);
};

export const savePlatformNeighborhoodDeliverySetting = async (payload: {
  neighborhood: string;
  minimumOrderAmount: number;
  deliveryFee: number;
  freeOverAmount?: number | null;
  deliveryMinutes: number;
  isActive?: boolean;
}) => {
  const normalizedDeliveryFee = Number(payload.deliveryFee ?? 0);
  const shouldDisableFreeOver = Number.isFinite(normalizedDeliveryFee) && normalizedDeliveryFee <= 0;

  return upsertPlatformNeighborhoodDeliverySetting({
    ...payload,
    freeOverAmount: shouldDisableFreeOver ? null : payload.freeOverAmount ?? null,
  });
};

export const updateVendorDeliverySettingsByAdmin = async (
  vendorProfileId: string,
  payload: {
    deliveryMode?: 'seller' | 'platform';
    flatDeliveryFee?: number | null;
    freeOverAmount?: number | null;
    isActive?: boolean;
  }
) => {
  const vendor = await prisma.vendorProfile.findUnique({ where: { id: vendorProfileId } });
  if (!vendor) throw new AppError(404, 'Vendor not found');

  const settings = await prisma.settings.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  });

  if (payload.deliveryMode === 'platform' && !Boolean((settings as any).platformDeliveryEnabled)) {
    throw new AppError(400, 'Platform delivery mode is not enabled yet');
  }

  if (payload.deliveryMode === 'platform') {
    await ensurePlatformNeighborhoodSettingFromVendor(vendor);
  }

  const hasIncomingFlatDeliveryFee = Object.prototype.hasOwnProperty.call(payload, 'flatDeliveryFee');
  const hasIncomingFreeOverAmount = Object.prototype.hasOwnProperty.call(payload, 'freeOverAmount');
  const effectiveFlatDeliveryFee = hasIncomingFlatDeliveryFee
    ? Number(payload.flatDeliveryFee ?? 0)
    : Number((vendor as any).flatDeliveryFee ?? 0);
  const shouldDisableFreeOverAmount = Number.isFinite(effectiveFlatDeliveryFee) && effectiveFlatDeliveryFee <= 0;

  const updated = await prisma.vendorProfile.update({
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

export const approveVendorDeliveryCoverageChange = async (vendorProfileId: string) => {
  const vendor = await prisma.vendorProfile.findUnique({
    where: { id: vendorProfileId },
    include: { user: true },
  });

  if (!vendor) throw new AppError(404, 'Vendor not found');

  const pending = String((vendor as any).pendingDeliveryCoverage || '').trim();
  if (!pending) throw new AppError(400, 'No pending delivery coverage change');

  if (pending !== 'SELF' && pending !== 'PLATFORM') {
    throw new AppError(400, 'Invalid pending delivery coverage');
  }

  if (pending === 'PLATFORM') {
    await ensurePlatformNeighborhoodSettingFromVendor(vendor);
  }

  const updated = await prisma.vendorProfile.update({
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
    await prisma.notification.create({
      data: {
        userId: vendor.userId,
        type: 'ACCOUNT_UPDATE',
        title: 'Teslimat Seçeneği Güncellendi',
        message: 'Teslimat seçeneği değişikliği talebiniz onaylandı.',
      },
    });
  } catch {
    // ignore
  }

  return updated;
};

export const rejectVendorDeliveryCoverageChange = async (vendorProfileId: string) => {
  const vendor = await prisma.vendorProfile.findUnique({
    where: { id: vendorProfileId },
    include: { user: true },
  });

  if (!vendor) throw new AppError(404, 'Vendor not found');

  const pending = String((vendor as any).pendingDeliveryCoverage || '').trim();
  if (!pending) throw new AppError(400, 'No pending delivery coverage change');

  const updated = await prisma.vendorProfile.update({
    where: { id: vendorProfileId },
    data: {
      pendingDeliveryCoverage: null,
      deliveryCoverageChangeRequestedAt: null,
    },
  });

  // Notify vendor (best-effort)
  try {
    await prisma.notification.create({
      data: {
        userId: vendor.userId,
        type: 'ACCOUNT_UPDATE',
        title: 'Teslimat Seçeneği Talebi Reddedildi',
        message: 'Teslimat seçeneği değişikliği talebiniz reddedildi.',
      },
    });
  } catch {
    // ignore
  }

  return updated;
};

export const approveVendorIban = async (vendorProfileId: string) => {
  const vendor = await prisma.vendorProfile.findUnique({ where: { id: vendorProfileId } });
  if (!vendor) throw new AppError(404, 'Vendor not found');

  const ibanStatus = String((vendor as any).ibanStatus || 'CHANGE_OPEN');
  if (ibanStatus !== 'WAITING_APPROVAL') {
    throw new AppError(400, 'IBAN onayı için uygun durumda değil');
  }

  const updated = await prisma.vendorProfile.update({
    where: { id: vendorProfileId },
    data: { ibanStatus: 'COMPLETED', ibanChangeRequestedAt: null },
  });

  try {
    await paymentService.syncVendorSubmerchantReadiness(vendorProfileId, 'iban_approve');
  } catch (error) {
    console.warn('[adminService] iban approve submerchant sync failed:', error);
  }

  return updated;
};

export const openVendorIbanChange = async (vendorProfileId: string) => {
  const vendor = await prisma.vendorProfile.findUnique({ where: { id: vendorProfileId } });
  if (!vendor) throw new AppError(404, 'Vendor not found');

  const ibanStatus = String((vendor as any).ibanStatus || 'CHANGE_OPEN');
  if (ibanStatus !== 'COMPLETED') {
    throw new AppError(400, 'IBAN değişikliği için uygun durumda değil');
  }

  const updated = await prisma.vendorProfile.update({
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
    await paymentService.syncVendorSubmerchantReadiness(vendorProfileId, 'vendor_profile_update');
  } catch (error) {
    console.warn('[adminService] open iban change submerchant sync failed:', error);
  }

  return updated;
};

export const getVendorById = async (vendorId: string) => {
  const vendor = await prisma.vendorProfile.findUnique({
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
    throw new AppError(404, 'Vendor not found');
  }

  return {
    ...vendor,
    isOpenNow: computeIsOpenNow((vendor as any).openingTime, (vendor as any).closingTime),
  };
};

export const deactivateVendor = async (vendorProfileId: string, reason: string) => {
  const vendor = await prisma.vendorProfile.findUnique({
    where: { id: vendorProfileId },
    include: { user: true },
  });

  if (!vendor) {
    throw new AppError(404, 'Vendor not found');
  }

  const updatedUser = await prisma.user.update({
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

  await prisma.notification.create({
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

export const suspendVendor = async (vendorProfileId: string, reason: string) => {
  const vendor = await prisma.vendorProfile.findUnique({
    where: { id: vendorProfileId },
    include: { user: true },
  });

  if (!vendor) {
    throw new AppError(404, 'Vendor not found');
  }

  const updatedUser = await prisma.user.update({
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

  await prisma.notification.create({
    data: {
      userId: vendor.userId,
      type: 'ACCOUNT_UPDATE',
      title: 'Hesabınız askıya alındı',
      message:
        'Hesabınız kötüye kullanıldığı için askıya alınmıştır. Size bir e-posta gönderdik.',
    },
  });

  try {
    await sendSuspensionEmail({
      to: String(updatedUser.email || '').trim(),
      name: updatedUser.name,
      role: 'VENDOR',
      reason,
      shopName: vendor.shopName,
    });
  } catch (error) {
    console.warn('[adminService] suspendVendor mail failed:', error);
  }

  return {
    vendorProfileId,
    user: updatedUser,
  };
};

export const unsuspendVendor = async (vendorProfileId: string) => {
  const vendor = await prisma.vendorProfile.findUnique({
    where: { id: vendorProfileId },
    include: { user: true },
  });

  if (!vendor) {
    throw new AppError(404, 'Vendor not found');
  }

  const updatedUser = await prisma.user.update({
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

  await prisma.notification.create({
    data: {
      userId: vendor.userId,
      type: 'ACCOUNT_UPDATE',
      title: 'Hesabınız askıdan çıkarıldı',
      message: 'Hesabınız admin tarafından yeniden aktif hale getirildi.',
    },
  });

  try {
    await sendUnsuspensionEmail({
      to: String(updatedUser.email || '').trim(),
      name: updatedUser.name,
      role: 'VENDOR',
      shopName: vendor.shopName,
    });
  } catch (error) {
    console.warn('[adminService] unsuspendVendor mail failed:', error);
  }

  return {
    vendorProfileId,
    user: updatedUser,
  };
};

export const approveVendor = async (vendorId: string) => {
  const vendor = await prisma.vendorProfile.findUnique({
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
    throw new AppError(404, 'Vendor not found');
  }

  const updated = await prisma.vendorProfile.update({
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
    await prisma.notification.create({
      data: {
        userId: vendor.userId,
        type: 'ACCOUNT_UPDATE',
        title: '🎉 Mağazanız Onaylandı',
        message:
          'Başvurunuz incelendi ve onaylandı.\nArtık ürün ekleyebilir ve sipariş almaya başlayabilirsiniz.',
      },
    });
  } catch {
    // ignore notification failures
  }

  try {
    await handleMailEvent(MailEvents.SELLER_APPROVED, {
      email: String(vendor.user?.email || '').trim(),
      name: String(vendor.user?.name || '').trim() || undefined,
    });
  } catch (error) {
    console.warn('[adminService] seller approved mail failed:', error);
  }

  try {
    await paymentService.syncVendorSubmerchantReadiness(vendorId, 'admin_approve');
  } catch (error) {
    console.warn('[adminService] vendor approve submerchant sync failed:', error);
  }

  return updated;
};

export const rejectVendor = async (vendorId: string, rejectionReason: string) => {
  const vendor = await prisma.vendorProfile.findUnique({
    where: { id: vendorId },
  });

  if (!vendor) {
    throw new AppError(404, 'Vendor not found');
  }

  const updated = await prisma.vendorProfile.update({
    where: { id: vendorId },
    data: {
      status: 'REJECTED',
      rejectionReason,
    },
  });

  return updated;
};

export const reviewVendorDocument = async (
  vendorId: string,
  input: ReviewVendorDocumentInput
) => {
  const vendor = await prisma.vendorProfile.findUnique({
    where: { id: vendorId },
    include: { user: { select: { id: true } } },
  });

  if (!vendor) {
    throw new AppError(404, 'Vendor not found');
  }

  const config = VENDOR_DOCUMENT_FIELD_MAP[input.documentType];
  const currentDocumentUrl = String((vendor as any)?.[config.urlField] || '').trim();
  if (!currentDocumentUrl) {
    throw new AppError(400, 'Belge yüklenmeden inceleme yapılamaz');
  }

  const reviewNote = String(input.note || '').trim() || null;
  const updateData: Record<string, any> = {
    [config.statusField]: input.status,
    [config.noteField]: reviewNote,
  };

  if (config.verifiedField) {
    updateData[config.verifiedField] = input.status === 'APPROVED';
  }

  if (input.status === 'APPROVED') {
    updateData.rejectionReason = null;
  }

  const updated = await prisma.vendorProfile.update({
    where: { id: vendorId },
    data: updateData,
  });

  try {
    await prisma.notification.create({
      data: {
        userId: vendor.userId,
        type: 'ACCOUNT_UPDATE',
        title:
          input.status === 'APPROVED'
            ? `${config.title} onaylandi`
            : `${config.title} icin tekrar gonderim istendi`,
        message:
          input.status === 'APPROVED'
            ? `${config.title} belgeniz admin tarafindan onaylandi.`
            : `${config.title} belgeniz icin tekrar gonderim istendi.${reviewNote ? ` Not: ${reviewNote}` : ''}`,
      },
    });
  } catch {
    // ignore notification failures
  }

  return updated;
};

export const getVendorViolations = async (vendorProfileId: string) => {
  const vendor = await prisma.vendorProfile.findUnique({
    where: { id: vendorProfileId },
    select: { id: true },
  });

  if (!vendor) {
    throw new AppError(404, 'Vendor not found');
  }

  const violations = await prisma.vendorViolation.findMany({
    where: { vendorProfileId },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return violations;
};

export const createVendorViolation = async (
  adminUserId: string,
  vendorProfileId: string,
  data: CreateVendorViolationInput
) => {
  const vendor = await prisma.vendorProfile.findUnique({
    where: { id: vendorProfileId },
    include: { user: { select: { id: true } } },
  });

  if (!vendor) {
    throw new AppError(404, 'Vendor not found');
  }

  const created = await prisma.vendorViolation.create({
    data: {
      vendorProfileId,
      createdByUserId: adminUserId,
      type: data.type,
      note: data.note,
    },
  });

  await prisma.notification.create({
    data: {
      userId: vendor.userId,
      type: 'ACCOUNT_UPDATE',
      title: 'İhlal Aldınız',
      message: `${data.type}: ${data.note}`,
    },
  });

  return created;
};

export const getUsers = async (
  role?: string,
  search?: string,
  page: number = 1,
  limit: number = 20
) => {
  const skip = (page - 1) * limit;

  const where: any = {};

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
    prisma.user.findMany({
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
    prisma.user.count({ where }),
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

export const getCustomers = async (
  search?: string,
  page: number = 1,
  limit: number = 20
) => {
  const skip = (page - 1) * limit;
  const where: any = { role: 'CUSTOMER' };

  if (search) {
    where.OR = [
      { name: { contains: search } },
      { email: { contains: search } },
      { phone: { contains: search } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
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
    prisma.user.count({ where }),
  ]);

  const customerIds = users.map((u) => u.id);
  const orderAgg = customerIds.length
    ? await prisma.order.groupBy({
        by: ['customerId'],
        where: { customerId: { in: customerIds } },
        _sum: { totalPrice: true },
        _count: { _all: true },
      })
    : [];

  const orderAggMap = new Map(
    orderAgg.map((a) => [
      a.customerId,
      {
        total_spending: a._sum.totalPrice || 0,
        order_count: a._count._all || 0,
      },
    ])
  );

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

export const getUserById = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      vendorProfile: true,
    },
  });

  if (!user) {
    throw new AppError(404, 'User not found');
  }

  return user;
};

export const suspendUser = async (userId: string, reason: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      isActive: true,
    },
  });

  if (!user) {
    throw new AppError(404, 'User not found');
  }

  if (user.role !== 'CUSTOMER') {
    throw new AppError(400, 'Only customer accounts can be suspended from this endpoint');
  }

  const updatedUser = await prisma.user.update({
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

  await prisma.notification.create({
    data: {
      userId,
      type: 'ACCOUNT_UPDATE',
      title: 'Hesabınız askıya alındı',
      message:
        'Hesabınız kötüye kullanıldığı için askıya alınmıştır. Size bir e-posta gönderdik.',
    },
  });

  try {
    await sendSuspensionEmail({
      to: String(updatedUser.email || '').trim(),
      name: updatedUser.name,
      role: 'CUSTOMER',
      reason,
    });
  } catch (error) {
    console.warn('[adminService] suspendUser mail failed:', error);
  }

  return updatedUser;
};

export const unsuspendUser = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
    },
  });

  if (!user) {
    throw new AppError(404, 'User not found');
  }

  if (user.role !== 'CUSTOMER') {
    throw new AppError(400, 'Only customer accounts can be unsuspended from this endpoint');
  }

  const updatedUser = await prisma.user.update({
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

  await prisma.notification.create({
    data: {
      userId,
      type: 'ACCOUNT_UPDATE',
      title: 'Hesabınız askıdan çıkarıldı',
      message: 'Hesabınız admin tarafından yeniden aktif hale getirildi.',
    },
  });

  try {
    await sendUnsuspensionEmail({
      to: String(updatedUser.email || '').trim(),
      name: updatedUser.name,
      role: 'CUSTOMER',
    });
  } catch (error) {
    console.warn('[adminService] unsuspendUser mail failed:', error);
  }

  return updatedUser;
};

export const getProducts = async (
  isActive?: boolean,
  approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED',
  categorySlug?: string,
  search?: string,
  page: number = 1,
  limit: number = 20
) => {
  const skip = (page - 1) * limit;

  const where: any = {};

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
    prisma.product.findMany({
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
    prisma.product.count({ where }),
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

export const getUncategorizedProducts = async (
  search?: string,
  page: number = 1,
  limit: number = 20
) => {
  const skip = (page - 1) * limit;
  const where: any = {
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
    prisma.product.findMany({
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
    prisma.product.count({ where }),
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

export const bulkAssignProductSubCategories = async (data: {
  productIds?: string[];
  subCategoryId?: string;
  autoMatch?: boolean;
}) => {
  await ensureBaseCategorySystem();

  const ids = Array.isArray(data.productIds)
    ? data.productIds.map((id) => String(id).trim()).filter(Boolean)
    : [];

  if (ids.length === 0) {
    throw new AppError(400, 'productIds is required');
  }

  const products = await prisma.product.findMany({
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
    return { updatedCount: 0, updatedProductIds: [] as string[] };
  }

  const useAutoMatch = Boolean(data.autoMatch) || !String(data.subCategoryId || '').trim();
  const requestedSubCategoryId = String(data.subCategoryId || '').trim();
  const updatedProductIds: string[] = [];

  for (const product of products) {
    let categoryIdToSet: string | undefined;
    let subCategoryIdToSet: string | undefined;

    if (!useAutoMatch && requestedSubCategoryId) {
      const direct = await (prisma as any).subCategory.findFirst({
        where: {
          OR: [{ id: requestedSubCategoryId }, { slug: requestedSubCategoryId }],
          isActive: true,
        },
        select: { id: true, categoryId: true },
      });

      if (!direct) {
        throw new AppError(404, 'Subcategory not found');
      }

      const vendorCategoryId = String(product.vendor?.categoryId || '').trim();
      if (vendorCategoryId && direct.categoryId !== vendorCategoryId) {
        throw new AppError(400, `Product ${product.id} icin secilen alt kategori satici kategorisi ile uyumsuz`);
      }

      categoryIdToSet = direct.categoryId;
      subCategoryIdToSet = direct.id;
    } else {
      const resolved = await resolveVendorScopedCategoryMeta(
        {
          id: product.vendor.id,
          businessType: product.vendor.businessType,
          categoryId: product.vendor.categoryId,
        },
        { name: product.name },
        true
      );

      if (!resolved.subCategory) {
        throw new AppError(400, `Product ${product.id} icin alt kategori bulunamadi`);
      }

      categoryIdToSet = resolved.category.id;
      subCategoryIdToSet = resolved.subCategory.id;
    }

    await prisma.product.update({
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

export const toggleProductActive = async (productId: string) => {
  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    throw new AppError(404, 'Product not found');
  }

  const updated = await prisma.product.update({
    where: { id: productId },
    data: {
      isActive: !product.isActive,
      approvalStatus: product.isActive ? 'REJECTED' : 'APPROVED',
      rejectionReason: product.isActive ? 'Admin moderasyonu nedeniyle reddedildi.' : null,
    },
  });

  return updated;
};

export const setProductActive = async (productId: string, isActive: boolean) => {
  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    throw new AppError(404, 'Product not found');
  }

  const updated = await prisma.product.update({
    where: { id: productId },
    data: {
      isActive: Boolean(isActive),
      approvalStatus: isActive ? 'APPROVED' : 'REJECTED',
      rejectionReason: isActive ? null : product.rejectionReason || 'Admin moderasyonu nedeniyle reddedildi.',
    },
  });

  return updated;
};

export const deleteProductByAdmin = async (productId: string) => {
  const product = await prisma.product.findUnique({
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
    throw new AppError(404, 'Product not found');
  }

  await prisma.product.delete({
    where: { id: productId },
  });

  if (product.vendor?.userId) {
    await prisma.notification.create({
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

export const rejectProductForPricing = async (
  productId: string,
  reasonMessage: string,
  reasonTitle?: string
) => {
  const product = await prisma.product.findUnique({
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
    throw new AppError(404, 'Product not found');
  }

  const normalizedReason = String(reasonMessage || '').trim();
  if (normalizedReason.length < 5) {
    throw new AppError(400, 'Reason is required');
  }

  const updated = await prisma.product.update({
    where: { id: productId },
    data: {
      isActive: false,
      approvalStatus: 'REJECTED',
      rejectionReason: normalizedReason,
    },
  });

  if (product.vendor?.userId) {
    const title = String(reasonTitle || '').trim() || 'Fiyat duzeltmesi gerekli';
    await prisma.notification.create({
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

export const getOrders = async (
  status?: string,
  vendorId?: string,
  customerId?: string,
  cancelReason?: string,
  paymentStatus?: string,
  page: number = 1,
  limit: number = 20
) => {
  const skip = (page - 1) * limit;

  const where: any = {};

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
    prisma.order.findMany({
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
          where: { actionType: 'ORDER_CANCELLED' as any },
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
    prisma.order.count({ where }),
  ]);

  const orderIds = orders.map((item) => item.id);
  const supportConversations = orderIds.length
    ? await (prisma as any).supportConversation.findMany({
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

  const refundDetailMap = new Map<string, string>();
  const refundReasonTitleMap = new Map<string, string>();
  for (const conv of supportConversations as any[]) {
    const orderId = String(conv?.orderId || '').trim();
    if (!orderId || refundDetailMap.has(orderId)) continue;

    const subject = String(conv?.subject || '').trim();
    const subjectMatch = subject.match(/^İade talebi\s*\|\s*(.+)$/i);
    const subjectReasonTitle = String(subjectMatch?.[1] || '').trim();
    if (subjectReasonTitle) {
      refundReasonTitleMap.set(orderId, subjectReasonTitle);
    }

    const rawMessage = String(conv?.messages?.[0]?.body || '').trim();
    if (!rawMessage) continue;

    const normalizedMessage = rawMessage
      .replace(/^İade talebi\s*-\s*Sipariş\s*#[^\n]+\n*/i, '')
      .trim();

    refundDetailMap.set(orderId, normalizedMessage || rawMessage);
  }

  const enrichedOrders = orders.map((order: any) => {
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
    orders: attachOrderCodeList(enrichedOrders as any[]),
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  };
};

export const getOrderById = async (orderId: string) => {
  const order = await prisma.order.findUnique({
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
    throw new AppError(404, 'Order not found');
  }

  return attachOrderCode(order as any);
};

export const updateOrderStatus = async (orderId: string, status: string) => {
  const order = await prisma.order.findUnique({
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
    throw new AppError(404, 'Order not found');
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { status: status as any },
  });

  if (String(status || '').toUpperCase() === 'DELIVERED') {
    try {
      const customerEmail = String(order.customer?.email || '').trim();
      if (customerEmail) {
        await handleMailEvent(MailEvents.ORDER_DELIVERED, {
          email: customerEmail,
          name: String(order.customer?.name || 'Müşteri').trim() || 'Müşteri',
          orderId: String((updated as any).orderCode || orderId).trim(),
        });
      }
    } catch (error) {
      console.warn('[adminService] delivered mail failed:', error);
    }
  }

  return attachOrderCode(updated as any);
};

export const getPayouts = async (
  status?: string,
  page: number = 1,
  limit: number = 20
) => {
  const skip = (page - 1) * limit;
  const commissionRate = clampCommissionRate((await prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} })).commissionRate);

  const where: any = {};
  if (status) where.status = status;

  const [payouts, total] = await Promise.all([
    prisma.payout.findMany({
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
    prisma.payout.count({ where }),
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

export const getPayoutById = async (payoutId: string) => {
  const commissionRate = clampCommissionRate((await prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} })).commissionRate);
  const payout = await prisma.payout.findUnique({
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
    throw new AppError(404, 'Payout not found');
  }

  return mapPayoutWithFinancials(payout, commissionRate);
};

export const markPayoutAsPaid = async (payoutId: string) => {
  const payout = await prisma.payout.findUnique({
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
    throw new AppError(404, 'Payout not found');
  }

  const updated = await prisma.payout.update({
    where: { id: payoutId },
    data: { status: 'PAID' },
  });

  try {
    const userId = payout?.vendorProfile?.userId;
    if (userId) {
      await prisma.notification.create({
        data: {
          userId,
          type: 'ACCOUNT_UPDATE',
          title: 'Ödeme Hesabınıza Aktarıldı',
          message: `₺${Number(updated.amount || 0).toFixed(2)} tutarındaki ödeme talebiniz tamamlandı ve bankaya aktarım süreci başlatıldı.`,
        },
      });
    }
  } catch {
    // best effort notification
  }

  try {
    const vendorEmail = String(payout?.vendorProfile?.user?.email || '').trim();
    if (vendorEmail) {
      await handleMailEvent(MailEvents.PAYMENT_COMPLETED, {
        email: vendorEmail,
        amount: `₺${Number(updated.amount || 0).toFixed(2)}`,
      });
    }
  } catch (error) {
    console.warn('[adminService] payment completed mail failed:', error);
  }

  return updated;
};

// Notifications
export const getNotifications = async (userId: string, page: number = 1, limit: number = 20) => {
  const skip = (page - 1) * limit;

  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    skip,
    take: limit,
  });

  const total = await prisma.notification.count({
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

export const createNotification = async (
  adminId: string,
  title: string,
  message: string,
  type: string,
  targetUsers?: string[],
  targetAudience?: string
) => {
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
      type: normalizedType as any,
      title,
      message,
    }));

    const result = await prisma.notification.createMany({
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
  } else {
    const users = await prisma.user.findMany({
      where:
        normalizedAudience === 'CUSTOMERS'
          ? { role: 'CUSTOMER' }
          : normalizedAudience === 'VENDORS'
            ? { role: 'VENDOR' }
            : { role: { in: ['CUSTOMER', 'VENDOR'] } },
    });

    const notifications = users.map(user => ({
      userId: user.id,
      type: normalizedType as any,
      title,
      message,
    }));

    const result = await prisma.notification.createMany({
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

export const markNotificationAsRead = async (notificationId: string, userId: string) => {
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
  });

  if (!notification) {
    throw new AppError(404, 'Notification not found');
  }

  return await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });
};
