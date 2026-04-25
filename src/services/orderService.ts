import prisma from '../config/db';
import { AppError } from '../middleware/errorHandler';
import * as settingsService from './settingsService';
import { haversineKm } from '../utils/geoUtils';
import {
  findNeighborhoodByCoordinate,
  getDistanceToNeighborhoodBoundaryKm,
  getDistanceToNeighborhoodBoundaryUsingReferencePointKm,
  getDistanceToBoundaryOfNeighborhoodContainingPointKm,
  getDistanceToBoundaryOfNearestNeighborhoodToReferencePointKm,
} from '../data/neighborhoodPolygonService';
import { normalizeTrForCompare } from '../utils/trNormalize';
import {
  formatCampaignShortLabel,
  getActiveSellerCampaignForSeller,
} from './sellerCampaignService';
import { attachOrderCode, attachOrderCodeList } from '../utils/orderCode';
import {
  composeCustomerEtaMinutes,
  requireReadyPlatformNeighborhoodSettings,
  resolveVendorPreparationMinutes,
  resolveEffectiveVendorDeliverySettings,
} from './platformNeighborhoodDeliveryService';
import { handleMailEvent } from './mail/mailHandler';
import { MailEvents } from './mail/mailEvents';

const MAX_DELIVERY_RADIUS_KM = 1;
const POLYGON_ANOMALY_DISTANCE_KM = 5;

type NormalizedOrderType = 'DELIVERY' | 'PICKUP';

const normalizeOrderType = (value: unknown): NormalizedOrderType => {
  const raw = String(value || '').trim().toUpperCase();
  return raw === 'PICKUP' ? 'PICKUP' : 'DELIVERY';
};

const toMoney = (value: unknown): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Number(n.toFixed(2));
};

const safeJsonArray = (raw: any): string[] => {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed.map((x) => String(x)) : [];
  } catch {
    return [];
  }
};

type ActiveProductCampaign = {
  scope: string;
  discountType: string;
  discountAmount: number;
  selectedProducts: string;
};

const computeAppliedProductPricing = (params: {
  price: number;
  campaigns: ActiveProductCampaign[];
  productId: string;
}) => {
  const price = Number(params.price || 0);
  if (!Number.isFinite(price) || price <= 0) {
    return {
      originalUnitPrice: 0,
      unitPrice: 0,
      discountPerUnit: 0,
      discountType: null as string | null,
      discountLabel: null as string | null,
    };
  }

  let bestPrice = price;
  let appliedCampaign: ActiveProductCampaign | null = null;

  for (const c of params.campaigns) {
    const scope = String(c.scope || '').toLowerCase();
    if (scope === 'selected') {
      const selected = safeJsonArray(c.selectedProducts);
      if (!selected.includes(params.productId)) continue;
    }

    const type = String(c.discountType || '').toLowerCase();
    const amount = Number(c.discountAmount || 0);
    if (!Number.isFinite(amount) || amount <= 0) continue;

    let discounted = price;
    if (type === 'percentage') discounted = price * (1 - Math.max(0, Math.min(100, amount)) / 100);
    else if (type === 'fixed') discounted = Math.max(0, price - amount);
    else continue;

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
    discountType:
      discountPerUnit > 0
        ? rawDiscountType === 'percentage'
          ? 'PERCENTAGE'
          : rawDiscountType === 'fixed'
            ? 'FIXED'
            : null
        : null,
    discountLabel:
      discountPerUnit > 0
        ? 'Ürün İndirimi'
        : null,
  };
};

const computeDiscountedUnitPrice = (params: {
  price: number;
  campaigns: ActiveProductCampaign[];
  productId: string;
}) => {
  return computeAppliedProductPricing(params).unitPrice;
};

const getActiveCampaignsForVendor = async (vendorProfileId: string) => {
  const now = new Date();
  return prisma.campaign.findMany({
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

const normalizeVendorDeliveryMode = (vendorProfile: any): 'SELLER' | 'PLATFORM' => {
  const explicit = String(vendorProfile?.deliveryMode || '')
    .trim()
    .toUpperCase();
  if (explicit === 'PLATFORM') return 'PLATFORM';
  if (explicit === 'SELLER') return 'SELLER';

  const legacyCoverage = String(vendorProfile?.deliveryCoverage || 'SELF')
    .trim()
    .toUpperCase();
  return legacyCoverage === 'PLATFORM' ? 'PLATFORM' : 'SELLER';
};

const toCompatDeliveryCoverage = (deliveryMode: 'SELLER' | 'PLATFORM'): 'SELF' | 'PLATFORM' => {
  return deliveryMode === 'SELLER' ? 'SELF' : 'PLATFORM';
};

const normalizeNullableMoney = (value: any): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return null;
  return Number(num.toFixed(2));
};

const calculateStoreDeliveryFee = async (params: {
  sellerSubtotal: number;
  vendorProfile: any;
  defaultStoreFee: number;
}) => {
  const sellerSubtotal = Number(params.sellerSubtotal || 0);
  const vendor = params.vendorProfile || {};

  if (vendor?.isActive === false) {
    throw new AppError(400, 'Store is not active');
  }

  const deliveryMode = normalizeVendorDeliveryMode(vendor);
  const effectiveDeliverySettings =
    deliveryMode === 'PLATFORM'
      ? await requireReadyPlatformNeighborhoodSettings(vendor)
      : await resolveEffectiveVendorDeliverySettings(vendor);
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

const createOrderActionHistory = async (tx: any, input: {
  orderId?: string | null;
  actionType: string;
  actorRole?: 'CUSTOMER' | 'VENDOR' | 'ADMIN';
  actorId?: string;
  note?: string | null;
  metadata?: Record<string, unknown> | null;
}) => {
  if (!input.orderId) return;

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

const parseTimeToMinutes = (timeText?: string | null): number | null => {
  const m = String(timeText || '').trim().match(/^(\d{1,2})[:.](\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
};

const isVendorOpenNow = (openingTime?: string | null, closingTime?: string | null): boolean | null => {
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

const buildNextDayOpeningDeliverySlot = (openingTime?: string | null): string => {
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

const toFiniteCoord = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const computeVendorAddressDistanceKm = (vendorProfile: any, address: any): number | null => {
  const vendorLat = toFiniteCoord(vendorProfile?.latitude);
  const vendorLng = toFiniteCoord(vendorProfile?.longitude);
  const addressLat = toFiniteCoord(address?.latitude);
  const addressLng = toFiniteCoord(address?.longitude);

  if (vendorLat == null || vendorLng == null || addressLat == null || addressLng == null) {
    return null;
  }

  const distanceKm = haversineKm(vendorLat, vendorLng, addressLat, addressLng);
  return Number.isFinite(distanceKm) ? Number(distanceKm.toFixed(3)) : null;
};

const computeVendorNeighborhoodBoundaryDistanceKm = (vendorProfile: any, address: any): number | null => {
  const vendorLat = toFiniteCoord(vendorProfile?.latitude);
  const vendorLng = toFiniteCoord(vendorProfile?.longitude);
  const addressLat = toFiniteCoord(address?.latitude);
  const addressLng = toFiniteCoord(address?.longitude);
  const directDistanceKm = computeVendorAddressDistanceKm(vendorProfile, address);

  if (addressLat == null || addressLng == null) {
    return null;
  }

  const vendorNeighborhoodKey = normalizeTrForCompare(String(vendorProfile?.neighborhood || ''));
  const addressNeighborhoodKey = normalizeTrForCompare(String(address?.neighborhood || ''));
  if (vendorNeighborhoodKey && addressNeighborhoodKey && vendorNeighborhoodKey === addressNeighborhoodKey) {
    return 0;
  }

  let containingBoundaryDistanceKm: number | null = null;
  if (vendorLat != null && vendorLng != null) {
    containingBoundaryDistanceKm = getDistanceToBoundaryOfNeighborhoodContainingPointKm({
      targetLat: addressLat,
      targetLng: addressLng,
      referenceLat: vendorLat,
      referenceLng: vendorLng,
    });
  }

  if (typeof containingBoundaryDistanceKm === 'number' && Number.isFinite(containingBoundaryDistanceKm)) {
    if (
      containingBoundaryDistanceKm > POLYGON_ANOMALY_DISTANCE_KM &&
      typeof directDistanceKm === 'number' &&
      Number.isFinite(directDistanceKm) &&
      directDistanceKm <= MAX_DELIVERY_RADIUS_KM
    ) {
      return Number(directDistanceKm.toFixed(3));
    }
    return Number(containingBoundaryDistanceKm.toFixed(3));
  }

  let nearestBoundaryDistanceKm: number | null = null;
  if (vendorLat != null && vendorLng != null) {
    nearestBoundaryDistanceKm = getDistanceToBoundaryOfNearestNeighborhoodToReferencePointKm({
      targetLat: addressLat,
      targetLng: addressLng,
      referenceLat: vendorLat,
      referenceLng: vendorLng,
    });
  }

  if (typeof nearestBoundaryDistanceKm === 'number' && Number.isFinite(nearestBoundaryDistanceKm)) {
    if (
      nearestBoundaryDistanceKm > POLYGON_ANOMALY_DISTANCE_KM &&
      typeof directDistanceKm === 'number' &&
      Number.isFinite(directDistanceKm) &&
      directDistanceKm <= MAX_DELIVERY_RADIUS_KM
    ) {
      return Number(directDistanceKm.toFixed(3));
    }
    return Number(nearestBoundaryDistanceKm.toFixed(3));
  }

  if (vendorLat != null && vendorLng != null) {
    const resolvedVendorPolygon = findNeighborhoodByCoordinate(vendorLat, vendorLng);
    if (!resolvedVendorPolygon) {
      return directDistanceKm;
    }
  }

  const neighborhoodName = String(vendorProfile?.neighborhood || '').trim();
  if (!neighborhoodName) return null;

  const namedBoundaryDistanceKm =
    vendorLat != null && vendorLng != null
      ? getDistanceToNeighborhoodBoundaryUsingReferencePointKm({
          targetLat: addressLat,
          targetLng: addressLng,
          referenceLat: vendorLat,
          referenceLng: vendorLng,
          neighborhood: neighborhoodName,
          district: vendorProfile?.district ?? null,
          city: vendorProfile?.city ?? null,
        })
      : getDistanceToNeighborhoodBoundaryKm({
          lat: addressLat,
          lng: addressLng,
          neighborhood: neighborhoodName,
          district: vendorProfile?.district ?? null,
          city: vendorProfile?.city ?? null,
        });

  if (typeof namedBoundaryDistanceKm === 'number' && Number.isFinite(namedBoundaryDistanceKm)) {
    if (
      namedBoundaryDistanceKm > POLYGON_ANOMALY_DISTANCE_KM &&
      typeof directDistanceKm === 'number' &&
      Number.isFinite(directDistanceKm) &&
      directDistanceKm <= MAX_DELIVERY_RADIUS_KM
    ) {
      return Number(directDistanceKm.toFixed(3));
    }
    return Number(namedBoundaryDistanceKm.toFixed(3));
  }

  if (typeof directDistanceKm === 'number' && Number.isFinite(directDistanceKm)) {
    return Number(directDistanceKm.toFixed(3));
  }

  return null;
};

const computeDeliveryEligibilityDistanceKm = (vendorProfile: any, address: any): number | null => {
  return computeVendorNeighborhoodBoundaryDistanceKm(vendorProfile, address);
};

const ensureWithinDeliveryRadius = (params: {
  distanceKm: number | null;
  vendorProfile: any;
  address: any;
}) => {
  const { distanceKm } = params;

  if (distanceKm == null) {
    throw new AppError(400, 'Bu adres teslimat alanı dışında');
  }
  if (distanceKm > MAX_DELIVERY_RADIUS_KM) {
    throw new AppError(400, 'Bu adres teslimat alanı dışında');
  }
};

export const getCart = async (userId: string) => {
  const cart = await prisma.cart.findUnique({
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
    return await prisma.cart.create({
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

export const addToCart = async (
  userId: string,
  productId: string,
  quantity: number
) => {
  const cart = await prisma.cart.findUnique({
    where: { userId },
  });

  const ensuredCart =
    cart ||
    (await prisma.cart.create({
      data: { userId },
    }));

  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    throw new AppError(404, 'Product not found');
  }

  if (!product.isActive) {
    throw new AppError(400, 'Product is not available');
  }

  if (product.stock < quantity) {
    throw new AppError(400, 'Not enough stock available');
  }

  // Apply active vendor campaigns to unitPrice so cart totals match what the customer sees.
  const campaigns = await getActiveCampaignsForVendor(product.vendorId);
  const unitPrice = computeDiscountedUnitPrice({
    price: product.price,
    campaigns: campaigns as any,
    productId: product.id,
  });

  const existingItem = await prisma.cartItem.findUnique({
    where: {
      cartId_productId: {
        cartId: ensuredCart.id,
        productId,
      },
    },
  });

  let cartItem;

  if (existingItem) {
    cartItem = await prisma.cartItem.update({
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
  } else {
    cartItem = await prisma.cartItem.create({
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

export const updateCartItem = async (
  userId: string,
  productId: string,
  quantity: number
) => {
  const cart = await prisma.cart.findUnique({
    where: { userId },
  });

  const ensuredCart =
    cart ||
    (await prisma.cart.create({
      data: { userId },
    }));

  if (quantity <= 0) {
    await prisma.cartItem.deleteMany({
      where: {
        cartId: ensuredCart.id,
        productId,
      },
    });
    return { success: true };
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product || product.stock < quantity) {
    throw new AppError(400, 'Not enough stock available');
  }

  const campaigns = await getActiveCampaignsForVendor(product.vendorId);
  const unitPrice = computeDiscountedUnitPrice({
    price: product.price,
    campaigns: campaigns as any,
    productId: product.id,
  });

  const cartItem = await prisma.cartItem.update({
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

export const removeFromCart = async (userId: string, productId: string) => {
  const cart = await prisma.cart.findUnique({
    where: { userId },
  });

  const ensuredCart =
    cart ||
    (await prisma.cart.create({
      data: { userId },
    }));

  await prisma.cartItem.deleteMany({
    where: {
      cartId: ensuredCart.id,
      productId,
    },
  });

  return { success: true };
};

export const clearCart = async (userId: string, vendorId?: string) => {
  const cart = await prisma.cart.findUnique({
    where: { userId },
  });

  const ensuredCart =
    cart ||
    (await prisma.cart.create({
      data: { userId },
    }));

  const requestedVendorId = String(vendorId || '').trim() || null;

  await prisma.cartItem.deleteMany({
    where: {
      cartId: ensuredCart.id,
      ...(requestedVendorId ? { product: { vendorId: requestedVendorId } } : {}),
    },
  });

  return { success: true };
};

// Order functions
export const createOrder = async (customerId: string, data: any) => {
  const loadCartWithItems = () =>
    prisma.cart.findUnique({
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
    throw new AppError(400, 'Cart is empty. Please add at least one product before checkout.');
  }

  const requestedVendorId = String((data as any)?.vendorId || '').trim() || null;
  const itemsToOrder = requestedVendorId
    ? cart.items.filter((it) => String(it.product?.vendorId || '') === requestedVendorId)
    : cart.items;

  if (itemsToOrder.length === 0) {
    throw new AppError(400, requestedVendorId ? 'Cart is empty for this store' : 'Cart is empty');
  }

  // Calculate product total
  let productTotal = 0;
  const vendorIds = new Set<string>();
  const orderItems: Array<{
    productId: string;
    vendorId: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }> = [];
  let vendorCampaigns: any[] | null = null;
  let vendorCampaignsVendorId: string | null = null;
  let appliedProductDiscountTotal = 0;
  const appliedProductDiscountTypes = new Set<string>();
  const appliedProductDiscountLabels = new Set<string>();

  for (const item of itemsToOrder) {
    if (item.product.stock < item.quantity) {
      throw new AppError(400, `Insufficient stock for ${item.product.name}`);
    }

    vendorIds.add(item.product.vendorId);

    if (!vendorCampaigns || vendorCampaignsVendorId !== item.product.vendorId) {
      vendorCampaignsVendorId = item.product.vendorId;
      vendorCampaigns = await getActiveCampaignsForVendor(item.product.vendorId);
    }

    const appliedPricing = computeAppliedProductPricing({
      price: item.product.price,
      campaigns: vendorCampaigns as any,
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

  const appliedProductDiscountType =
    appliedProductDiscountTotal > 0
      ? appliedProductDiscountTypes.size > 1
        ? 'MIXED'
        : Array.from(appliedProductDiscountTypes)[0] || null
      : null;
  const appliedProductDiscountLabel =
    appliedProductDiscountTotal > 0
      ? appliedProductDiscountLabels.size > 1
        ? 'Birden Fazla Ürün İndirimi'
        : Array.from(appliedProductDiscountLabels)[0] || 'Ürün İndirimi'
      : null;

  if (vendorIds.size !== 1) {
    throw new AppError(400, 'vendorId is required when cart contains multiple stores');
  }

  productTotal = toMoney(productTotal);

  // Enforce platform order limits (subtotal-based)
  const settings = await settingsService.getSettings();
  const commissionRateRaw = Number((settings as any)?.commissionRate ?? 0);
  const commissionRate = Number.isFinite(commissionRateRaw)
    ? Math.min(Math.max(commissionRateRaw, 0), 100)
    : 0;
  const maxOrderAmount = Number(settings?.maxOrderAmount ?? 0);
  const currency = String(settings?.currency ?? 'TRY');
  const vendorProfile = itemsToOrder[0]?.product?.vendor;
  const deliveryMode = normalizeVendorDeliveryMode(vendorProfile);
  const effectiveDeliverySettings = await resolveEffectiveVendorDeliverySettings(vendorProfile);
  const normalizedOrderType = normalizeOrderType((data as any)?.orderType);
  const isPickupOrder = normalizedOrderType === 'PICKUP';

  // Resolve and validate shipping address before any payment/order-rule checks.
  // This enforces the mandatory pre-payment distance checkpoint.
  let address: any = null;
  let deliveryDistanceKm: number | null = null;

  if (!isPickupOrder) {
    const requestedShippingAddressId = String((data as any)?.shippingAddressId || '').trim();
    address = requestedShippingAddressId
      ? await prisma.customerAddress.findUnique({ where: { id: requestedShippingAddressId } })
      : await prisma.customerAddress.findFirst({
          where: { userId: customerId },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        });

    if (!address || address.userId !== customerId) {
      throw new AppError(400, 'Invalid shipping address');
    }

    deliveryDistanceKm = computeDeliveryEligibilityDistanceKm(vendorProfile, address);
    ensureWithinDeliveryRadius({
      distanceKm: deliveryDistanceKm,
      vendorProfile,
      address,
    });
  }

  if (
    deliveryMode === 'PLATFORM' &&
    Number.isFinite(Number(effectiveDeliverySettings.minimumOrderAmount ?? 0)) &&
    Number(effectiveDeliverySettings.minimumOrderAmount ?? 0) > 0 &&
    productTotal < Number(effectiveDeliverySettings.minimumOrderAmount ?? 0)
  ) {
    throw new AppError(
      400,
      `Minimum order amount is ${Number(effectiveDeliverySettings.minimumOrderAmount ?? 0)} ${currency}`
    );
  }

  if (Number.isFinite(maxOrderAmount) && maxOrderAmount > 0 && productTotal > maxOrderAmount) {
    throw new AppError(400, `Maximum order amount is ${maxOrderAmount} ${currency}`);
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
  const sellerMinimumBasket = Number((vendorProfile as any)?.minimumOrderAmount ?? 0);
  if (
    deliveryMode === 'SELLER' &&
    Number.isFinite(sellerMinimumBasket) &&
    sellerMinimumBasket > 0 &&
    productTotal < sellerMinimumBasket
  ) {
    throw new AppError(400, `Minimum basket amount for this store is ${sellerMinimumBasket} ${currency}`);
  }

  // Store-based delivery fee
  const defaultStoreFee = Number((settings as any)?.defaultStoreFee ?? 0);
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
  const sellerId = String((vendorProfile as any)?.id || '');
  const activeSellerCampaign = sellerId
    ? await getActiveSellerCampaignForSeller(sellerId)
    : null;

  const campaignThreshold = toMoney(activeSellerCampaign?.minBasketAmount || 0);
  const campaignEligible =
    Boolean(activeSellerCampaign) &&
    campaignThreshold > 0 &&
    productTotal >= campaignThreshold;

  const campaignDiscount = campaignEligible
    ? Math.min(productTotal, toMoney(activeSellerCampaign?.discountAmount || 0))
    : 0;
  const campaignLabel = campaignEligible
    ? formatCampaignShortLabel(campaignThreshold, campaignDiscount)
    : null;

  const productTotalAfterCampaign = toMoney(productTotal - campaignDiscount);
  const deliveryBreakdown = [
    {
      seller_id: String((vendorProfile as any)?.id || ''),
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
  let deliveryTimeSlot =
    typeof data?.deliveryTimeSlot === 'string' ? data.deliveryTimeSlot.trim() : undefined;
  const customerNote =
    typeof data?.note === 'string' ? data.note.trim().slice(0, 300) : '';
  const paymentMethod = data?.paymentMethod === 'test_card' ? 'TEST_CARD' : 'CASH_ON_DELIVERY';

  const vendorOpenNow = isVendorOpenNow(
    (vendorProfile as any)?.openingTime,
    (vendorProfile as any)?.closingTime
  );
  if (vendorOpenNow === false) {
    deliveryTimeSlot = buildNextDayOpeningDeliverySlot((vendorProfile as any)?.openingTime);
  }

  const order = await prisma.$transaction(async (tx) => {
    const txAny = tx as any;

    let appliedCampaignId: string | null = null;
    let appliedCampaignDiscount = 0;
    let appliedCampaignLabel: string | null = null;

    if (campaignEligible && activeSellerCampaign?.id) {
      const now = new Date();
      const usageLimit =
        activeSellerCampaign.usageLimit == null ? null : Number(activeSellerCampaign.usageLimit);
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
        throw new AppError(409, `Insufficient stock for ${item.product.name}`);
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
      const vendorProfile = await prisma.vendorProfile.findUnique({
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
        const mailItems = (Array.isArray((order as any)?.items) ? (order as any).items : []).map(
          (item: any) => ({
            name: String(item?.product?.name || 'Ürün').trim() || 'Ürün',
            quantity: Number(item?.quantity || 0),
            unit: String(item?.product?.unit || 'adet').trim() || 'adet',
            unitPrice: Number(item?.unitPrice || 0),
            subtotal: Number(item?.subtotal || 0),
          })
        );

        const productTotalForMail = mailItems.reduce(
          (sum: number, item: { subtotal?: number }) => toMoney(sum + Number(item.subtotal || 0)),
          0
        );

        await handleMailEvent(MailEvents.NEW_ORDER, {
          email: vendorEmail,
          orderId: String((order as any).orderCode || order.id || '').trim(),
          items: mailItems,
          productTotal: productTotalForMail,
          deliveryFee: Number((order as any)?.deliveryFee || 0),
          totalPrice: Number((order as any)?.totalPrice || 0),
        });
      }
    }
  } catch (error) {
    console.warn('[orderService] new order mail failed:', error);
  }

  return attachOrderCode(order as any);
};

export const getCustomerOrders = async (customerId: string) => {
  const orders = await prisma.order.findMany({
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

  return attachOrderCodeList(orders as any[]);
};

export const getVendorOrders = async (vendorId: string) => {
  const orders = await prisma.order.findMany({
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

  return attachOrderCodeList(orders as any[]);
};

export const estimateCartDelivery = async (
  customerId: string,
  addressId?: string,
  vendorId?: string,
  orderType?: string
): Promise<{
  deliveryFee: number;
  deliveryDistanceKm: number | null;
  deliveryCoverage: string | null;
  deliveryMode?: string | null;
  preparationMinutes?: number;
  routeDeliveryMinutes?: number | null;
  estimatedMinutes?: number;
  sellerSubtotal?: number;
  campaignDiscount?: number;
  campaignLabel?: string | null;
  sellerCampaignId?: string | null;
  campaignMinBasketAmount?: number | null;
  campaignRemainingToThreshold?: number;
  appliedRule?: string | null;
  freeOverAmount?: number | null;
  flatDeliveryFee?: number | null;
  defaultStoreFee?: number;
  storeActive?: boolean;
  maxDeliveryRadiusKm?: number;
  canCheckout?: boolean;
  outsideDeliveryArea?: boolean;
  validationMessage?: string | null;
}> => {
  const cart = await prisma.cart.findUnique({
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

  const vendorIds = new Set<string>();
  for (const item of itemsToEstimate) {
    vendorIds.add(item.product.vendorId);
  }

  if (vendorIds.size !== 1) {
    throw new AppError(400, 'vendorId is required when cart contains multiple stores');
  }

  const normalizedOrderType = normalizeOrderType(orderType);
  const isPickupOrder = normalizedOrderType === 'PICKUP';

  let address: any = null;
  if (!isPickupOrder) {
    const requestedAddressId = String(addressId || '').trim();
    address = requestedAddressId
      ? await prisma.customerAddress.findUnique({ where: { id: requestedAddressId } })
      : await prisma.customerAddress.findFirst({
          where: { userId: customerId },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        });

    if (!address || address.userId !== customerId) {
      throw new AppError(400, 'Invalid shipping address');
    }
  }

  let sellerSubtotal = 0;
  let vendorCampaigns: any[] | null = null;
  let vendorCampaignsVendorId: string | null = null;

  for (const item of itemsToEstimate) {
    if (!vendorCampaigns || vendorCampaignsVendorId !== item.product.vendorId) {
      vendorCampaignsVendorId = item.product.vendorId;
      vendorCampaigns = await getActiveCampaignsForVendor(item.product.vendorId);
    }

    const unitPrice = computeDiscountedUnitPrice({
      price: item.product.price,
      campaigns: vendorCampaigns as any,
      productId: item.product.id,
    });

    sellerSubtotal += unitPrice * Number(item?.quantity || 0);
  }

  const vendorProfile: any = itemsToEstimate[0]?.product?.vendor;
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
  const defaultStoreFee = Number((settings as any)?.defaultStoreFee ?? 0);
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
    ? await getActiveSellerCampaignForSeller(String(vendorProfile.id))
    : null;
  const effectiveDeliverySettings = await resolveEffectiveVendorDeliverySettings(vendorProfile);
  const preparationMinutes = resolveVendorPreparationMinutes(vendorProfile);
  const routeDeliveryMinutes = isPickupOrder ? null : Number(effectiveDeliverySettings.deliveryMinutes ?? null);
  const estimatedMinutes = composeCustomerEtaMinutes({
    preparationMinutes,
    routeDeliveryMinutes,
    orderType: normalizedOrderType,
  });

  const campaignMinBasketAmount = toMoney(activeSellerCampaign?.minBasketAmount || 0);
  const campaignEligible =
    Boolean(activeSellerCampaign) &&
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
      ? formatCampaignShortLabel(campaignMinBasketAmount, campaignDiscount)
      : activeSellerCampaign
        ? formatCampaignShortLabel(campaignMinBasketAmount, toMoney(activeSellerCampaign.discountAmount || 0))
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

export const getVendorOrdersByUserId = async (userId: string) => {
  // Get vendor profile for user
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { vendorProfile: true },
  });

  if (!user?.vendorProfile) {
    throw new AppError(403, 'Not a vendor');
  }

  return getVendorOrders(user.vendorProfile.id);
};
export const updateOrderStatus = async (orderId: string, userId: string, status: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { vendorProfile: true },
  });

  if (!user?.vendorProfile) {
    throw new AppError(403, 'Not a vendor');
  }

  const vendorId = user.vendorProfile.id;

  // Check if vendor owns at least one item in this order
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      items: {
        some: { vendorId },
      },
    },
  });

  if (!order) {
    throw new AppError(404, 'Order not found or access denied');
  }

  const currentStatus = String(order.status || '').toUpperCase();
  const nextStatus = String(status || '').toUpperCase();
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

  const cancellationPatch =
    nextStatus === 'CANCELLED'
      ? {
          cancelReason: 'OTHER' as any,
          cancelledAt: new Date(),
          cancelledBy: 'VENDOR' as any,
          ...(String(order.paymentStatus || '') === 'PAID' ? { paymentStatus: 'REFUNDED' as any } : {}),
        }
      : {};

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: nextStatus as any,
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
      const customer = await prisma.user.findUnique({
        where: { id: order.customerId },
        select: { email: true, name: true },
      });

      const customerEmail = String(customer?.email || '').trim();
      if (customerEmail) {
        await handleMailEvent(MailEvents.ORDER_DELIVERED, {
          email: customerEmail,
          name: String(customer?.name || 'Müşteri').trim() || 'Müşteri',
          orderId: String((updated as any).orderCode || orderId).trim(),
        });
      }
    } catch (error) {
      console.warn('[orderService] delivered mail failed:', error);
    }
  }

  return attachOrderCode(updated as any);
};

export const getOrderById = async (orderId: string, userId: string) => {
  const order = await prisma.order.findFirst({
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
    throw new AppError(404, 'Order not found');
  }

  return attachOrderCode(order as any);
};

export const cancelCustomerOrder = async (
  customerId: string,
  orderId: string,
  data: { reason: string; otherDescription?: string }
) => {
  const order = await prisma.order.findUnique({
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
    throw new AppError(404, 'Order not found');
  }

  if (order.status === 'CANCELLED') {
    throw new AppError(400, 'Order is already cancelled');
  }

  const allowed = order.status === 'PENDING' || order.status === 'PREPARING';
  if (!allowed) {
    throw new AppError(400, 'Order cannot be cancelled at this stage');
  }

  const reason = String(data.reason || '').trim();
  const otherDescription = String(data.otherDescription || '').trim();

  const now = new Date();
  const shouldRefund = order.paymentStatus === 'PAID';

  const updated = await prisma.$transaction(async (tx) => {
    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
        cancelReason: reason as any,
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

  return attachOrderCode(updated as any);
};
