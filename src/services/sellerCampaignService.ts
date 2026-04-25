import prisma from '../config/db';
import { AppError } from '../middleware/errorHandler';
import { normalizeTrForCompare } from '../utils/trNormalize';

export type SellerCampaignStatusText = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'EXPIRED' | 'PASSIVE';

export type SellerCampaignSummary = {
  id: string;
  sellerId: string;
  minBasketAmount: number;
  discountAmount: number;
  startDate: string;
  endDate: string;
  usageLimit: number | null;
  usageCount: number;
  status: SellerCampaignStatusText;
  rejectReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export const CAMPAIGN_RULES = {
  minBasketAmountMin: 200,
  discountAmountMin: 20,
  maxDiscountRatio: 0.4,
  minDurationHours: 24,
  maxDurationDays: 30,
} as const;

const CAMPAIGN_NOTIFICATION_BATCH_SIZE = 250;

const toMoney = (value: unknown): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Number(n.toFixed(2));
};

const toIso = (value: Date | string | null | undefined): string => {
  const d = value instanceof Date ? value : new Date(String(value || ''));
  return Number.isFinite(d.getTime()) ? d.toISOString() : '';
};

const normalizeStatus = (value: unknown): SellerCampaignStatusText => {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'ACTIVE') return 'ACTIVE';
  if (normalized === 'REJECTED') return 'REJECTED';
  if (normalized === 'EXPIRED') return 'EXPIRED';
  if (normalized === 'PASSIVE') return 'PASSIVE';
  return 'PENDING';
};

const formatNotificationMoney = (value: unknown): string => {
  const amount = toMoney(value);
  return Number.isInteger(amount) ? `${amount.toFixed(0)} TL` : `${amount.toFixed(2)} TL`;
};

const TURKISH_THIN_VOWELS = new Set(['e', 'i', 'ö', 'ü']);
const TURKISH_HARD_CONSONANTS = new Set(['f', 's', 't', 'k', 'ç', 'ş', 'h', 'p']);

const toCampaignLocative = (shopName: string): string => {
  const normalizedShopName = String(shopName || '').trim();
  if (!normalizedShopName) return 'Mahalle Esnafında';

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

const buildCampaignApprovalNotificationTitle = (shopName: string, discountAmount: number): string => {
  return `${toCampaignLocative(shopName)} Sepette ${formatNotificationMoney(discountAmount)} indirim`;
};

const buildCampaignApprovalNotificationMessage = (shopName: string, discountAmount: number): string => {
  return `Mahallendeki ${shopName} yeni kampanya başlattı, sepette ${formatNotificationMoney(discountAmount)} indirim fırsatını kaçırma.`;
};

const getCustomerNotificationAudienceForCampaign = async (
  tx: any,
  sellerId: string
): Promise<{ shopName: string; userIds: string[] }> => {
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
  const targetCity = normalizeTrForCompare(seller?.city);
  const targetDistrict = normalizeTrForCompare(seller?.district);
  const targetNeighborhood = normalizeTrForCompare(seller?.neighborhood);

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

  const userIds: string[] = [];
  const seenUserIds = new Set<string>();

  for (const address of addresses as any[]) {
    const userId = String(address?.userId || '').trim();
    if (!userId || seenUserIds.has(userId)) continue;

    if (normalizeTrForCompare(address?.neighborhood) !== targetNeighborhood) continue;
    if (targetDistrict && normalizeTrForCompare(address?.district) !== targetDistrict) continue;
    if (targetCity && normalizeTrForCompare(address?.city) !== targetCity) continue;

    seenUserIds.add(userId);
    userIds.push(userId);
  }

  return { shopName, userIds };
};

const createCampaignApprovalNotifications = async (
  tx: any,
  params: {
    campaignId: string;
    sellerId: string;
    discountAmount: number;
  }
) => {
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

export const formatCampaignShortLabel = (minBasketAmount: number, discountAmount: number): string => {
  return `${toMoney(discountAmount)} TL Sepette`;
};

const toSummary = (campaign: any): SellerCampaignSummary => ({
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

export const validateCampaignInput = (input: {
  minBasketAmount: number;
  discountAmount: number;
  startDate: string;
  endDate: string;
  usageLimit?: number | null;
}) => {
  const minBasketAmount = toMoney(input.minBasketAmount);
  const discountAmount = toMoney(input.discountAmount);
  const usageLimit = input.usageLimit == null ? null : Number(input.usageLimit);
  const startDate = new Date(input.startDate);
  const endDate = new Date(input.endDate);

  if (!Number.isFinite(minBasketAmount) || minBasketAmount < CAMPAIGN_RULES.minBasketAmountMin) {
    throw new AppError(400, `Campaign minimum basket must be at least ${CAMPAIGN_RULES.minBasketAmountMin} TL`);
  }

  if (!Number.isFinite(discountAmount) || discountAmount < CAMPAIGN_RULES.discountAmountMin) {
    throw new AppError(400, `Campaign discount must be at least ${CAMPAIGN_RULES.discountAmountMin} TL`);
  }

  if (discountAmount / minBasketAmount > CAMPAIGN_RULES.maxDiscountRatio) {
    throw new AppError(400, 'Campaign discount ratio cannot exceed 40% of campaign minimum basket');
  }

  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) {
    throw new AppError(400, 'Invalid campaign start or end date');
  }

  const durationMs = endDate.getTime() - startDate.getTime();
  if (durationMs < CAMPAIGN_RULES.minDurationHours * 60 * 60 * 1000) {
    throw new AppError(400, 'Campaign duration must be at least 24 hours');
  }

  if (durationMs > CAMPAIGN_RULES.maxDurationDays * 24 * 60 * 60 * 1000) {
    throw new AppError(400, 'Campaign duration cannot exceed 30 days');
  }

  if (usageLimit != null && (!Number.isInteger(usageLimit) || usageLimit <= 0)) {
    throw new AppError(400, 'Usage limit must be a positive integer');
  }

  return {
    minBasketAmount,
    discountAmount,
    startDate,
    endDate,
    usageLimit,
  };
};

export const expireEndedSellerCampaigns = async () => {
  const now = new Date();
  await (prisma as any).sellerCampaign.updateMany({
    where: {
      status: 'ACTIVE',
      endDate: { lt: now },
    },
    data: { status: 'EXPIRED' },
  });
};

export const getActiveSellerCampaignForSeller = async (sellerId: string) => {
  await expireEndedSellerCampaigns();

  const now = new Date();
  const campaign = await (prisma as any).sellerCampaign.findFirst({
    where: {
      sellerId,
      status: 'ACTIVE',
      startDate: { lte: now },
      endDate: { gte: now },
    },
    orderBy: [{ createdAt: 'desc' }],
  });

  if (!campaign) return null;

  if (campaign.usageLimit != null && Number(campaign.usageCount || 0) >= Number(campaign.usageLimit)) {
    await (prisma as any).sellerCampaign.update({
      where: { id: campaign.id },
      data: { status: 'EXPIRED' },
    });
    return null;
  }

  return campaign;
};

export const getActiveSellerCampaignMapForSellers = async (sellerIds: string[]) => {
  await expireEndedSellerCampaigns();

  const uniqueSellerIds = Array.from(new Set((sellerIds || []).map((id) => String(id || '').trim()).filter(Boolean)));
  if (uniqueSellerIds.length === 0) return new Map<string, any>();

  const now = new Date();
  const campaigns = await (prisma as any).sellerCampaign.findMany({
    where: {
      sellerId: { in: uniqueSellerIds },
      status: 'ACTIVE',
      startDate: { lte: now },
      endDate: { gte: now },
    },
    orderBy: [{ updatedAt: 'desc' }],
  });

  const map = new Map<string, any>();
  for (const campaign of campaigns as any[]) {
    const sellerId = String(campaign.sellerId || '');
    if (!sellerId || map.has(sellerId)) continue;

    if (campaign.usageLimit != null && Number(campaign.usageCount || 0) >= Number(campaign.usageLimit)) {
      await (prisma as any).sellerCampaign.update({
        where: { id: campaign.id },
        data: { status: 'EXPIRED' },
      });
      continue;
    }

    map.set(sellerId, campaign);
  }

  return map;
};

export const getVendorCampaigns = async (userId: string) => {
  const vendor = await prisma.vendorProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!vendor) throw new AppError(404, 'Vendor profile not found');

  await expireEndedSellerCampaigns();

  const campaigns = await (prisma as any).sellerCampaign.findMany({
    where: { sellerId: vendor.id },
    orderBy: [{ createdAt: 'desc' }],
  });

  return (campaigns as any[]).map(toSummary);
};

export const createVendorCampaign = async (
  userId: string,
  input: {
    minBasketAmount: number;
    discountAmount: number;
    startDate: string;
    endDate: string;
    usageLimit?: number | null;
  }
) => {
  const vendor = await prisma.vendorProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!vendor) throw new AppError(404, 'Vendor profile not found');

  const payload = validateCampaignInput(input);

  const created = await prisma.$transaction(async (tx) => {
    await (tx as any).sellerCampaign.updateMany({
      where: { sellerId: vendor.id, status: 'ACTIVE' },
      data: { status: 'PASSIVE' },
    });

    return (tx as any).sellerCampaign.create({
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

export const updateVendorCampaign = async (
  userId: string,
  campaignId: string,
  input: {
    minBasketAmount: number;
    discountAmount: number;
    startDate: string;
    endDate: string;
    usageLimit?: number | null;
  }
) => {
  const vendor = await prisma.vendorProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!vendor) throw new AppError(404, 'Vendor profile not found');

  const existing = await (prisma as any).sellerCampaign.findUnique({ where: { id: campaignId } });
  if (!existing || String(existing.sellerId) !== String(vendor.id)) {
    throw new AppError(404, 'Campaign not found');
  }

  if (normalizeStatus(existing.status) === 'ACTIVE') {
    throw new AppError(400, 'Active campaign cannot be edited directly. Make it passive first.');
  }

  const payload = validateCampaignInput(input);

  const updated = await (prisma as any).sellerCampaign.update({
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

export const deleteVendorCampaign = async (userId: string, campaignId: string) => {
  const vendor = await prisma.vendorProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!vendor) throw new AppError(404, 'Vendor profile not found');

  const existing = await (prisma as any).sellerCampaign.findUnique({ where: { id: campaignId } });
  if (!existing || String(existing.sellerId) !== String(vendor.id)) {
    throw new AppError(404, 'Campaign not found');
  }

  if (normalizeStatus(existing.status) === 'ACTIVE') {
    throw new AppError(400, 'Active campaign cannot be deleted. Make it passive first.');
  }

  await (prisma as any).sellerCampaign.delete({ where: { id: campaignId } });
};

export const getAdminCampaigns = async (params: {
  status?: string;
  endingInDays?: number;
}) => {
  await expireEndedSellerCampaigns();

  const where: any = {};
  const status = String(params.status || '').trim().toUpperCase();
  if (status) where.status = status;

  if (Number.isFinite(params.endingInDays) && Number(params.endingInDays) > 0) {
    const now = new Date();
    const endLimit = new Date(now.getTime() + Number(params.endingInDays) * 24 * 60 * 60 * 1000);
    where.endDate = { gte: now, lte: endLimit };
  }

  const campaigns = await (prisma as any).sellerCampaign.findMany({
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

  const ids = (campaigns as any[]).map((c) => String(c.id));

  const orderAgg = ids.length
    ? await (prisma as any).order.groupBy({
        by: ['sellerCampaignId'],
        where: { sellerCampaignId: { in: ids } },
        _count: { _all: true },
        _sum: { campaignDiscount: true },
      })
    : [];

  const perfByCampaign = new Map<string, { orderCount: number; totalDiscount: number }>();
  for (const row of orderAgg as any[]) {
    const campaignId = String(row.sellerCampaignId || '').trim();
    if (!campaignId) continue;
    perfByCampaign.set(campaignId, {
      orderCount: Number(row?._count?._all || 0),
      totalDiscount: toMoney(row?._sum?.campaignDiscount || 0),
    });
  }

  return (campaigns as any[]).map((campaign) => {
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

export const updateAdminCampaignStatus = async (params: {
  campaignId: string;
  status: SellerCampaignStatusText;
  rejectReason?: string;
}) => {
  const campaign = await (prisma as any).sellerCampaign.findUnique({ where: { id: params.campaignId } });
  if (!campaign) throw new AppError(404, 'Campaign not found');

  const currentStatus = normalizeStatus(campaign.status);
  const nextStatus = normalizeStatus(params.status);
  const rejectReason = String(params.rejectReason || '').trim();
  const shouldNotifyCustomers = currentStatus === 'PENDING' && nextStatus === 'ACTIVE' && !campaign.customerNotifiedAt;

  if (nextStatus === 'REJECTED' && rejectReason.length < 3) {
    throw new AppError(400, 'Rejection reason is required');
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (nextStatus === 'ACTIVE') {
      await (tx as any).sellerCampaign.updateMany({
        where: {
          sellerId: campaign.sellerId,
          status: 'ACTIVE',
          id: { not: campaign.id },
        },
        data: { status: 'PASSIVE' },
      });
    }

    const updatedCampaign = await (tx as any).sellerCampaign.update({
      where: { id: campaign.id },
      data: {
        status: nextStatus,
        rejectReason: nextStatus === 'REJECTED' ? rejectReason : null,
      },
    });

    if (shouldNotifyCustomers) {
      await createCampaignApprovalNotifications(tx as any, {
        campaignId: String(campaign.id),
        sellerId: String(campaign.sellerId),
        discountAmount: Number(campaign.discountAmount || 0),
      });
    }

    return updatedCampaign;
  });

  return toSummary(updated);
};
