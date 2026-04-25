import prisma from '../config/db';
import { AppError } from '../middleware/errorHandler';

const TURKISH_CHAR_MAP: Record<string, string> = {
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

export type EffectiveVendorDeliverySettings = {
  deliveryMode: 'SELLER' | 'PLATFORM';
  deliveryCoverage: 'SELF' | 'PLATFORM';
  editableByVendor: boolean;
  source: 'SELLER' | 'PLATFORM_NEIGHBORHOOD';
  neighborhood: string | null;
  preparationMinutes: number;
  pickupMinutes: number;
  deliveryTotalMinutes: number;
  minimumOrderAmount: number | null;
  flatDeliveryFee: number | null;
  freeOverAmount: number | null;
  deliveryMinutes: number | null;
  deliveryMaxMinutes: number | null;
  pendingDeliveryCoverage: 'SELF' | 'PLATFORM' | null;
  deliveryCoverageChangeRequestedAt: Date | null;
  isMissingPlatformSetting: boolean;
  platformNeighborhoodSetting: null | {
    id: string;
    neighborhood: string;
    neighborhoodKey: string;
    minimumOrderAmount: number;
    deliveryFee: number;
    freeOverAmount: number | null;
    deliveryMinutes: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
};

type NeighborhoodSettingSource = 'SETTING' | 'VENDOR' | 'SETTING_AND_VENDOR';

type NeighborhoodSettingListItem = {
  id: string;
  neighborhood: string;
  neighborhoodKey: string;
  minimumOrderAmount: number;
  deliveryFee: number;
  freeOverAmount: number | null;
  deliveryMinutes: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  source: NeighborhoodSettingSource;
  isConfigured: boolean;
  vendorCount: number;
  lastVendorUpdatedAt: Date | null;
};

const normalizeMoney = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Number(amount.toFixed(2));
};

const normalizeDeliveryMinutes = (value: unknown): number | null => {
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes < 1) return null;
  return Math.round(minutes);
};

const normalizePreparationMinutes = (value: unknown): number | null => {
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes < 1) return null;
  return Math.round(minutes);
};

export const resolveVendorPreparationMinutes = (vendorProfile: any): number => {
  return normalizePreparationMinutes(vendorProfile?.preparationMinutes) ?? 15;
};

export const composeCustomerEtaMinutes = (params: {
  preparationMinutes: number;
  routeDeliveryMinutes: number | null;
  orderType?: 'DELIVERY' | 'PICKUP';
}) => {
  const preparationMinutes =
    normalizePreparationMinutes(params.preparationMinutes) ?? 15;
  const routeDeliveryMinutes = normalizeDeliveryMinutes(params.routeDeliveryMinutes);

  if (params.orderType === 'PICKUP') {
    return preparationMinutes;
  }

  return preparationMinutes + (routeDeliveryMinutes ?? 0);
};

export const normalizeNeighborhoodKey = (value?: string | null): string => {
  return String(value || '')
    .trim()
    .split('')
    .map((char) => TURKISH_CHAR_MAP[char] ?? char)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const normalizeDeliveryMode = (vendorProfile: any): 'SELLER' | 'PLATFORM' => {
  const explicit = String(vendorProfile?.deliveryMode || '')
    .trim()
    .toUpperCase();
  if (explicit === 'PLATFORM') return 'PLATFORM';
  if (explicit === 'SELLER') return 'SELLER';
  return String(vendorProfile?.deliveryCoverage || 'SELF').trim().toUpperCase() === 'PLATFORM'
    ? 'PLATFORM'
    : 'SELLER';
};

const mapPlatformSetting = (setting: any): NeighborhoodSettingListItem | null => {
  if (!setting) return null;
  return {
    id: String(setting.id),
    neighborhood: String(setting.neighborhood || ''),
    neighborhoodKey: String(setting.neighborhoodKey || ''),
    minimumOrderAmount: Number(setting.minimumOrderAmount || 0),
    deliveryFee: Number(setting.deliveryFee || 0),
    freeOverAmount: normalizeMoney(setting.freeOverAmount),
    deliveryMinutes: Number(setting.deliveryMinutes || 0),
    isActive: Boolean(setting.isActive),
    createdAt: setting.createdAt,
    updatedAt: setting.updatedAt,
    source: 'SETTING' as const,
    isConfigured: true,
    vendorCount: 0,
    lastVendorUpdatedAt: null as Date | null,
  };
};

const mapVendorNeighborhoodSeed = (vendorProfile: any): NeighborhoodSettingListItem | null => {
  const neighborhood = String(vendorProfile?.neighborhood || '').trim();
  const neighborhoodKey = normalizeNeighborhoodKey(neighborhood);

  if (!neighborhood || !neighborhoodKey) {
    return null;
  }

  return {
    id: `vendor-neighborhood:${neighborhoodKey}`,
    neighborhood,
    neighborhoodKey,
    minimumOrderAmount: normalizeMoney(vendorProfile?.minimumOrderAmount) ?? 0,
    deliveryFee: normalizeMoney(vendorProfile?.flatDeliveryFee) ?? 0,
    freeOverAmount: normalizeMoney(vendorProfile?.freeOverAmount),
    deliveryMinutes: normalizeDeliveryMinutes(vendorProfile?.deliveryMinutes) ?? 30,
    isActive: false,
    createdAt: vendorProfile?.createdAt ?? new Date(0),
    updatedAt: vendorProfile?.updatedAt ?? new Date(0),
    source: 'VENDOR' as const,
    isConfigured: false,
    vendorCount: 1,
    lastVendorUpdatedAt: vendorProfile?.updatedAt ?? vendorProfile?.createdAt ?? null,
  };
};

export const listPlatformNeighborhoodDeliverySettings = async (query?: string) => {
  const normalizedQuery = normalizeNeighborhoodKey(query);
  const [settings, vendorProfiles] = await Promise.all([
    prisma.platformNeighborhoodDeliverySetting.findMany({
      where: normalizedQuery
        ? {
            OR: [
              { neighborhoodKey: { contains: normalizedQuery } },
              { neighborhood: { contains: String(query || '').trim() } },
            ],
          }
        : undefined,
      orderBy: [{ neighborhood: 'asc' }],
    }),
    prisma.vendorProfile.findMany({
      where: {
        neighborhood: {
          not: null,
        },
      },
      select: {
        neighborhood: true,
        minimumOrderAmount: true,
        flatDeliveryFee: true,
        freeOverAmount: true,
        deliveryMinutes: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ updatedAt: 'desc' }],
    }),
  ]);

  const merged = new Map<string, NeighborhoodSettingListItem>();
  const vendorStats = new Map<string, { count: number; lastVendorUpdatedAt: Date | null }>();

  for (const vendorProfile of vendorProfiles) {
    const seed = mapVendorNeighborhoodSeed(vendorProfile);
    if (!seed) continue;

    const existingStat = vendorStats.get(seed.neighborhoodKey);
    const currentUpdatedAt = seed.lastVendorUpdatedAt ?? null;
    const lastVendorUpdatedAt = !existingStat?.lastVendorUpdatedAt
      ? currentUpdatedAt
      : currentUpdatedAt && currentUpdatedAt > existingStat.lastVendorUpdatedAt
        ? currentUpdatedAt
        : existingStat.lastVendorUpdatedAt;

    vendorStats.set(seed.neighborhoodKey, {
      count: (existingStat?.count ?? 0) + 1,
      lastVendorUpdatedAt,
    });
  }

  for (const setting of settings.map(mapPlatformSetting)) {
    if (!setting) continue;
    const stat = vendorStats.get(setting.neighborhoodKey);
    merged.set(setting.neighborhoodKey, setting);
    if (stat) {
      merged.set(setting.neighborhoodKey, {
        ...setting,
        source: 'SETTING_AND_VENDOR' as const,
        vendorCount: stat.count,
        lastVendorUpdatedAt: stat.lastVendorUpdatedAt,
      });
    }
  }

  for (const vendorProfile of vendorProfiles) {
    const seed = mapVendorNeighborhoodSeed(vendorProfile);
    if (!seed) continue;

    if (normalizedQuery) {
      const rawNeighborhood = String(seed.neighborhood || '').toLowerCase();
      const rawQuery = String(query || '').trim().toLowerCase();
      if (!seed.neighborhoodKey.includes(normalizedQuery) && !rawNeighborhood.includes(rawQuery)) {
        continue;
      }
    }

    if (!merged.has(seed.neighborhoodKey)) {
      const stat = vendorStats.get(seed.neighborhoodKey);
      merged.set(seed.neighborhoodKey, seed);
      if (stat) {
        merged.set(seed.neighborhoodKey, {
          ...seed,
          vendorCount: stat.count,
          lastVendorUpdatedAt: stat.lastVendorUpdatedAt,
        });
      }
    }
  }

  return Array.from(merged.values()).sort((left, right) =>
    String(left?.neighborhood || '').localeCompare(String(right?.neighborhood || ''), 'tr')
  );
};

export const upsertPlatformNeighborhoodDeliverySetting = async (input: {
  neighborhood: string;
  minimumOrderAmount: number;
  deliveryFee: number;
  freeOverAmount?: number | null;
  deliveryMinutes: number;
  isActive?: boolean;
}) => {
  const neighborhood = String(input.neighborhood || '').trim();
  const neighborhoodKey = normalizeNeighborhoodKey(neighborhood);

  if (!neighborhood || !neighborhoodKey) {
    throw new AppError(400, 'Neighborhood is required');
  }

  const setting = await prisma.platformNeighborhoodDeliverySetting.upsert({
    where: { neighborhoodKey },
    create: {
      neighborhood,
      neighborhoodKey,
      minimumOrderAmount: Number(input.minimumOrderAmount),
      deliveryFee: Number(input.deliveryFee),
      freeOverAmount: input.freeOverAmount ?? null,
      deliveryMinutes: Number(input.deliveryMinutes),
      isActive: input.isActive ?? true,
    },
    update: {
      neighborhood,
      minimumOrderAmount: Number(input.minimumOrderAmount),
      deliveryFee: Number(input.deliveryFee),
      freeOverAmount: input.freeOverAmount ?? null,
      deliveryMinutes: Number(input.deliveryMinutes),
      isActive: input.isActive ?? true,
    },
  });

  return mapPlatformSetting(setting);
};

export const getPlatformNeighborhoodSettingsMap = async (neighborhoods: Array<string | null | undefined>) => {
  const keys = Array.from(
    new Set(
      neighborhoods
        .map((value) => normalizeNeighborhoodKey(value))
        .filter(Boolean)
    )
  );

  const result = new Map<string, NeighborhoodSettingListItem>();
  if (keys.length === 0) {
    return result;
  }

  const settings = await prisma.platformNeighborhoodDeliverySetting.findMany({
    where: { neighborhoodKey: { in: keys } },
  });

  for (const setting of settings) {
    const mappedSetting = mapPlatformSetting(setting);
    if (!mappedSetting) continue;
    result.set(String(setting.neighborhoodKey), mappedSetting);
  }

  return result;
};

export const requirePlatformNeighborhoodSetting = async (
  neighborhood?: string | null,
  settingsMap?: Map<string, NeighborhoodSettingListItem>
) => {
  const normalizedNeighborhood = String(neighborhood || '').trim();
  const neighborhoodKey = normalizeNeighborhoodKey(normalizedNeighborhood);

  if (!neighborhoodKey) {
    throw new AppError(400, 'Vendor neighborhood is required for platform delivery');
  }

  const platformSetting = settingsMap?.get(neighborhoodKey) ?? mapPlatformSetting(
    await prisma.platformNeighborhoodDeliverySetting.findUnique({ where: { neighborhoodKey } })
  );

  if (!platformSetting) {
    throw new AppError(400, 'Platform delivery settings are not configured for vendor neighborhood');
  }

  if (!platformSetting.isActive) {
    throw new AppError(400, 'Platform delivery is disabled for vendor neighborhood');
  }

  return platformSetting;
};

export const ensurePlatformNeighborhoodSettingFromVendor = async (vendorProfile: any) => {
  const neighborhood = String(vendorProfile?.neighborhood || '').trim();
  const neighborhoodKey = normalizeNeighborhoodKey(neighborhood);

  if (!neighborhoodKey) {
    throw new AppError(400, 'Vendor neighborhood is required for platform delivery');
  }

  const existing = mapPlatformSetting(
    await prisma.platformNeighborhoodDeliverySetting.findUnique({ where: { neighborhoodKey } })
  );

  const minimumOrderAmount = normalizeMoney(vendorProfile?.minimumOrderAmount) ?? existing?.minimumOrderAmount ?? 0;
  const deliveryFee = normalizeMoney(vendorProfile?.flatDeliveryFee) ?? existing?.deliveryFee ?? 0;
  const freeOverAmount = normalizeMoney(vendorProfile?.freeOverAmount) ?? existing?.freeOverAmount ?? null;
  const deliveryMinutes = normalizeDeliveryMinutes(vendorProfile?.deliveryMinutes) ?? existing?.deliveryMinutes ?? 30;

  if (existing) {
    return upsertPlatformNeighborhoodDeliverySetting({
      neighborhood,
      minimumOrderAmount,
      deliveryFee,
      freeOverAmount,
      deliveryMinutes,
      isActive: true,
    });
  }

  return upsertPlatformNeighborhoodDeliverySetting({
    neighborhood,
    minimumOrderAmount,
    deliveryFee,
    freeOverAmount,
    deliveryMinutes,
    isActive: true,
  });
};

export const resolveEffectiveVendorDeliverySettings = async (
  vendorProfile: any,
  settingsMap?: Map<string, NeighborhoodSettingListItem>
): Promise<EffectiveVendorDeliverySettings> => {
  const deliveryMode = normalizeDeliveryMode(vendorProfile);
  const preparationMinutes = resolveVendorPreparationMinutes(vendorProfile);
  const neighborhood = String(vendorProfile?.neighborhood || '').trim() || null;
  const neighborhoodKey = normalizeNeighborhoodKey(neighborhood);
  const pendingCoverageRaw = String(vendorProfile?.pendingDeliveryCoverage || '').trim().toUpperCase();
  const pendingDeliveryCoverage = pendingCoverageRaw === 'SELF' || pendingCoverageRaw === 'PLATFORM'
    ? (pendingCoverageRaw as 'SELF' | 'PLATFORM')
    : null;

  if (deliveryMode === 'SELLER') {
    const routeDeliveryMinutes =
      typeof vendorProfile?.deliveryMinutes === 'number' ? Math.round(vendorProfile.deliveryMinutes) : null;
    const routeDeliveryMaxMinutesRaw =
      typeof vendorProfile?.deliveryMaxMinutes === 'number' ? Math.round(vendorProfile.deliveryMaxMinutes) : null;
    const routeDeliveryMaxMinutes =
      routeDeliveryMinutes == null
        ? routeDeliveryMaxMinutesRaw
        : routeDeliveryMaxMinutesRaw == null
          ? routeDeliveryMinutes
          : Math.max(routeDeliveryMinutes, routeDeliveryMaxMinutesRaw);
    return {
      deliveryMode,
      deliveryCoverage: 'SELF',
      editableByVendor: true,
      source: 'SELLER',
      neighborhood,
      preparationMinutes,
      pickupMinutes: preparationMinutes,
      deliveryTotalMinutes: composeCustomerEtaMinutes({
        preparationMinutes,
        routeDeliveryMinutes,
        orderType: 'DELIVERY',
      }),
      minimumOrderAmount: normalizeMoney(vendorProfile?.minimumOrderAmount),
      flatDeliveryFee: normalizeMoney(vendorProfile?.flatDeliveryFee),
      freeOverAmount: normalizeMoney(vendorProfile?.freeOverAmount),
      deliveryMinutes: routeDeliveryMinutes,
      deliveryMaxMinutes: routeDeliveryMaxMinutes,
      pendingDeliveryCoverage,
      deliveryCoverageChangeRequestedAt: vendorProfile?.deliveryCoverageChangeRequestedAt ?? null,
      isMissingPlatformSetting: false,
      platformNeighborhoodSetting: null,
    };
  }

  const platformSetting = neighborhoodKey
    ? settingsMap?.get(neighborhoodKey) ?? mapPlatformSetting(
        await prisma.platformNeighborhoodDeliverySetting.findUnique({ where: { neighborhoodKey } })
      )
    : null;

  const routeDeliveryMinutes = platformSetting ? Number(platformSetting.deliveryMinutes) : null;

  return {
    deliveryMode,
    deliveryCoverage: 'PLATFORM',
    editableByVendor: false,
    source: 'PLATFORM_NEIGHBORHOOD',
    neighborhood,
    preparationMinutes,
    pickupMinutes: preparationMinutes,
    deliveryTotalMinutes: composeCustomerEtaMinutes({
      preparationMinutes,
      routeDeliveryMinutes,
      orderType: 'DELIVERY',
    }),
    minimumOrderAmount: platformSetting ? Number(platformSetting.minimumOrderAmount) : null,
    flatDeliveryFee: platformSetting ? Number(platformSetting.deliveryFee) : null,
    freeOverAmount: platformSetting ? normalizeMoney(platformSetting.freeOverAmount) : null,
    deliveryMinutes: routeDeliveryMinutes,
    deliveryMaxMinutes: routeDeliveryMinutes,
    pendingDeliveryCoverage,
    deliveryCoverageChangeRequestedAt: vendorProfile?.deliveryCoverageChangeRequestedAt ?? null,
    isMissingPlatformSetting: !platformSetting || !platformSetting.isActive,
    platformNeighborhoodSetting: platformSetting,
  };
};

export const requireReadyPlatformNeighborhoodSettings = async (
  vendorProfile: any,
  settingsMap?: Map<string, NeighborhoodSettingListItem>
) => {
  const effective = await resolveEffectiveVendorDeliverySettings(vendorProfile, settingsMap);

  if (effective.deliveryMode !== 'PLATFORM') {
    return effective;
  }

  await requirePlatformNeighborhoodSetting(effective.neighborhood, settingsMap);

  return effective;
};