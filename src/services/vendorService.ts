import prisma from '../config/db';
import { AppError } from '../middleware/errorHandler';
import { paymentService } from '../modules/payment/payment.service';
import * as settingsService from './settingsService';
import {
  UpdateVendorProfileInput,
  UpdateBankAccountInput,
  UpdateVendorDeliverySettingsInput,
} from '../utils/validationSchemas';
import { attachOrderCode, attachOrderCodeList } from '../utils/orderCode';
import { resolveEffectiveVendorDeliverySettings } from './platformNeighborhoodDeliveryService';
import { clampCommissionRate, resolveOrderItemFinancials, toMoney } from '../utils/commission';
import { resolveVendorScopedCategoryMeta } from './subcategoryService';
import { createUserNotificationAndPush } from './userNotificationService';
import { handleMailEvent } from './mail/mailHandler';
import { MailEvents } from './mail/mailEvents';
import {
  enqueueProductProcessingJob,
  isProductProcessingQueueEnabled,
} from './productProcessingQueue';
import { processQueuedProductImage, QueuedProductImageInput } from './productImageProcessingService';
import sharp from 'sharp';
import {
  lookupOpenFoodFactsByBarcodeDetailed,
  OpenFoodFactsLookupError,
} from './openFoodFactsService';
import { BARCODE_INVALID_MESSAGE, normalizeBarcodeInput, validateBarcode } from '../utils/barcode';
import { mapBarcodeProductToMahallemCategory } from '../utils/categoryMapper';
import { cleanProductName } from '../utils/productNameCleaner';
import { logger } from '../utils/logger';
import { buildProductGroupInfo, buildSearchTokens } from '../utils/productIntelligence';

export const getProductReviews = async (productId: string, vendorUserId: string) => {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, vendorId: true, name: true },
  });
  if (!product) {
    throw new AppError(404, 'Product not found');
  }

  const vendor = await prisma.vendorProfile.findUnique({
    where: { userId: vendorUserId },
    select: { id: true },
  });
  if (!vendor || product.vendorId !== vendor.id) {
    throw new AppError(403, 'Unauthorized');
  }

  const reviews = await prismaAny.productReview.findMany({
    where: { productId },
    include: {
      customer: {
        select: { id: true, name: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return reviews.map((r: any) => ({
    id: r.id,
    productId: r.productId,
    productName: product.name,
    comment: r.comment,
    rating: typeof r.rating === 'number' ? r.rating : null,
    createdAt: r.createdAt,
    vendorReply: r.vendorReply ?? null,
    customer: r.customer ? { id: r.customer.id, name: r.customer.name } : null,
  }));
};

export const replyToProductReview = async (
  productId: string,
  reviewId: string,
  vendorUserId: string,
  reply: string
) => {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, vendorId: true },
  });
  if (!product) {
    throw new AppError(404, 'Product not found');
  }

  const vendor = await prisma.vendorProfile.findUnique({
    where: { userId: vendorUserId },
    select: { id: true },
  });
  if (!vendor || product.vendorId !== vendor.id) {
    throw new AppError(403, 'Unauthorized');
  }

  const existing = await prisma.productReview.findUnique({
    where: { id: reviewId },
    select: { id: true, productId: true },
  });
  if (!existing || existing.productId !== productId) {
    throw new AppError(404, 'Review not found');
  }

  return prismaAny.productReview.update({
    where: { id: reviewId },
    data: { vendorReply: String(reply).trim() },
  });
};

const prismaAny = prisma as any;

const SETTLED_ORDER_FILTER = {
  status: 'DELIVERED' as const,
  paymentStatus: 'PAID' as const,
};

const VENDOR_VISIBLE_PAYMENT_STATUSES = ['PAID', 'REFUNDED'] as const;

const isPrismaSchemaDriftError = (error: unknown): boolean => {
  const code = String((error as any)?.code || '').toUpperCase();
  if (code === 'P2021' || code === 'P2022') {
    return true;
  }

  const message = String((error as any)?.message || error || '').toLowerCase();
  return (
    message.includes('does not exist') ||
    message.includes('unknown column') ||
    message.includes('no such table') ||
    message.includes('no such column') ||
    message.includes('invalid `prisma.')
  );
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
const SPECIAL_CATEGORY_SLUG = 'ozel-urunler';
const BARCODE_LOOKUP_OFF_FALLBACK_ENABLED = String(process.env.BARCODE_ENABLE_OFF_FALLBACK || '1') !== '0';
const BARCODE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const BARCODE_IMAGE_MIN_WIDTH = Math.max(80, Number(process.env.BARCODE_IMAGE_MIN_WIDTH || 240));
const BARCODE_IMAGE_MIN_HEIGHT = Math.max(80, Number(process.env.BARCODE_IMAGE_MIN_HEIGHT || 240));
const BARCODE_REFRESH_TIMEOUT_MS = Math.max(2000, Number(process.env.BARCODE_REFRESH_TIMEOUT_MS || 10000));

const barcodeLookupInFlight = new Map<string, Promise<BarcodeLookupResult>>();

const normalizeBarcode = (value: unknown): string => normalizeBarcodeInput(value);
type BarcodeLookupSource = 'database' | 'open_food_facts' | 'barcode_cache' | 'global_pool';
type BarcodeLookupStatus = 'found' | 'not_found' | 'invalid' | 'timeout' | 'api_error';
type BarcodeLookupErrorCode = 'invalid_barcode' | 'not_found' | 'duplicate' | 'api_error' | 'timeout';

type BarcodeLookupResult = {
  found: boolean;
  source: BarcodeLookupSource;
  normalizedBarcode: string;
  lookupStatus: BarcodeLookupStatus;
  errorCode: BarcodeLookupErrorCode | null;
  alreadyExistsInVendorStore: boolean;
  productId: string | null;
  product: {
    barcode: string;
    name: string;
    brand: string;
    imageUrl: string;
    quantity: string;
    category: string;
    suggestedCategory: string;
    categoryConfidence: number;
    matchedKeywords: string[];
    categoryMappingSource: 'local-category-mapper' | 'vendor-catalog' | 'barcode-learning';
    source: 'mahallem_db' | 'barcode_api';
    barcodeLookupStatus: BarcodeLookupStatus;
  } | null;
};

const DOCUMENT_REVIEW_RESET_MAP: Record<string, { statusField: string; noteField: string; verifiedField?: string }> = {
  taxSheetUrl: {
    statusField: 'taxSheetReviewStatus',
    noteField: 'taxSheetReviewNote',
    verifiedField: 'taxSheetVerified',
  },
  residenceDocUrl: {
    statusField: 'residenceDocReviewStatus',
    noteField: 'residenceDocReviewNote',
    verifiedField: 'residenceVerified',
  },
  idPhotoFrontUrl: {
    statusField: 'idPhotoFrontReviewStatus',
    noteField: 'idPhotoFrontReviewNote',
  },
  idPhotoBackUrl: {
    statusField: 'idPhotoBackReviewStatus',
    noteField: 'idPhotoBackReviewNote',
  },
};

const slugify = (input: string) => {
  const map: Record<string, string> = {
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

  return input
    .trim()
    .split('')
    .map((ch) => map[ch] ?? ch)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
};

function resolveProductCategoryMeta(
  vendor: { id: string; businessType: string; categoryId?: string | null },
  data: any,
  required: true
): Promise<{ category: { id: string; slug: string }; subCategory: { id: string; slug: string } | null }>;
function resolveProductCategoryMeta(
  vendor: { id: string; businessType: string; categoryId?: string | null },
  data: any,
  required: false
): Promise<{ category: { id: string; slug: string }; subCategory: { id: string; slug: string } | null } | undefined>;
async function resolveProductCategoryMeta(
  vendor: { id: string; businessType: string; categoryId?: string | null },
  data: any,
  required: boolean
) {
  const normalizedCategoryName = String(data.categoryName || data.category || '').trim();
  const submissionSource = String(data.submissionSource || '').toUpperCase();
  const isAdvancedSubmission = submissionSource === 'ADVANCED';
  const isSpecialCategoryRequested =
    String(data.categoryId || '').trim() === SPECIAL_CATEGORY_SLUG ||
    slugify(normalizedCategoryName) === SPECIAL_CATEGORY_SLUG;

  const shouldResolve =
    required ||
    Boolean(
      String(data.categoryId || '').trim() ||
        normalizedCategoryName ||
        String(data.subCategoryId || data.subcategoryId || '').trim() ||
        String(data.subCategoryName || '').trim()
    );

  if (!shouldResolve) {
    return undefined;
  }

  if (isAdvancedSubmission && isSpecialCategoryRequested) {
    const specialCategory = await prisma.category.upsert({
      where: { slug: SPECIAL_CATEGORY_SLUG },
      update: {
        name: 'Ozel Urunler',
        icon: 'sparkles',
        image: 'market.jpg',
        isCustom: false,
        isActive: true,
      },
      create: {
        name: 'Ozel Urunler',
        slug: SPECIAL_CATEGORY_SLUG,
        icon: 'sparkles',
        image: 'market.jpg',
        isCustom: false,
        isActive: true,
      },
    });

    return {
      category: { id: specialCategory.id, slug: specialCategory.slug },
      subCategory: null,
    };
  }

  const categoryResolutionInput = {
    ...data,
    categoryName: normalizedCategoryName || data.categoryName,
  };

  const meta = await resolveVendorScopedCategoryMeta(vendor, categoryResolutionInput, required);
  if (!meta?.subCategory) {
    throw new AppError(400, 'Alt kategori zorunludur');
  }

  return {
    category: { id: meta.category.id, slug: meta.category.slug },
    subCategory: { id: meta.subCategory.id, slug: meta.subCategory.slug },
  };
}

export const getVendorProfile = async (userId: string) => {
  const vendor = await prismaAny.vendorProfile.findUnique({
    where: { userId },
    include: {
      storeImages: { orderBy: { createdAt: 'desc' } },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
    },
  } as any);

  if (!vendor) {
    throw new AppError(404, 'Vendor profile not found');
  }

  return vendor;
};

export const updateVendorProfile = async (
  userId: string,
  data: UpdateVendorProfileInput
) => {
  const vendor = await prisma.vendorProfile.findUnique({
    where: { userId },
  });

  if (!vendor) {
    throw new AppError(404, 'Vendor profile not found');
  }

  const effectiveDeliverySettings = await resolveEffectiveVendorDeliverySettings(vendor);
  const requestedModeRaw = String((data as any).deliveryMode || '').trim().toLowerCase();
  const requestedMode =
    requestedModeRaw === 'platform'
      ? 'PLATFORM'
      : requestedModeRaw === 'seller'
        ? 'SELLER'
        : null;

  if (requestedMode && requestedMode !== effectiveDeliverySettings.deliveryMode) {
    throw new AppError(400, 'Use delivery coverage change request for delivery model changes');
  }

  const deliveryMinutesInput =
    (data as any).deliveryMinutes === undefined ? undefined : (data as any).deliveryMinutes ?? null;
  const deliveryMaxMinutesInput =
    (data as any).deliveryMaxMinutes === undefined ? undefined : (data as any).deliveryMaxMinutes ?? null;

  if (
    deliveryMinutesInput != null &&
    deliveryMaxMinutesInput != null &&
    Number(deliveryMaxMinutesInput) < Number(deliveryMinutesInput)
  ) {
    throw new AppError(400, 'Teslimat maksimum dakika, minimum dakikadan kucuk olamaz');
  }

  const tcKimlikRaw = (data as any).tcKimlik;
  const tcKimlikNormalized =
    typeof tcKimlikRaw === 'string' ? String(tcKimlikRaw).replace(/\D/g, '').trim() : '';

  if (typeof tcKimlikRaw === 'string') {
    if (tcKimlikNormalized.length !== 11) {
      throw new AppError(400, 'TC Kimlik must be 11 digits');
    }

    const existingTcKimlik = await prisma.vendorProfile.findFirst({
      where: {
        tcKimlik: tcKimlikNormalized,
        id: { not: vendor.id },
      },
      select: { id: true },
    });

    if (existingTcKimlik) {
      throw new AppError(400, 'TC Kimlik already registered');
    }
  }

  const hasStructuredAddress =
    typeof (data as any).country !== 'undefined' ||
    typeof (data as any).city !== 'undefined' ||
    typeof (data as any).district !== 'undefined' ||
    typeof (data as any).neighborhood !== 'undefined' ||
    typeof (data as any).addressLine !== 'undefined' ||
    typeof (data as any).latitude !== 'undefined' ||
    typeof (data as any).longitude !== 'undefined';

  const computedAddress = (() => {
    const parts = [
      (data as any).addressLine,
      (data as any).neighborhood,
      (data as any).district,
      (data as any).city,
      (data as any).country,
    ]
      .map((p: any) => String(p || '').trim())
      .filter(Boolean);
    return parts.join(', ') || undefined;
  })();

  const documentReviewResetData = Object.entries(DOCUMENT_REVIEW_RESET_MAP).reduce(
    (acc, [urlField, config]) => {
      if (!Object.prototype.hasOwnProperty.call(data, urlField)) {
        return acc;
      }

      const nextUrl = String((data as any)[urlField] || '').trim();
      const currentUrl = String((vendor as any)[urlField] || '').trim();
      if (!nextUrl || nextUrl === currentUrl) {
        return acc;
      }

      acc[config.statusField] = 'PENDING';
      acc[config.noteField] = null;
      if (config.verifiedField) {
        acc[config.verifiedField] = false;
      }
      return acc;
    },
    {} as Record<string, any>
  );

  const shouldResetAddressVerification =
    Object.prototype.hasOwnProperty.call(data, 'address') ||
    Object.prototype.hasOwnProperty.call(data, 'addressLine') ||
    Object.prototype.hasOwnProperty.call(data, 'city') ||
    Object.prototype.hasOwnProperty.call(data, 'district') ||
    Object.prototype.hasOwnProperty.call(data, 'neighborhood');

  const hasIncomingFlatDeliveryFee = Object.prototype.hasOwnProperty.call(data, 'flatDeliveryFee');
  const hasIncomingFreeOverAmount = Object.prototype.hasOwnProperty.call(data, 'freeOverAmount');
  const effectiveFlatDeliveryFee = hasIncomingFlatDeliveryFee
    ? Number((data as any).flatDeliveryFee ?? 0)
    : Number((vendor as any).flatDeliveryFee ?? 0);
  const shouldDisableFreeOverAmount =
    effectiveDeliverySettings.deliveryMode !== 'PLATFORM' &&
    Number.isFinite(effectiveFlatDeliveryFee) &&
    effectiveFlatDeliveryFee <= 0;

  const updated = await prisma.vendorProfile.update({
    where: { userId },
    data: {
      ...(data.shopName && { shopName: data.shopName }),
      ...(data.address && { address: data.address }),
      ...(!data.address && hasStructuredAddress && computedAddress
        ? { address: computedAddress }
        : {}),

      ...((data as any).country !== undefined && { country: (data as any).country || null }),
      ...((data as any).city !== undefined && { city: (data as any).city || null }),
      ...((data as any).district !== undefined && { district: (data as any).district || null }),
      ...((data as any).neighborhood !== undefined && { neighborhood: (data as any).neighborhood || null }),
      ...((data as any).addressLine !== undefined && { addressLine: (data as any).addressLine || null }),
      ...((data as any).latitude !== undefined && { latitude: (data as any).latitude ?? null }),
      ...((data as any).longitude !== undefined && { longitude: (data as any).longitude ?? null }),
      ...(data.taxNumber && { taxNumber: data.taxNumber }),
      ...(data.taxOffice && { taxOffice: data.taxOffice }),
      ...(data.taxSheetUrl && { taxSheetUrl: data.taxSheetUrl }),
      ...((data as any).residenceDocUrl && { residenceDocUrl: (data as any).residenceDocUrl }),
      ...((data as any).idPhotoFrontUrl && { idPhotoFrontUrl: (data as any).idPhotoFrontUrl }),
      ...((data as any).idPhotoBackUrl && { idPhotoBackUrl: (data as any).idPhotoBackUrl }),
      ...((data as any).tcKimlik && { tcKimlik: tcKimlikNormalized }),
      ...((data as any).birthDate && { birthDate: (data as any).birthDate }),

      ...((data as any).storeAbout !== undefined && { storeAbout: (data as any).storeAbout || null }),
      ...((data as any).openingTime !== undefined && { openingTime: (data as any).openingTime || null }),
      ...((data as any).closingTime !== undefined && { closingTime: (data as any).closingTime || null }),
      ...((data as any).storeCoverImageUrl !== undefined && { storeCoverImageUrl: (data as any).storeCoverImageUrl || null }),
      ...((data as any).storeLogoImageUrl !== undefined && { storeLogoImageUrl: (data as any).storeLogoImageUrl || null }),
      ...((data as any).storeOpenOverride !== undefined && { storeOpenOverride: (data as any).storeOpenOverride }),
      ...((data as any).preparationMinutes !== undefined && {
        preparationMinutes: (data as any).preparationMinutes ?? null,
      }),
      ...((data as any).deliveryMinutes !== undefined && effectiveDeliverySettings.deliveryMode !== 'PLATFORM' && {
        deliveryMinutes: (data as any).deliveryMinutes ?? null,
      }),
      ...((data as any).deliveryMaxMinutes !== undefined && effectiveDeliverySettings.deliveryMode !== 'PLATFORM' && {
        deliveryMaxMinutes:
          (data as any).deliveryMaxMinutes ??
          ((data as any).deliveryMinutes !== undefined ? (data as any).deliveryMinutes ?? null : null),
      }),
      ...((data as any).minimumOrderAmount !== undefined && effectiveDeliverySettings.deliveryMode !== 'PLATFORM' && {
        minimumOrderAmount: (data as any).minimumOrderAmount ?? null,
      }),
      ...(requestedMode !== null && {
        deliveryMode: requestedMode,
        deliveryCoverage: requestedMode === 'PLATFORM' ? 'PLATFORM' : 'SELF',
      }),
      ...((data as any).flatDeliveryFee !== undefined && effectiveDeliverySettings.deliveryMode !== 'PLATFORM' && {
        flatDeliveryFee: (data as any).flatDeliveryFee ?? null,
      }),
      ...((hasIncomingFreeOverAmount || shouldDisableFreeOverAmount) && effectiveDeliverySettings.deliveryMode !== 'PLATFORM' && {
        freeOverAmount: shouldDisableFreeOverAmount ? null : (data as any).freeOverAmount ?? null,
      }),
      ...((data as any).isActive !== undefined && { isActive: Boolean((data as any).isActive) }),
      ...(shouldResetAddressVerification ? { addressVerified: false } : {}),
      ...documentReviewResetData,
    },
  });

  try {
    await paymentService.syncVendorSubmerchantReadiness(vendor.id, 'vendor_profile_update');
  } catch (error) {
    console.warn('[vendorService] vendor profile submerchant sync failed:', error);
  }

  return updated;
};

export const getVendorDeliverySettings = async (userId: string) => {
  const vendor = await prisma.vendorProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      deliveryMode: true,
      deliveryCoverage: true,
      pendingDeliveryCoverage: true,
      deliveryCoverageChangeRequestedAt: true,
      neighborhood: true,
      preparationMinutes: true,
      deliveryMinutes: true,
      deliveryMaxMinutes: true,
      minimumOrderAmount: true,
      flatDeliveryFee: true,
      freeOverAmount: true,
      isActive: true,
      shopName: true,
    },
  });

  if (!vendor) {
    throw new AppError(404, 'Vendor profile not found');
  }

  const settings = await settingsService.getSettings();
  const effective = await resolveEffectiveVendorDeliverySettings(vendor);

  return {
    vendorProfileId: vendor.id,
    shopName: vendor.shopName,
    deliveryMode: String(effective.deliveryMode || 'SELLER').toLowerCase(),
    deliveryCoverage: effective.deliveryCoverage,
    pendingDeliveryCoverage: effective.pendingDeliveryCoverage,
    deliveryCoverageChangeRequestedAt: effective.deliveryCoverageChangeRequestedAt,
    neighborhood: effective.neighborhood,
    preparationMinutes: effective.preparationMinutes,
    pickupMinutes: effective.pickupMinutes,
    deliveryTotalMinutes: effective.deliveryTotalMinutes,
    minimumOrderAmount: effective.minimumOrderAmount,
    flatDeliveryFee: effective.flatDeliveryFee,
    freeOverAmount: effective.freeOverAmount,
    deliveryMinutes: effective.deliveryMinutes,
    deliveryMaxMinutes: effective.deliveryMaxMinutes,
    isActive: Boolean((vendor as any).isActive ?? true),
    canEditDeliveryPricing: effective.editableByVendor,
    deliverySource: effective.source,
    missingPlatformNeighborhoodSetting: effective.isMissingPlatformSetting,
    platformNeighborhoodSetting: effective.platformNeighborhoodSetting,
    sellerManagedValues: {
      preparationMinutes: (vendor as any).preparationMinutes ?? null,
      deliveryMinutes: (vendor as any).deliveryMinutes ?? null,
      deliveryMaxMinutes: (vendor as any).deliveryMaxMinutes ?? null,
      minimumOrderAmount: (vendor as any).minimumOrderAmount ?? null,
      flatDeliveryFee: (vendor as any).flatDeliveryFee ?? null,
      freeOverAmount: (vendor as any).freeOverAmount ?? null,
    },
    platformMinBasketAmount:
      effective.platformNeighborhoodSetting?.minimumOrderAmount ?? Number((settings as any)?.minOrderAmount ?? 0),
    platformDeliveryFee:
      effective.platformNeighborhoodSetting?.deliveryFee ?? Number((settings as any)?.defaultStoreFee ?? 0),
    defaultStoreFee: Number((settings as any)?.defaultStoreFee ?? 0),
    platformDeliveryEnabled: Boolean((settings as any)?.platformDeliveryEnabled ?? false),
  };
};

export const updateVendorDeliverySettings = async (
  userId: string,
  data: UpdateVendorDeliverySettingsInput
) => {
  const vendor = await prisma.vendorProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      userId: true,
      deliveryMode: true,
      deliveryCoverage: true,
      pendingDeliveryCoverage: true,
      deliveryCoverageChangeRequestedAt: true,
      neighborhood: true,
      preparationMinutes: true,
      deliveryMinutes: true,
      deliveryMaxMinutes: true,
      minimumOrderAmount: true,
      flatDeliveryFee: true,
      freeOverAmount: true,
      isActive: true,
    },
  });

  if (!vendor) {
    throw new AppError(404, 'Vendor profile not found');
  }

  const effective = await resolveEffectiveVendorDeliverySettings(vendor);
  const requestedMode = data.deliveryMode
    ? data.deliveryMode === 'platform'
      ? 'PLATFORM'
      : 'SELLER'
    : null;

  if (requestedMode && requestedMode !== effective.deliveryMode) {
    throw new AppError(400, 'Use delivery coverage change request for delivery model changes');
  }

  const hasIncomingFlatDeliveryFee = Object.prototype.hasOwnProperty.call(data, 'flatDeliveryFee');
  const hasIncomingFreeOverAmount = Object.prototype.hasOwnProperty.call(data, 'freeOverAmount');
  const effectiveFlatDeliveryFee = hasIncomingFlatDeliveryFee
    ? Number(data.flatDeliveryFee ?? 0)
    : Number(effective.flatDeliveryFee ?? 0);
  const shouldDisableFreeOverAmount =
    effective.deliveryMode === 'SELLER' &&
    Number.isFinite(effectiveFlatDeliveryFee) &&
    effectiveFlatDeliveryFee <= 0;

  await prisma.vendorProfile.update({
    where: { userId },
    data: {
      ...(effective.deliveryMode === 'SELLER' && data.minimumOrderAmount !== undefined
        ? { minimumOrderAmount: data.minimumOrderAmount }
        : {}),
      ...(effective.deliveryMode === 'SELLER' && data.flatDeliveryFee !== undefined
        ? { flatDeliveryFee: data.flatDeliveryFee }
        : {}),
      ...(effective.deliveryMode === 'SELLER' && (hasIncomingFreeOverAmount || shouldDisableFreeOverAmount)
        ? { freeOverAmount: shouldDisableFreeOverAmount ? null : data.freeOverAmount }
        : {}),
      ...(data.isActive !== undefined ? { isActive: Boolean(data.isActive) } : {}),
    },
  });

  return getVendorDeliverySettings(userId);
};

export const requestDeliveryCoverageChange = async (
  userId: string,
  requested: 'SELF' | 'PLATFORM'
) => {
  const vendor = await prisma.vendorProfile.findUnique({
    where: { userId },
  });

  if (!vendor) {
    throw new AppError(404, 'Vendor profile not found');
  }

  if (requested !== 'SELF' && requested !== 'PLATFORM') {
    throw new AppError(400, 'Invalid delivery coverage option');
  }

  if (requested === 'PLATFORM') {
    const settings = await settingsService.getSettings();
    if (!Boolean((settings as any)?.platformDeliveryEnabled ?? false)) {
      throw new AppError(400, 'Platform delivery is currently disabled by admin');
    }
  }

  const current = String((vendor as any).deliveryCoverage || 'PLATFORM');
  const pending = (vendor as any).pendingDeliveryCoverage as string | null | undefined;

  if (pending) {
    throw new AppError(409, 'A delivery coverage change request is already pending');
  }

  if (current === requested) {
    throw new AppError(400, 'Requested delivery coverage is already active');
  }

  const updated = await prisma.vendorProfile.update({
    where: { userId },
    data: {
      pendingDeliveryCoverage: requested,
      deliveryCoverageChangeRequestedAt: new Date(),
    },
  });

  // Notify admins (best-effort)
  try {
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
    for (const admin of admins) {
      await prisma.notification.create({
        data: {
          userId: admin.id,
          type: 'ACCOUNT_UPDATE',
          title: 'Teslimat Seçeneği Değişikliği Talebi',
          message: `${vendor.shopName || 'Satıcı'} teslimat seçeneğini değiştirmek için talep oluşturdu.`,
        },
      });
    }
  } catch {
    // ignore
  }

  return updated;
};

export const getBankAccount = async (userId: string) => {
  const vendor = await prismaAny.vendorProfile.findUnique({
    where: { userId },
    select: {
      iban: true,
      bankName: true,
      ibanStatus: true,
    },
  } as any);

  if (!vendor) {
    throw new AppError(404, 'Vendor profile not found');
  }

  return vendor;
};

export const updateBankAccount = async (
  userId: string,
  data: UpdateBankAccountInput
) => {
  const vendor = await prismaAny.vendorProfile.findUnique({
    where: { userId },
  } as any);

  if (!vendor) {
    throw new AppError(404, 'Vendor profile not found');
  }

  const ibanStatus = String((vendor as any).ibanStatus || 'CHANGE_OPEN');
  if (ibanStatus !== 'CHANGE_OPEN') {
    throw new AppError(403, 'IBAN bilgisi değiştirilemez. Değişiklik için admin onayı gerekir.');
  }

  const isAdminOpenedChangeFlow = Boolean((vendor as any).ibanChangeRequestedAt);

  const normalizedIban = String(data.iban || '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
  const normalizedBankName = String(data.bankName || '').trim();

  const updated = await prismaAny.vendorProfile.update({
    where: { userId },
    data: {
      iban: normalizedIban,
      bankName: normalizedBankName,
      // First-time submission: WAITING_APPROVAL (admin approves)
      // Change submission after admin opens change: auto-complete
      ibanStatus: isAdminOpenedChangeFlow ? 'COMPLETED' : 'WAITING_APPROVAL',
      ibanChangeRequestedAt: null,
    },
  } as any);

  if (String((updated as any)?.ibanStatus || '') === 'COMPLETED') {
    try {
      await paymentService.syncVendorSubmerchantReadiness(String((updated as any).id), 'vendor_profile_update');
    } catch (error) {
      console.warn('[vendorService] bank account submerchant sync failed:', error);
    }
  }

  return updated;
};

export const requestIbanChange = async (userId: string) => {
  const vendor = await prismaAny.vendorProfile.findUnique({ where: { userId } } as any);
  if (!vendor) {
    throw new AppError(404, 'Vendor profile not found');
  }

  const ibanStatus = String((vendor as any).ibanStatus || 'CHANGE_OPEN');
  if (ibanStatus !== 'COMPLETED') {
    throw new AppError(400, 'IBAN değişikliği talebi şu an oluşturulamaz.');
  }

  const updated = await prismaAny.vendorProfile.update({
    where: { userId },
    data: { ibanChangeRequestedAt: new Date() },
    select: { id: true, ibanStatus: true, ibanChangeRequestedAt: true },
  } as any);

  return updated;
};

export const getPayouts = async (
  userId: string,
  status?: string,
  page: number = 1,
  limit: number = 20
) => {
  const normalizedUserId = String(userId || '').trim();
  if (!normalizedUserId) {
    throw new AppError(400, 'sellerId is required');
  }

  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);

  const vendor = await prisma.vendorProfile.findUnique({
    where: { userId: normalizedUserId },
    select: { id: true },
  });

  if (!vendor) {
    throw new AppError(404, 'Vendor profile not found');
  }

  const skip = (safePage - 1) * safeLimit;
  const where: any = { vendorProfileId: vendor.id };
  if (status) where.status = status;

  const commissionRate = clampCommissionRate((await settingsService.getSettings())?.commissionRate);

  let payouts: any[] = [];
  let total = 0;
  let availableOrderItems: any[] = [];
  let settledOrderItems: any[] = [];

  try {
    const result = await Promise.all([
      prisma.payout.findMany({
        where,
        include: {
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
        take: safeLimit,
      }),
      prisma.payout.count({ where }),
      prisma.orderItem.findMany({
        where: {
          vendorId: vendor.id,
          order: SETTLED_ORDER_FILTER,
          payoutItems: { none: {} },
        },
        select: {
          id: true,
          subtotal: true,
          commissionRateSnapshot: true,
          commissionAmount: true,
          vendorNetAmount: true,
        },
      }),
      prisma.orderItem.findMany({
        where: {
          vendorId: vendor.id,
          order: SETTLED_ORDER_FILTER,
        },
        select: {
          id: true,
          subtotal: true,
          commissionRateSnapshot: true,
          commissionAmount: true,
          vendorNetAmount: true,
        },
      }),
    ]);

    payouts = result[0] as any[];
    total = Number(result[1] || 0);
    availableOrderItems = result[2] as any[];
    settledOrderItems = result[3] as any[];
  } catch (error) {
    if (!isPrismaSchemaDriftError(error)) {
      throw error;
    }

    logger.error('[vendorService.getPayouts] schema drift fallback applied', {
      vendorId: vendor.id,
      error: String((error as any)?.message || error),
    });
  }

  const mappedPayouts = payouts.map((payout) => mapPayoutWithFinancials(payout, commissionRate));
  const availableSummary = summarizeFinancialOrderItems(availableOrderItems, commissionRate);
  const settledSummary = summarizeFinancialOrderItems(settledOrderItems, commissionRate);
  const pendingAmount = mappedPayouts
    .filter((payout) => payout.status === 'PENDING' || payout.status === 'PROCESSING')
    .reduce((sum, payout) => toMoney(sum + Number(payout.amount || 0)), 0);
  const paidAmount = mappedPayouts
    .filter((payout) => payout.status === 'PAID')
    .reduce((sum, payout) => toMoney(sum + Number(payout.amount || 0)), 0);

  return {
    payouts: mappedPayouts,
    summary: {
      availableAmount: availableSummary.netAmount,
      pendingAmount,
      paidAmount,
      totalNetEarnings: settledSummary.netAmount,
      totalCommissionAmount: settledSummary.commissionAmount,
      totalGrossSales: settledSummary.grossAmount,
      commissionRate,
    },
    pagination: {
      total,
      page: safePage,
      limit: safeLimit,
      pages: Math.ceil(total / safeLimit),
    },
  };
};

export const getPayoutById = async (userId: string, payoutId: string) => {
  const vendor = await prisma.vendorProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!vendor) {
    throw new AppError(404, 'Vendor profile not found');
  }

  const payout = await prisma.payout.findFirst({
    where: { id: payoutId, vendorProfileId: vendor.id },
    include: {
      items: {
        include: {
          order: true,
          orderItem: {
            include: { product: { select: { id: true, name: true } } },
          },
        },
      },
    },
  });

  if (!payout) {
    throw new AppError(404, 'Payout not found');
  }

  const commissionRate = clampCommissionRate((await settingsService.getSettings())?.commissionRate);
  return mapPayoutWithFinancials(payout, commissionRate);
};

export const createPayoutRequest = async (userId: string, amount: number) => {
  const vendor = await prisma.vendorProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      iban: true,
      bankName: true,
      user: {
        select: {
          email: true,
        },
      },
    },
  });

  if (!vendor) {
    throw new AppError(404, 'Vendor profile not found');
  }

  const iban = String(vendor.iban || '').trim();
  if (!iban) {
    throw new AppError(400, 'Payout request requires a valid IBAN');
  }

  const normalizedAmount = Number(amount || 0);
  if (!Number.isFinite(normalizedAmount) || normalizedAmount < 500) {
    throw new AppError(400, 'Minimum payout amount is 500');
  }

  const commissionRate = clampCommissionRate((await settingsService.getSettings())?.commissionRate);
  const eligibleItems = await prisma.orderItem.findMany({
    where: {
      vendorId: vendor.id,
      order: SETTLED_ORDER_FILTER,
      payoutItems: { none: {} },
    },
    select: {
      id: true,
      orderId: true,
      subtotal: true,
      commissionRateSnapshot: true,
      commissionAmount: true,
      vendorNetAmount: true,
      order: {
        select: {
          createdAt: true,
        },
      },
    },
    orderBy: [{ order: { createdAt: 'asc' } }, { id: 'asc' }],
  });

  const eligibleWithFinancials = eligibleItems.map((item) => ({
    ...item,
    financials: resolveOrderItemFinancials(item, commissionRate),
  }));
  const availableAmount = eligibleWithFinancials.reduce(
    (sum, item) => toMoney(sum + item.financials.vendorNetAmount),
    0
  );

  if (availableAmount <= 0) {
    throw new AppError(400, 'Çekilebilir bakiye bulunmuyor');
  }

  if (normalizedAmount > availableAmount) {
    throw new AppError(400, `Maksimum çekilebilir tutar ${availableAmount.toFixed(2)} TL`);
  }

  const selectedItems: Array<(typeof eligibleWithFinancials)[number]> = [];
  let selectedNetAmount = 0;

  for (const item of eligibleWithFinancials) {
    selectedItems.push(item);
    selectedNetAmount = toMoney(selectedNetAmount + item.financials.vendorNetAmount);
    if (selectedNetAmount >= normalizedAmount) {
      break;
    }
  }

  if (selectedItems.length === 0 || selectedNetAmount <= 0) {
    throw new AppError(400, 'İstenen tutar için uygun satış bulunamadı');
  }

  const now = new Date();
  const payout = await prisma.$transaction(async (tx) => {
    for (const item of selectedItems) {
      const financials = item.financials;
      const storedRate = clampCommissionRate(item.commissionRateSnapshot);
      const storedCommission = toMoney(item.commissionAmount);
      const storedVendorNet = toMoney(item.vendorNetAmount);
      if (
        storedRate !== financials.commissionRate ||
        storedCommission !== financials.commissionAmount ||
        storedVendorNet !== financials.vendorNetAmount
      ) {
        await tx.orderItem.update({
          where: { id: item.id },
          data: {
            commissionRateSnapshot: financials.commissionRate,
            commissionAmount: financials.commissionAmount,
            vendorNetAmount: financials.vendorNetAmount,
          },
        });
      }
    }

    return tx.payout.create({
      data: {
        vendorProfileId: vendor.id,
        periodStart: selectedItems[0]?.order?.createdAt || now,
        periodEnd: selectedItems[selectedItems.length - 1]?.order?.createdAt || now,
        grossAmount: selectedItems.reduce(
          (sum, item) => toMoney(sum + item.financials.subtotal),
          0
        ),
        commissionAmount: selectedItems.reduce(
          (sum, item) => toMoney(sum + item.financials.commissionAmount),
          0
        ),
        amount: selectedNetAmount,
        status: 'PENDING',
        items: {
          create: selectedItems.map((item) => ({
            orderId: item.orderId,
            orderItemId: item.id,
            amount: item.financials.vendorNetAmount,
          })),
        },
      },
      include: {
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
    });
  });

  try {
    const vendorEmail = String(vendor.user?.email || '').trim();
    if (vendorEmail) {
      await handleMailEvent(MailEvents.PAYMENT_REQUESTED, {
        email: vendorEmail,
        amount: `₺${selectedNetAmount.toFixed(2)}`,
      });
    }
  } catch (error) {
    console.warn('[vendorService] payment requested mail failed:', error);
  }

  return {
    ...mapPayoutWithFinancials(payout, commissionRate),
    requestedAmount: toMoney(normalizedAmount),
    vendorIban: iban,
    vendorBankName: String(vendor.bankName || '').trim() || null,
  };
};

export const listNotifications = async (userId: string, limit: number = 20) => {
  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(limit, 1), 100),
  });

  return notifications;
};

export const markNotificationAsRead = async (userId: string, id: string) => {
  const existing = await prisma.notification.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    throw new AppError(404, 'Notification not found');
  }

  const updated = await prisma.notification.update({
    where: { id },
    data: { isRead: true },
  });

  return updated;
};

export const getVendorProductById = async (productId: string, userId: string) => {
  const vendor = await prisma.vendorProfile.findUnique({
    where: { userId },
  });

  if (!vendor) {
    throw new AppError(404, 'Vendor profile not found');
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, vendorId: vendor.id },
    include: {
      category: { select: { id: true, name: true } },
      subCategory: { select: { id: true, name: true, slug: true } },
      images: { orderBy: { sortOrder: 'asc' } },
    },
  });

  if (!product) {
    throw new AppError(404, 'Product not found');
  }

  return product;
};

export const getVendorProducts = async (
  userId: string,
  page: number = 1,
  limit: number = 20
) => {
  const vendor = await prisma.vendorProfile.findUnique({
    where: { userId },
  });

  if (!vendor) {
    throw new AppError(404, 'Vendor profile not found');
  }

  const skip = (page - 1) * limit;

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where: { vendorId: vendor.id },
      include: {
        category: { select: { id: true, name: true } },
        subCategory: { select: { id: true, name: true, slug: true } },
        images: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.product.count({ where: { vendorId: vendor.id } }),
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

export const getCategorySmartSuggestions = async (
  userId: string,
  categoryId: string,
  subCategoryId?: string,
  limit: number = 6
) => {
  const vendor = await prisma.vendorProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!vendor) {
    throw new AppError(404, 'Vendor profile not found');
  }

  const normalizedCategoryId = String(categoryId || '').trim();
  if (!normalizedCategoryId) {
    throw new AppError(400, 'Category is required');
  }

  const normalizedSubCategoryId = String(subCategoryId || '').trim();

  const topSold = await prisma.orderItem.groupBy({
    by: ['productId'],
    where: {
      order: {
        status: 'DELIVERED',
        paymentStatus: 'PAID',
      },
      product: {
        categoryId: normalizedCategoryId,
        ...(normalizedSubCategoryId ? { subCategoryId: normalizedSubCategoryId } : {}),
      },
    },
    _sum: { quantity: true },
    _count: { productId: true },
    orderBy: {
      _sum: {
        quantity: 'desc',
      },
    },
    take: Math.min(Math.max(limit, 1), 12),
  });

  const products = await prisma.product.findMany({
    where: {
      id: { in: topSold.map((item) => String(item.productId)) },
      isActive: true,
      approvalStatus: 'APPROVED',
    },
    select: {
      id: true,
      name: true,
      imageUrl: true,
      images: { orderBy: { sortOrder: 'asc' }, take: 1, select: { imageUrl: true } },
      category: { select: { name: true } },
      subCategory: { select: { name: true } },
      barcode: true,
      price: true,
      unit: true,
    },
  });

  const byProductId = new Map(products.map((item) => [String(item.id), item]));

  return topSold
    .map((item) => {
      const product = byProductId.get(String(item.productId));
      if (!product) return null;

      return {
        id: String(product.id),
        name: String(product.name || '').trim(),
        imageUrl:
          String(product.images?.[0]?.imageUrl || '').trim() ||
          String(product.imageUrl || '').trim() ||
          null,
        category:
          String(product.subCategory?.name || '').trim() ||
          String(product.category?.name || '').trim() ||
          '',
        barcode: String(product.barcode || '').trim() || null,
        unit: String(product.unit || '').trim() || null,
        price: Number(product.price || 0),
        soldCount: Number(item._sum.quantity || 0),
        orderCount: Number(item._count.productId || 0),
      };
    })
    .filter(Boolean);
};

const isCacheFresh = (lastFetchedAt: Date | string | null | undefined): boolean => {
  if (!lastFetchedAt) return false;
  const fetchedAt = new Date(lastFetchedAt).getTime();
  if (!Number.isFinite(fetchedAt)) return false;
  return Date.now() - fetchedAt <= BARCODE_CACHE_TTL_MS;
};

const isPlaceholderImage = (imageUrl: string): boolean => {
  const normalized = String(imageUrl || '').trim().toLocaleLowerCase('tr-TR');
  if (!normalized) return true;
  return /placeholder|default-image|no-image|image-not-available|dummy/i.test(normalized);
};

const isImageUrlQualityAcceptable = async (imageUrl: string): Promise<boolean> => {
  const normalized = String(imageUrl || '').trim();
  if (!normalized || isPlaceholderImage(normalized)) {
    return false;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), BARCODE_REFRESH_TIMEOUT_MS);

    const response = await fetch(normalized, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'image/*' },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return false;
    }

    const arrayBuffer = await response.arrayBuffer();
    const metadata = await sharp(Buffer.from(arrayBuffer)).metadata();
    const width = Number(metadata.width || 0);
    const height = Number(metadata.height || 0);

    return width >= BARCODE_IMAGE_MIN_WIDTH && height >= BARCODE_IMAGE_MIN_HEIGHT;
  } catch {
    return false;
  }
};

const parseRawBarcodeApiResponse = (raw: unknown): Record<string, any> => {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object') return raw as Record<string, any>;
  return {};
};

const resolveLearningCategory = async (barcode: string): Promise<string | null> => {
  const topLearning = await prismaAny.barcodeCategoryLearning.findFirst({
    where: {
      barcode,
      count: { gte: 3 },
    },
    orderBy: [{ count: 'desc' }, { updatedAt: 'desc' }],
  });

  const learned = String(topLearning?.selectedCategory || '').trim();
  return learned || null;
};

const persistBarcodeLookupCache = async (args: {
  barcode: string;
  name: string;
  brand: string;
  image: string;
  rawApiResponse?: unknown;
}) => {
  const { barcode, name, brand, image, rawApiResponse } = args;
  await prismaAny.barcodeCache.upsert({
    where: { barcode },
    update: {
      name,
      brand,
      image,
      rawApiResponse: rawApiResponse ? JSON.stringify(rawApiResponse) : null,
      lastFetchedAt: new Date(),
    },
    create: {
      barcode,
      name,
      brand,
      image,
      rawApiResponse: rawApiResponse ? JSON.stringify(rawApiResponse) : null,
      lastFetchedAt: new Date(),
    },
  });
};

const upsertGlobalProduct = async (args: {
  barcode: string;
  name: string;
  brand: string;
  image: string;
  category: string;
}) => {
  const { barcode, name, brand, image, category } = args;
  const grouping = buildProductGroupInfo({ name, brand });

  await prismaAny.productGroup.upsert({
    where: { key: grouping.groupKey },
    update: {
      name: grouping.normalizedName || name,
      brand: grouping.normalizedBrand || brand || null,
      productType: grouping.productType || null,
    },
    create: {
      key: grouping.groupKey,
      name: grouping.normalizedName || name,
      brand: grouping.normalizedBrand || brand || null,
      productType: grouping.productType || null,
    },
  });

  await prismaAny.globalProduct.upsert({
    where: { barcode },
    update: {
      name,
      brand: brand || null,
      image: image || null,
      category: category || null,
      groupKey: grouping.groupKey,
    },
    create: {
      barcode,
      name,
      brand: brand || null,
      image: image || null,
      category: category || null,
      groupKey: grouping.groupKey,
    },
  });
};

const upsertProductSearchIndex = async (product: any) => {
  const normalizedNameInput = String(product?.name || '').trim();
  if (!normalizedNameInput) return;

  const searchable = buildSearchTokens({
    name: product?.name,
    brand: product?.brand || '',
    category: String(product?.subCategory?.name || product?.category?.name || '').trim(),
  });

  await prismaAny.productSearchIndex.upsert({
    where: { productId: String(product.id) },
    update: {
      normalizedName: searchable.normalizedName || normalizedNameInput,
      tokens: searchable.tokens.join(' '),
      brand: searchable.brand || null,
      category: searchable.category || null,
    },
    create: {
      productId: String(product.id),
      normalizedName: searchable.normalizedName || normalizedNameInput,
      tokens: searchable.tokens.join(' '),
      brand: searchable.brand || null,
      category: searchable.category || null,
    },
  });
};

type BarcodeAnalyticsEvent = 'scan_found' | 'scan_not_found' | 'manual_entry';

const trackBarcodeAnalytics = async (args: {
  eventType: BarcodeAnalyticsEvent;
  barcode?: string | null;
  productName?: string | null;
  category?: string | null;
}) => {
  const eventType = String(args.eventType || '').trim();
  if (!eventType) return;

  const normalizedBarcode = normalizeBarcode(args.barcode || '');
  const normalizedName = String(args.productName || '').trim().toLocaleLowerCase('tr-TR');
  const normalizedCategory = String(args.category || '').trim();

  const eventKey = [
    eventType,
    normalizedBarcode || '-',
    normalizedName || '-',
    normalizedCategory || '-',
  ].join('|');

  await prismaAny.barcodeAnalytics.upsert({
    where: { eventKey },
    update: {
      count: { increment: 1 },
      lastSeenAt: new Date(),
    },
    create: {
      eventKey,
      eventType,
      barcode: normalizedBarcode || null,
      productName: normalizedName || null,
      category: normalizedCategory || null,
      count: 1,
      lastSeenAt: new Date(),
    },
  });
};

const normalizeExternalBarcodeImage = async (imageUrl: string, barcode: string): Promise<string> => {
  const normalized = String(imageUrl || '').trim();
  if (!normalized) return '';

  try {
    const processed = await processQueuedProductImage(
      {
        kind: 'url',
        url: normalized,
      },
      `barcode_${barcode}`
    );
    return String(processed || '').trim();
  } catch (error: any) {
    logger.debug('[BARCODE] image standardization fallback to source image', {
      barcode,
      message: String(error?.message || 'Unknown standardization error'),
    });
    return normalized;
  }
};

const buildFoundBarcodeLookup = (args: {
  source: BarcodeLookupSource;
  normalizedBarcode: string;
  name: string;
  brand: string;
  imageUrl: string;
  quantity: string;
  category: string;
  suggestedCategory: string;
  categoryConfidence: number;
  matchedKeywords: string[];
  categoryMappingSource: 'local-category-mapper' | 'vendor-catalog' | 'barcode-learning';
}): BarcodeLookupResult => {
  return {
    found: true,
    source: args.source,
    normalizedBarcode: args.normalizedBarcode,
    lookupStatus: 'found',
    errorCode: null,
    alreadyExistsInVendorStore: false,
    productId: null,
    product: {
      barcode: args.normalizedBarcode,
      name: args.name,
      brand: args.brand,
      imageUrl: args.imageUrl,
      quantity: args.quantity,
      category: args.category,
      suggestedCategory: args.suggestedCategory,
      categoryConfidence: args.categoryConfidence,
      matchedKeywords: args.matchedKeywords,
      categoryMappingSource: args.categoryMappingSource,
      source: args.source === 'database' ? 'mahallem_db' : 'barcode_api',
      barcodeLookupStatus: 'found',
    },
  };
};

const fetchAndPersistExternalBarcodeData = async (normalizedBarcode: string): Promise<BarcodeLookupResult> => {
  const detailed = await lookupOpenFoodFactsByBarcodeDetailed(normalizedBarcode);
  const offProduct = detailed.product;

  if (!offProduct) {
    return {
      found: false,
      source: 'open_food_facts',
      normalizedBarcode,
      lookupStatus: 'not_found',
      errorCode: 'not_found',
      alreadyExistsInVendorStore: false,
      productId: null,
      product: null,
    };
  }

  const clean = cleanProductName(offProduct.name, offProduct.brand);
  const categoryMapping = mapBarcodeProductToMahallemCategory({
    product_name: clean.name,
    generic_name: offProduct.genericName,
    brands: clean.brand,
    categories: offProduct.categories || offProduct.category,
    category_tags: offProduct.categoryTags,
    ingredients_text: offProduct.ingredientsText,
    quantity: offProduct.quantity,
    barcode: offProduct.barcode || normalizedBarcode,
  });

  const learnedCategory = await resolveLearningCategory(normalizedBarcode);
  const effectiveCategory = String(learnedCategory || categoryMapping.category || '').trim();
  const apiImageUrl = String(offProduct.imageUrl || '').trim();
  const canUseApiImage = await isImageUrlQualityAcceptable(apiImageUrl);
  const effectiveImage = canUseApiImage
    ? await normalizeExternalBarcodeImage(apiImageUrl, normalizedBarcode)
    : '';

  const rawPayload = {
    ...detailed.rawPayload,
    normalized: {
      barcode: normalizeBarcode(offProduct.barcode) || normalizedBarcode,
      name: clean.name,
      brand: clean.brand,
      imageUrl: effectiveImage,
      quantity: String(offProduct.quantity || '').trim(),
      category: effectiveCategory,
      categories: String(offProduct.categories || offProduct.category || '').trim(),
      categoryTags: Array.isArray(offProduct.categoryTags) ? offProduct.categoryTags : [],
      ingredientsText: String(offProduct.ingredientsText || '').trim(),
    },
  };

  await persistBarcodeLookupCache({
    barcode: normalizedBarcode,
    name: clean.name,
    brand: clean.brand,
    image: effectiveImage,
    rawApiResponse: rawPayload,
  });

  await upsertGlobalProduct({
    barcode: normalizedBarcode,
    name: clean.name,
    brand: clean.brand,
    image: effectiveImage,
    category: effectiveCategory,
  });

  return buildFoundBarcodeLookup({
    source: 'open_food_facts',
    normalizedBarcode,
    name: clean.name,
    brand: clean.brand,
    imageUrl: effectiveImage,
    quantity: String(offProduct.quantity || '').trim(),
    category: effectiveCategory,
    suggestedCategory: effectiveCategory,
    categoryConfidence: learnedCategory ? 0.95 : Number(categoryMapping.confidence || 0),
    matchedKeywords: learnedCategory
      ? ['barcode-learning-threshold']
      : Array.isArray(categoryMapping.matchedKeywords)
        ? categoryMapping.matchedKeywords
        : [],
    categoryMappingSource: learnedCategory ? 'barcode-learning' : categoryMapping.source,
  });
};

const syncGlobalAndLearningFromVendorProduct = async (product: any) => {
  const normalizedBarcode = normalizeBarcode(product?.barcode);
  if (!normalizedBarcode) return;

  const selectedCategoryName = String(product?.subCategory?.name || product?.category?.name || '').trim();
  const imageFromGallery = String(product?.images?.[0]?.imageUrl || '').trim();
  const imageFromProduct = String(product?.imageUrl || '').trim();
  const sellerImage = imageFromGallery || imageFromProduct;

  const cleaned = cleanProductName(product?.name || '');
  const normalizedName = String(cleaned.name || product?.name || '').trim();

  await upsertGlobalProduct({
    barcode: normalizedBarcode,
    name: normalizedName,
    brand: '',
    image: sellerImage,
    category: selectedCategoryName,
  });

  if (!selectedCategoryName) return;

  const learning = await prismaAny.barcodeCategoryLearning.upsert({
    where: {
      barcode_selectedCategory: {
        barcode: normalizedBarcode,
        selectedCategory: selectedCategoryName,
      },
    },
    update: {
      count: { increment: 1 },
    },
    create: {
      barcode: normalizedBarcode,
      selectedCategory: selectedCategoryName,
      count: 1,
    },
  });

  const productsWithBarcode = await prisma.product.findMany({
    where: { barcode: normalizedBarcode },
    select: {
      vendorId: true,
      category: { select: { name: true } },
      subCategory: { select: { name: true } },
    },
  });

  const distinctVendorCount = new Set(
    productsWithBarcode
      .filter((item) => {
        const itemCategoryName = String(item?.subCategory?.name || item?.category?.name || '').trim();
        return itemCategoryName === selectedCategoryName;
      })
      .map((item) => String(item.vendorId || '').trim())
      .filter(Boolean)
  ).size;

  if (distinctVendorCount >= 3 && Number(learning?.count || 0) < 3) {
    await prismaAny.barcodeCategoryLearning.update({
      where: {
        barcode_selectedCategory: {
          barcode: normalizedBarcode,
          selectedCategory: selectedCategoryName,
        },
      },
      data: { count: 3 },
    });
  }

  logger.debug('[BARCODE] category learning updated', {
    barcode: normalizedBarcode,
    selectedCategory: selectedCategoryName,
    count: Math.max(Number(learning?.count || 0), distinctVendorCount >= 3 ? 3 : 0),
    distinctVendorCount,
  });
};

export const lookupProductByBarcode = async (userId: string, barcode: string): Promise<BarcodeLookupResult> => {
  const vendor = await prisma.vendorProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!vendor) {
    throw new AppError(404, 'Vendor profile not found');
  }

  const normalizedBarcode = normalizeBarcode(barcode);
  logger.debug('[BARCODE] normalized barcode', { barcode: normalizedBarcode });

  const validationResult = validateBarcode(normalizedBarcode);
  logger.debug('[BARCODE] validation result', {
    barcode: normalizedBarcode,
    isValid: validationResult.isValid,
    reason: validationResult.reason,
  });
  if (!validationResult.isValid) {
    throw new AppError(400, BARCODE_INVALID_MESSAGE, 'invalid_barcode');
  }

  logger.debug('[BARCODE] local DB lookup', { vendorId: vendor.id, barcode: normalizedBarcode });

  const existingProduct = await prisma.product.findFirst({
    where: {
      vendorId: vendor.id,
      barcode: normalizedBarcode,
    },
    include: {
      category: { select: { name: true } },
      subCategory: { select: { name: true } },
      images: { orderBy: { sortOrder: 'asc' }, take: 1 },
    },
  });

  if (existingProduct) {
    logger.info('[BARCODE] product found', {
      userId,
      barcode: normalizedBarcode,
      productId: existingProduct.id,
      source: 'database',
    });

    await trackBarcodeAnalytics({
      eventType: 'scan_found',
      barcode: normalizedBarcode,
      category:
        String(existingProduct.subCategory?.name || '').trim() ||
        String(existingProduct.category?.name || '').trim(),
    });

    return {
      found: true,
      source: 'database',
      normalizedBarcode,
      lookupStatus: 'found',
      errorCode: null,
      alreadyExistsInVendorStore: true,
      productId: existingProduct.id,
      product: {
        barcode: normalizedBarcode,
        name: String(existingProduct.name || '').trim(),
        brand: '',
        imageUrl:
          String(existingProduct.images?.[0]?.imageUrl || '').trim() ||
          String(existingProduct.imageUrl || '').trim(),
        quantity: String(existingProduct.unit || '').trim(),
        category:
          String(existingProduct.subCategory?.name || '').trim() ||
          String(existingProduct.category?.name || '').trim(),
        suggestedCategory:
          String(existingProduct.subCategory?.name || '').trim() ||
          String(existingProduct.category?.name || '').trim(),
        categoryConfidence: 1,
        matchedKeywords: ['vendor-catalog-match'],
        categoryMappingSource: 'vendor-catalog',
        source: 'mahallem_db',
        barcodeLookupStatus: 'found',
      },
    };
  }

  const globalProduct = await prismaAny.globalProduct.findUnique({
    where: { barcode: normalizedBarcode },
  });

  if (globalProduct) {
    const learnedCategory = await resolveLearningCategory(normalizedBarcode);
    const category = String(learnedCategory || globalProduct.category || '').trim();
    const fromGlobal = buildFoundBarcodeLookup({
      source: 'global_pool',
      normalizedBarcode,
      name: String(globalProduct.name || '').trim(),
      brand: String(globalProduct.brand || '').trim(),
      imageUrl: String(globalProduct.image || '').trim(),
      quantity: '',
      category,
      suggestedCategory: category,
      categoryConfidence: learnedCategory ? 0.95 : 0.88,
      matchedKeywords: learnedCategory ? ['barcode-learning-threshold'] : ['global-pool-match'],
      categoryMappingSource: learnedCategory ? 'barcode-learning' : 'vendor-catalog',
    });

    logger.info('[BARCODE] product found', {
      barcode: normalizedBarcode,
      source: 'global_pool',
      name: fromGlobal.product?.name || '',
    });

    await trackBarcodeAnalytics({
      eventType: 'scan_found',
      barcode: normalizedBarcode,
      category,
    });

    return fromGlobal;
  }

  const cacheRow = await prismaAny.barcodeCache.findUnique({
    where: { barcode: normalizedBarcode },
  });

  if (cacheRow) {
    const cachedRaw = parseRawBarcodeApiResponse(cacheRow.rawApiResponse);
    const cachedNormalized = parseRawBarcodeApiResponse(cachedRaw.normalized);
    const mappedCategory = String(cachedNormalized.category || '').trim();
    const learnedCategory = await resolveLearningCategory(normalizedBarcode);
    const effectiveCategory = learnedCategory || mappedCategory;

    const cachedResult = buildFoundBarcodeLookup({
      source: 'barcode_cache',
      normalizedBarcode,
      name: String(cacheRow.name || '').trim(),
      brand: String(cacheRow.brand || '').trim(),
      imageUrl: String(cacheRow.image || '').trim(),
      quantity: String(cachedNormalized.quantity || '').trim(),
      category: String(effectiveCategory || '').trim(),
      suggestedCategory: String(effectiveCategory || '').trim(),
      categoryConfidence: learnedCategory ? 0.95 : 0.84,
      matchedKeywords: learnedCategory ? ['barcode-learning-threshold'] : ['cache-hit'],
      categoryMappingSource: learnedCategory ? 'barcode-learning' : 'local-category-mapper',
    });

    if (isCacheFresh(cacheRow.lastFetchedAt)) {
      logger.info('[BARCODE] product found', {
        barcode: normalizedBarcode,
        source: 'barcode_cache',
        name: cachedResult.product?.name || '',
      });
      await trackBarcodeAnalytics({
        eventType: 'scan_found',
        barcode: normalizedBarcode,
        category: String(effectiveCategory || '').trim(),
      });
      return cachedResult;
    }

    logger.info('[BARCODE] stale cache served and refresh scheduled', {
      barcode: normalizedBarcode,
    });

    if (!barcodeLookupInFlight.has(normalizedBarcode)) {
      const refreshPromise = (async () => {
        try {
          await fetchAndPersistExternalBarcodeData(normalizedBarcode);
        } catch (error: any) {
          logger.error('[BARCODE] stale refresh failed', {
            barcode: normalizedBarcode,
            message: String(error?.message || 'Unknown stale refresh error'),
          });
        } finally {
          barcodeLookupInFlight.delete(normalizedBarcode);
        }
      })();
      barcodeLookupInFlight.set(normalizedBarcode, refreshPromise as unknown as Promise<BarcodeLookupResult>);
    }

    return cachedResult;
  }

  if (!BARCODE_LOOKUP_OFF_FALLBACK_ENABLED) {
    logger.info('[BARCODE] external API lookup skipped', {
      barcode: normalizedBarcode,
      skipped: true,
      reason: 'disabled_by_env',
    });
    await trackBarcodeAnalytics({
      eventType: 'scan_not_found',
      barcode: normalizedBarcode,
    });
    return {
      found: false,
      source: 'database',
      normalizedBarcode,
      lookupStatus: 'not_found',
      errorCode: 'not_found',
      alreadyExistsInVendorStore: false,
      productId: null,
      product: null,
    };
  }

  logger.debug('[BARCODE] external API lookup', { barcode: normalizedBarcode, provider: 'open_food_facts' });

  const inFlight = barcodeLookupInFlight.get(normalizedBarcode);
  if (inFlight) {
    return inFlight;
  }

  const lookupPromise = (async () => {
    try {
      return await fetchAndPersistExternalBarcodeData(normalizedBarcode);
    } catch (error: any) {
      if (error instanceof OpenFoodFactsLookupError) {
        const lookupStatus = error.code === 'timeout' ? 'timeout' : 'api_error';
        return {
          found: false,
          source: 'open_food_facts',
          normalizedBarcode,
          lookupStatus,
          errorCode: error.code,
          alreadyExistsInVendorStore: false,
          productId: null,
          product: null,
        } as BarcodeLookupResult;
      }

      logger.error('[BARCODE] external API lookup failed', {
        barcode: normalizedBarcode,
        message: String(error?.message || 'Unknown OFF lookup error'),
      });

      return {
        found: false,
        source: 'open_food_facts',
        normalizedBarcode,
        lookupStatus: 'api_error',
        errorCode: 'api_error',
        alreadyExistsInVendorStore: false,
        productId: null,
        product: null,
      } as BarcodeLookupResult;
    } finally {
      barcodeLookupInFlight.delete(normalizedBarcode);
    }
  })();

  barcodeLookupInFlight.set(normalizedBarcode, lookupPromise);

  try {
    const result = await lookupPromise;
    if (result.found) {
      logger.info('[BARCODE] product found', {
        barcode: normalizedBarcode,
        source: result.source,
        name: String(result.product?.name || ''),
      });
      await trackBarcodeAnalytics({
        eventType: 'scan_found',
        barcode: normalizedBarcode,
        category: String(result.product?.category || '').trim(),
      });
    } else {
      logger.info('[BARCODE] product not found', {
        barcode: normalizedBarcode,
        source: result.source,
        errorCode: result.errorCode,
      });
      await trackBarcodeAnalytics({
        eventType: 'scan_not_found',
        barcode: normalizedBarcode,
      });
    }
    return result;
  } catch (error: any) {
    logger.error('[BARCODE] unexpected lookup error', {
      userId,
      barcode: normalizedBarcode,
      message: String(error?.message || 'Unknown OFF lookup error'),
    });
    await trackBarcodeAnalytics({
      eventType: 'scan_not_found',
      barcode: normalizedBarcode,
    });
    return {
      found: false,
      source: 'open_food_facts',
      normalizedBarcode,
      lookupStatus: 'api_error',
      errorCode: 'api_error',
      alreadyExistsInVendorStore: false,
      productId: null,
      product: null,
    };
  }
};

export const createProduct = async (
  userId: string,
  data: any
) => {
  const vendor = await prisma.vendorProfile.findUnique({
    where: { userId },
  });

  if (!vendor) {
    throw new AppError(404, 'Vendor profile not found');
  }

  // Removed approval check - vendors can upload products even if PENDING
  // Admin can moderate products via admin panel

  const slug = data.slug ? String(data.slug) : slugify(String(data.name));

  const categoryMeta = (await resolveProductCategoryMeta(vendor, data, true))!;

  const existingProduct = await prisma.product.findFirst({
    where: {
      vendorId: vendor.id,
      slug,
    },
  });

  if (existingProduct) {
    throw new AppError(400, 'Product with this slug already exists');
  }

  const images: string[] | undefined = Array.isArray(data.images)
    ? data.images.map((x: any) => String(x)).filter(Boolean)
    : undefined;

  const imageJobs: QueuedProductImageInput[] = Array.isArray(data.imageJobs)
    ? data.imageJobs
        .map((item: any) => {
          const kind = String(item?.kind || '').toLowerCase();
          if (kind === 'url') {
            const url = String(item?.url || '').trim();
            if (!url) return null;
            return { kind: 'url', url } as QueuedProductImageInput;
          }

          if (kind === 'file') {
            const filename = String(item?.filename || '').trim();
            const contentBase64 = String(item?.contentBase64 || '').trim();
            if (!filename || !contentBase64) return null;

            return {
              kind: 'file',
              filename,
              mimeType: String(item?.mimeType || '').trim() || undefined,
              contentBase64,
            } as QueuedProductImageInput;
          }

          return null;
        })
        .filter(Boolean) as QueuedProductImageInput[]
    : [];

  const shouldQueueImageProcessing = imageJobs.length > 0;
  const normalizedBarcode = normalizeBarcode(data?.barcode) || undefined;

  if (normalizedBarcode) {
    const existingBarcodeProduct = await prisma.product.findFirst({
      where: {
        vendorId: vendor.id,
        barcode: normalizedBarcode,
      },
      select: { id: true, name: true },
    });

    if (existingBarcodeProduct) {
      throw new AppError(409, 'Bu barkod magazanda zaten kayitli. Mevcut urunu duzenleyebilirsin.', 'duplicate');
    }
  }

  const requestedIsActive = data.status ? String(data.status) === 'active' : true;
  const submissionSource = String(data.submissionSource || 'STANDARD').toUpperCase();
  const isAdvancedSubmission = submissionSource === 'ADVANCED';
  const shouldStartPendingReview = isAdvancedSubmission;
  const normalizedStock = Number(data.stock || 0);
  const hasStock = normalizedStock > 0;
  const immediateIsActive = (shouldStartPendingReview ? false : requestedIsActive) && hasStock;
  const isActive = shouldQueueImageProcessing ? false : immediateIsActive;
  const approvalStatus = shouldQueueImageProcessing || shouldStartPendingReview ? 'PENDING' : 'APPROVED';

  const product = await prisma.product.create({
    data: {
      vendorId: vendor.id,
      categoryId: categoryMeta.category.id,
      ...(categoryMeta.subCategory?.id && { subCategoryId: categoryMeta.subCategory.id }),
      name: data.name,
      slug,
      description: data.description,
      price: data.price,
      stock: data.stock,
      unit: data.unit,
      ...(normalizedBarcode ? { barcode: normalizedBarcode } : {}),
      imageUrl: shouldQueueImageProcessing ? undefined : images?.[0] || data.imageUrl,
      isActive,
      approvalStatus,
      rejectionReason: null,
      images: !shouldQueueImageProcessing && images
        ? {
            create: images.map((imageUrl, idx) => ({
              imageUrl,
              sortOrder: idx,
            })),
          }
        : undefined,
    },
    include: {
      category: true,
      subCategory: true,
      images: true,
    },
  });

  if (normalizedBarcode) {
    logger.info('[BARCODE] saved product barcode', {
      vendorId: vendor.id,
      productId: product.id,
      barcode: normalizedBarcode,
    });
  }

  if (shouldQueueImageProcessing) {
    if (!isProductProcessingQueueEnabled()) {
      await prisma.product.update({
        where: { id: product.id },
        data: {
          approvalStatus: 'REJECTED',
          isActive: false,
        },
      });

      throw new AppError(
        503,
        'Arka plan urun isleme servisi su an kullanilamiyor. Lutfen daha sonra tekrar deneyin.'
      );
    }

    try {
      await enqueueProductProcessingJob({
        productId: product.id,
        vendorId: vendor.id,
        imageJobs,
      });
    } catch {
      await prisma.product.update({
        where: { id: product.id },
        data: {
          approvalStatus: 'REJECTED',
          isActive: false,
        },
      });

      throw new AppError(
        503,
        'Urun isleme kuyruguna eklenemedi. Lutfen tekrar deneyin.'
      );
    }
  }

  await (prisma as any).sellerProduct.upsert({
    where: {
      sellerId_productId: {
        sellerId: vendor.id,
        productId: product.id,
      },
    },
    update: {
      price: Number(data.price),
    },
    create: {
      sellerId: vendor.id,
      productId: product.id,
      price: Number(data.price),
    },
  });

  if (normalizedBarcode) {
    await syncGlobalAndLearningFromVendorProduct(product as any);
    await trackBarcodeAnalytics({
      eventType: 'scan_found',
      barcode: normalizedBarcode,
      category: String(product?.subCategory?.name || product?.category?.name || '').trim(),
    });
  } else {
    await trackBarcodeAnalytics({
      eventType: 'manual_entry',
      productName: String(product?.name || '').trim(),
      category: String(product?.subCategory?.name || product?.category?.name || '').trim(),
    });
  }

  await upsertProductSearchIndex(product as any);

  return product;
};

export const updateProduct = async (
  productId: string,
  userId: string,
  data: any
) => {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      vendor: true,
      category: { select: { slug: true } },
      subCategory: { select: { id: true, slug: true } },
    },
  });

  if (!product) {
    throw new AppError(404, 'Product not found');
  }

  if (product.vendor.userId !== userId) {
    throw new AppError(403, 'Not authorized to update this product');
  }

  const categoryMeta = await resolveProductCategoryMeta(product.vendor, data, false);

  const images: string[] | undefined = Array.isArray(data.images)
    ? data.images.map((x: any) => String(x)).filter(Boolean)
    : undefined;

  const submissionSource = String(data.submissionSource || '').toUpperCase();
  const isAdvancedSubmission = submissionSource === 'ADVANCED';
  const effectiveCategorySlug = categoryMeta?.category.slug || product.category?.slug;
  const switchedToSpecialCategory =
    categoryMeta?.category.slug === SPECIAL_CATEGORY_SLUG &&
    product.category?.slug !== SPECIAL_CATEGORY_SLUG &&
    isAdvancedSubmission;

  const nextStock =
    data.stock !== undefined ? Number(data.stock || 0) : Number(product.stock || 0);
  const isOutOfStock = nextStock <= 0;
  const isActive = isOutOfStock ? false : true;

  if (data.barcode !== undefined) {
    const normalizedBarcode = normalizeBarcode(data.barcode);
    if (normalizedBarcode) {
      const existingBarcodeProduct = await prisma.product.findFirst({
        where: {
          vendorId: product.vendorId,
          barcode: normalizedBarcode,
          id: { not: productId },
        },
        select: { id: true, name: true },
      });

      if (existingBarcodeProduct) {
        throw new AppError(409, 'Bu barkod magazanda zaten kayitli. Mevcut urunu duzenleyebilirsin.', 'duplicate');
      }
    }
  }

  const updated = await prisma.product.update({
    where: { id: productId },
    data: {
      ...(categoryMeta?.category.id && { categoryId: categoryMeta.category.id }),
      ...(categoryMeta?.subCategory?.id && { subCategoryId: categoryMeta.subCategory.id }),
      ...(data.name && { name: data.name }),
      ...(data.slug && { slug: data.slug }),
      ...(data.description && { description: data.description }),
      ...(data.price && { price: data.price }),
      ...(data.stock !== undefined && { stock: data.stock }),
      ...(data.unit && { unit: data.unit }),
      ...(data.barcode !== undefined && { barcode: normalizeBarcode(data.barcode) || null }),
      ...(data.imageUrl && { imageUrl: data.imageUrl }),
      ...(images && { imageUrl: images[0] }),
      ...(isActive !== undefined && { isActive }),
      ...(isOutOfStock && { isActive: false }),
      approvalStatus: 'APPROVED',
      rejectionReason: null,
      ...(images && {
        images: {
          deleteMany: {},
          create: images.map((imageUrl, idx) => ({
            imageUrl,
            sortOrder: idx,
          })),
        },
      }),
    },
    include: {
      category: true,
      subCategory: true,
      images: true,
    },
  });

  if (data.barcode !== undefined) {
    logger.info('[BARCODE] saved product barcode', {
      vendorId: product.vendorId,
      productId: updated.id,
      barcode: normalizeBarcode(data.barcode) || null,
    });
  }

  if (data.price !== undefined) {
    await (prisma as any).sellerProduct.upsert({
      where: {
        sellerId_productId: {
          sellerId: product.vendorId,
          productId: updated.id,
        },
      },
      update: {
        price: Number(data.price),
      },
      create: {
        sellerId: product.vendorId,
        productId: updated.id,
        price: Number(data.price),
      },
    });
  }

  if (data.barcode !== undefined) {
    await syncGlobalAndLearningFromVendorProduct(updated as any);
  }

  await upsertProductSearchIndex(updated as any);

  return updated;
};

export const deleteProduct = async (productId: string, userId: string) => {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { vendor: true },
  });

  if (!product) {
    throw new AppError(404, 'Product not found');
  }

  if (product.vendor.userId !== userId) {
    throw new AppError(403, 'Not authorized to delete this product');
  }

  await prisma.product.delete({
    where: { id: productId },
  });

  return { success: true };
};

export const getVendorOrders = async (
  userId: string,
  status?: string,
  page: number = 1,
  limit: number = 20
) => {
  const normalizedUserId = String(userId || '').trim();
  if (!normalizedUserId) {
    throw new AppError(400, 'sellerId is required');
  }

  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);

  const vendor = await prisma.vendorProfile.findUnique({
    where: { userId: normalizedUserId },
    select: { id: true },
  });

  if (!vendor) {
    throw new AppError(404, 'Vendor profile not found');
  }

  const skip = (safePage - 1) * safeLimit;

  const where: any = {
    items: {
      some: { vendorId: vendor.id },
    },
    paymentStatus: {
      in: VENDOR_VISIBLE_PAYMENT_STATUSES as any,
    },
  };

  if (status) {
    where.status = status;
  }

  let orders: any[] = [];
  let total = 0;

  try {
    const result = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          customer: {
            select: { id: true, name: true, email: true, phone: true },
          },
          items: {
            where: { vendorId: vendor.id },
            include: {
              product: { select: { id: true, name: true, unit: true, description: true } },
            },
          },
          shippingAddress: true,
          actionHistory: {
            where: {
              actorRole: 'CUSTOMER',
              actionType: 'MESSAGE_SENT',
              note: { not: null },
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { note: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeLimit,
      }),
      prisma.order.count({ where }),
    ]);

    orders = result[0] as any[];
    total = Number(result[1] || 0);
  } catch (error) {
    if (!isPrismaSchemaDriftError(error)) {
      throw error;
    }

    logger.error('[vendorService.getVendorOrders] schema drift fallback applied', {
      vendorId: vendor.id,
      error: String((error as any)?.message || error),
    });

    const result = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          customer: {
            select: { id: true, name: true, email: true, phone: true },
          },
          items: {
            where: { vendorId: vendor.id },
            include: {
              product: { select: { id: true, name: true, unit: true, description: true } },
            },
          },
          shippingAddress: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeLimit,
      }),
      prisma.order.count({ where }),
    ]);

    orders = (result[0] as any[]).map((order: any) => ({ ...order, notes: null }));
    total = Number(result[1] || 0);
  }

  const normalizedOrders = orders.map((order: any) => {
    const latestNote = String(order?.actionHistory?.[0]?.note || '').trim();
    const hasNotes = latestNote.length > 0;
    return {
      ...order,
      notes: hasNotes ? latestNote : (order?.notes ?? null),
    };
  });

  return {
    orders: attachOrderCodeList(normalizedOrders as any[]),
    pagination: {
      total,
      page: safePage,
      limit: safeLimit,
      pages: Math.ceil(total / safeLimit),
    },
  };
};

export const getVendorOrderById = async (
  orderId: string,
  userId: string
) => {
  const vendor = await prisma.vendorProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!vendor) {
    throw new AppError(404, 'Vendor profile not found');
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: {
        select: { id: true, name: true, email: true, phone: true },
      },
      items: {
        include: {
          product: { select: { id: true, name: true, price: true, unit: true, description: true } },
          vendor: true,
        },
      },
      shippingAddress: true,
      actionHistory: {
        where: {
          actorRole: 'CUSTOMER',
          actionType: 'MESSAGE_SENT',
          note: { not: null },
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { note: true },
      },
    },
  });

  if (
    !order ||
    !order.items.some((item) => item.vendorId === vendor.id) ||
    !VENDOR_VISIBLE_PAYMENT_STATUSES.includes(order.paymentStatus as (typeof VENDOR_VISIBLE_PAYMENT_STATUSES)[number])
  ) {
    throw new AppError(404, 'Order not found');
  }

  const latestNote = String((order as any)?.actionHistory?.[0]?.note || '').trim();
  const withNotes = {
    ...(order as any),
    notes: latestNote.length > 0 ? latestNote : null,
  };

  return attachOrderCode(withNotes as any);
};

export const updateVendorOrderStatus = async (
  orderId: string,
  userId: string,
  status: string,
  note?: string,
  reasonTitle?: string
) => {
  const vendor = await prisma.vendorProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!vendor) {
    throw new AppError(404, 'Vendor profile not found');
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
    },
  });

  if (!order || !order.items.some((item) => item.vendorId === vendor.id)) {
    throw new AppError(404, 'Order not found');
  }

  if (String(order.paymentStatus || '').toUpperCase() !== 'PAID') {
    throw new AppError(409, 'Odeme tamamlanmadan siparis durumu guncellenemez');
  }

  const currentStatus = String(order.status || '').toUpperCase();
  const nextStatus = String(status || '').toUpperCase();
  const trimmedNote = String(note || '').trim();
  const trimmedReasonTitle = String(reasonTitle || '').trim();
  const allowedTransitions: Record<string, string[]> = {
    PENDING: ['PREPARING', 'CANCELLED'],
    PREPARING: ['ON_THE_WAY', 'CANCELLED'],
    ON_THE_WAY: ['DELIVERED', 'CANCELLED'],
    DELIVERED: [],
    CANCELLED: [],
  };

  const allowed = allowedTransitions[currentStatus] || [];
  if (!allowed.includes(nextStatus)) {
    throw new AppError(400, `Invalid status transition: ${currentStatus} -> ${nextStatus}`);
  }

  if (nextStatus === 'CANCELLED' && trimmedNote.length < 20) {
    throw new AppError(400, 'İptal nedeni en az 20 karakter olmalıdır');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const cancellationPatch =
      nextStatus === 'CANCELLED'
        ? {
            cancelReason: 'OTHER' as any,
            cancelOtherDescription: trimmedNote,
            cancelledAt: new Date(),
            cancelledBy: 'VENDOR' as any,
            ...(String(order.paymentStatus || '') === 'PAID' ? { paymentStatus: 'REFUNDED' as any } : {}),
          }
        : {};

    const savedOrder = await tx.order.update({
      where: { id: orderId },
      data: {
        status: nextStatus as any,
        ...cancellationPatch,
      },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        items: {
          where: { vendorId: vendor.id },
          include: { product: { select: { id: true, name: true } } },
        },
        shippingAddress: true,
      },
    });

    if (nextStatus === 'CANCELLED') {
      await tx.orderActionHistory.create({
        data: {
          orderId: order.id,
          actionType: 'ORDER_CANCELLED',
          actorRole: 'VENDOR',
          actorId: userId,
          note: trimmedNote,
          metadata: {
            fromStatus: currentStatus,
            toStatus: nextStatus,
            reasonTitle: trimmedReasonTitle || undefined,
          },
        },
      });
    }

    return savedOrder;
  });

  const customerId = String((updated as any)?.customer?.id || '').trim();
  if (customerId) {
    const orderCode = String((updated as any)?.orderCode || '').trim();
    const orderLabel = orderCode ? `#${orderCode}` : `#${orderId.slice(0, 8)}`;

    const statusMap: Record<string, { title: string; message: string }> = {
      PREPARING: {
        title: 'Siparişin hazırlanıyor',
        message: `Siparişin ${orderLabel} esnaf tarafından hazırlanmaya başlandı.`,
      },
      ON_THE_WAY: {
        title: 'Siparişin yolda',
        message: `Siparişin ${orderLabel} yola çıktı. Kısa süre içinde teslim edilecek.`,
      },
      DELIVERED: {
        title: 'Siparişin teslim edildi',
        message: `Siparişin ${orderLabel} başarıyla teslim edildi.`,
      },
      CANCELLED: {
        title: 'Siparişin iptal edildi',
        message: `Siparişin ${orderLabel} satıcı tarafından iptal edildi.`,
      },
    };

    const payload = statusMap[nextStatus];
    if (payload) {
      await createUserNotificationAndPush({
        userId: customerId,
        type: 'ORDER_UPDATE',
        notificationType: 'ORDER_STATUS',
        title: payload.title,
        message: payload.message,
        route: `/order-tracking?orderId=${encodeURIComponent(orderId)}`,
        orderId,
      });
    }
  }

  if (nextStatus === 'DELIVERED') {
    try {
      const customerEmail = String((updated as any)?.customer?.email || '').trim();
      if (customerEmail) {
        await handleMailEvent(MailEvents.ORDER_DELIVERED, {
          email: customerEmail,
          name: String((updated as any)?.customer?.name || 'Müşteri').trim() || 'Müşteri',
          orderId: String((updated as any)?.orderCode || orderId).trim(),
        });
      }
    } catch (error) {
      console.warn('[vendorService] delivered mail failed:', error);
    }
  }

  return attachOrderCode(updated as any);
};

export const getVendorDashboard = async (userId: string) => {
  const normalizedUserId = String(userId || '').trim();
  if (!normalizedUserId) {
    throw new AppError(400, 'sellerId is required');
  }

  const vendor = await prisma.vendorProfile.findUnique({
    where: { userId: normalizedUserId },
    select: {
      id: true,
      shopName: true,
      status: true,
    },
  });

  if (!vendor) {
    throw new AppError(404, 'Vendor profile not found');
  }

  const commissionRate = clampCommissionRate((await settingsService.getSettings())?.commissionRate);

  let settledOrderItems: any[] = [];
  let orders: any[] = [];
  let products: any[] = [];
  let recentOrders: any[] = [];
  let availableOrderItems: any[] = [];
  let payouts: any[] = [];

  try {
    const result = await Promise.all([
      prisma.orderItem.findMany({
        where: {
          vendorId: vendor.id,
          order: SETTLED_ORDER_FILTER,
        },
        select: {
          id: true,
          productId: true,
          quantity: true,
          subtotal: true,
          commissionRateSnapshot: true,
          commissionAmount: true,
          vendorNetAmount: true,
          order: { select: { createdAt: true } },
        },
      }),
      prisma.order.findMany({
        where: {
          items: { some: { vendorId: vendor.id } },
          paymentStatus: { in: VENDOR_VISIBLE_PAYMENT_STATUSES as any },
        },
        select: {
          id: true,
          status: true,
          createdAt: true,
          totalPrice: true,
        },
      }),
      prisma.product.findMany({
        where: { vendorId: vendor.id },
        select: { id: true, isActive: true, stock: true },
      }),
      prisma.order.findMany({
        where: {
          items: { some: { vendorId: vendor.id } },
          paymentStatus: { in: VENDOR_VISIBLE_PAYMENT_STATUSES as any },
        },
        include: {
          customer: {
            select: { id: true, name: true, email: true, phone: true },
          },
          items: {
            where: { vendorId: vendor.id },
            include: {
              product: { select: { id: true, name: true, unit: true } },
            },
          },
          shippingAddress: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.orderItem.findMany({
        where: {
          vendorId: vendor.id,
          order: SETTLED_ORDER_FILTER,
          payoutItems: { none: {} },
        },
        select: {
          id: true,
          subtotal: true,
          commissionRateSnapshot: true,
          commissionAmount: true,
          vendorNetAmount: true,
        },
      }),
      prisma.payout.findMany({
        where: { vendorProfileId: vendor.id },
        select: { amount: true, status: true },
      }),
    ]);

    settledOrderItems = result[0] as any[];
    orders = result[1] as any[];
    products = result[2] as any[];
    recentOrders = result[3] as any[];
    availableOrderItems = result[4] as any[];
    payouts = result[5] as any[];
  } catch (error) {
    if (!isPrismaSchemaDriftError(error)) {
      throw error;
    }

    logger.error('[vendorService.getVendorDashboard] schema drift fallback applied', {
      vendorId: vendor.id,
      error: String((error as any)?.message || error),
    });

    const fallback = await Promise.all([
      prisma.order.findMany({
        where: {
          items: { some: { vendorId: vendor.id } },
          paymentStatus: { in: VENDOR_VISIBLE_PAYMENT_STATUSES as any },
        },
        select: {
          id: true,
          status: true,
          createdAt: true,
          totalPrice: true,
        },
      }),
      prisma.product.findMany({
        where: { vendorId: vendor.id },
        select: { id: true, isActive: true, stock: true },
      }),
    ]);

    orders = fallback[0] as any[];
    products = fallback[1] as any[];
  }

  const settledSummary = summarizeFinancialOrderItems(settledOrderItems, commissionRate);
  const availableSummary = summarizeFinancialOrderItems(availableOrderItems, commissionRate);

  // Total orders
  const totalOrders = orders.length;

  // Orders by status
  const ordersByStatus = orders.reduce((acc, order) => {
    acc[String(order.status)] = (acc[String(order.status)] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Top selling products
  const topProductPairs: Array<[string, number]> = Array.from(
    settledOrderItems
      .reduce((acc: Map<string, number>, item: any) => {
        const key = String(item.productId);
        acc.set(key, (acc.get(key) || 0) + Number(item.quantity || 0));
        return acc;
      }, new Map<string, number>())
      .entries()
  );

  const topProducts = topProductPairs
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([productId, quantity]) => ({ productId, quantity }));

  const topProductsData = await Promise.all(
    topProducts.map(async (tp) => {
      const product = await prisma.product.findUnique({
        where: { id: tp.productId },
        select: { id: true, name: true, price: true },
      });
      return {
        product,
        totalQuantitySold: tp.quantity,
      };
    })
  );

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfWeek.getDate() - 6);
  const startOfMonth = new Date(startOfDay);
  startOfMonth.setDate(startOfMonth.getDate() - 29);
  const inRange = (date: Date, start: Date, end: Date) => date >= start && date <= end;

  const todayOrders = orders.filter((order) => inRange(new Date(order.createdAt), startOfDay, now));
  const weekOrders = orders.filter((order) => inRange(new Date(order.createdAt), startOfWeek, now));
  const monthOrders = orders.filter((order) => inRange(new Date(order.createdAt), startOfMonth, now));

  const getRevenueForRange = (start: Date, end: Date) =>
    summarizeFinancialOrderItems(
      settledOrderItems.filter((item) => inRange(new Date(item.order.createdAt), start, end)),
      commissionRate
    ).netAmount;

  const pendingOrders = orders.filter((order) => ['PENDING', 'PREPARING', 'ON_THE_WAY'].includes(String(order.status))).length;
  const totalProducts = products.length;
  const activeProducts = products.filter((product) => Boolean(product.isActive)).length;
  const lowStock = products.filter((product) => Number(product.stock || 0) <= 5).length;
  const pendingPayoutAmount = payouts
    .filter((payout) => payout.status === 'PENDING' || payout.status === 'PROCESSING')
    .reduce((sum, payout) => toMoney(sum + Number(payout.amount || 0)), 0);
  const paidOutAmount = payouts
    .filter((payout) => payout.status === 'PAID')
    .reduce((sum, payout) => toMoney(sum + Number(payout.amount || 0)), 0);
  const chartData = Array.from({ length: 7 }).map((_, index) => {
    const day = new Date(startOfWeek);
    day.setDate(startOfWeek.getDate() + index);
    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);
    return {
      date: dayStart.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' }),
      orders: orders.filter((order) => inRange(new Date(order.createdAt), dayStart, dayEnd)).length,
      revenue: getRevenueForRange(dayStart, dayEnd),
    };
  });

  return {
    vendor: {
      id: vendor.id,
      shopName: vendor.shopName,
      status: vendor.status,
    },
    totalRevenue: settledSummary.grossAmount,
    totalCommissionAmount: settledSummary.commissionAmount,
    commissionRate,
    netRevenue: settledSummary.netAmount,
    summary: {
      availableBalance: availableSummary.netAmount,
      pendingPayoutAmount,
      paidOutAmount,
      totalGrossSales: settledSummary.grossAmount,
      totalCommissionAmount: settledSummary.commissionAmount,
      totalNetRevenue: settledSummary.netAmount,
      commissionRate,
    },
    today: { orders: todayOrders.length, revenue: getRevenueForRange(startOfDay, now) },
    week: { orders: weekOrders.length, revenue: getRevenueForRange(startOfWeek, now) },
    month: { orders: monthOrders.length, revenue: getRevenueForRange(startOfMonth, now) },
    pending: { orders: pendingOrders },
    products: { total: totalProducts, active: activeProducts, low_stock: lowStock },
    recent_orders: attachOrderCodeList(recentOrders as any[]),
    chart_data: chartData,
    totalOrders,
    ordersByStatus,
    topProducts: topProductsData,
  };
};

// Campaigns
export const createCampaign = async (
  userId: string,
  campaignData: {
    scope: string;
    discountType: string;
    discountAmount: number;
    startDate: string;
    endDate: string;
    selectedProducts?: string[];
  }
) => {
  const vendor = await prisma.vendorProfile.findUnique({
    where: { userId },
  });

  if (!vendor) {
    throw new AppError(404, 'Vendor profile not found');
  }

  const start = new Date(campaignData.startDate);
  const end = new Date(campaignData.endDate);
  const now = new Date();
  const status =
    end.getTime() < now.getTime()
      ? 'expired'
      : start.getTime() <= now.getTime() && now.getTime() <= end.getTime()
        ? 'active'
        : 'pending';

  const campaign = await prisma.campaign.create({
    data: {
      vendorProfileId: vendor.id,
      scope: campaignData.scope,
      discountType: campaignData.discountType,
      discountAmount: parseFloat(campaignData.discountAmount.toString()),
      startDate: start,
      endDate: end,
      selectedProducts: JSON.stringify(campaignData.selectedProducts || []),
      status,
    },
  });

  return campaign;
};

export const getCampaigns = async (userId: string) => {
  const vendor = await prisma.vendorProfile.findUnique({
    where: { userId },
  });

  if (!vendor) {
    throw new AppError(404, 'Vendor profile not found');
  }

  const campaigns = await prisma.campaign.findMany({
    where: { vendorProfileId: vendor.id },
    orderBy: { createdAt: 'desc' },
  });

  return campaigns;
};

export const updateCampaign = async (
  userId: string,
  campaignId: string,
  campaignData: {
    scope: string;
    discountType: string;
    discountAmount: number;
    startDate: string;
    endDate: string;
    selectedProducts?: string[];
  }
) => {
  const vendor = await prisma.vendorProfile.findUnique({
    where: { userId },
  });

  if (!vendor) {
    throw new AppError(404, 'Vendor profile not found');
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign || campaign.vendorProfileId !== vendor.id) {
    throw new AppError(403, 'Campaign not found or not authorized');
  }

  const start = new Date(campaignData.startDate);
  const end = new Date(campaignData.endDate);
  const now = new Date();
  const status =
    end.getTime() < now.getTime()
      ? 'expired'
      : start.getTime() <= now.getTime() && now.getTime() <= end.getTime()
        ? 'active'
        : 'pending';

  const updated = await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      scope: campaignData.scope,
      discountType: campaignData.discountType,
      discountAmount: parseFloat(campaignData.discountAmount.toString()),
      startDate: start,
      endDate: end,
      selectedProducts: JSON.stringify(campaignData.selectedProducts || []),
      status,
    },
  });

  return updated;
};

export const deleteCampaign = async (userId: string, campaignId: string) => {
  const vendor = await prisma.vendorProfile.findUnique({
    where: { userId },
  });

  if (!vendor) {
    throw new AppError(404, 'Vendor profile not found');
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign || campaign.vendorProfileId !== vendor.id) {
    throw new AppError(403, 'Campaign not found or not authorized');
  }

  await prisma.campaign.delete({
    where: { id: campaignId },
  });
};
