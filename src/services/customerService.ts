import prisma from '../config/db';
import { AppError } from '../middleware/errorHandler';
import { UpdateProfileInput, AddressInput } from '../utils/validationSchemas';
import { normalizeTrForCompare } from '../utils/trNormalize';
import { haversineKm } from '../utils/geoUtils';

const MAX_DELIVERY_RADIUS_KM = 1;

export const getCustomerProfile = async (userId: string) => {
  const user = await prisma.user.findUnique({
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
    throw new AppError(404, 'Customer not found');
  }

  return user;
};

export const updateCustomerProfile = async (
  userId: string,
  data: UpdateProfileInput
) => {
  const user = await prisma.user.update({
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

export const getCustomerAddresses = async (userId: string) => {
  const addresses = await prisma.customerAddress.findMany({
    where: { userId, isActive: true },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });

  return addresses;
};

export const getCustomerAddressById = async (addressId: string, userId: string) => {
  const address = await prisma.customerAddress.findUnique({
    where: { id: addressId },
  });

  if (!address || address.userId !== userId) {
    throw new AppError(404, 'Address not found');
  }

  return address;
};

export const addCustomerAddress = async (userId: string, data: AddressInput) => {
  const address = await prisma.customerAddress.create({
    data: {
      userId,
      ...data,
    },
  });

  return address;
};

export const updateCustomerAddress = async (
  addressId: string,
  userId: string,
  data: AddressInput
) => {
  const address = await prisma.customerAddress.findUnique({
    where: { id: addressId },
  });

  if (!address || address.userId !== userId) {
    throw new AppError(404, 'Address not found');
  }

  const updated = await prisma.customerAddress.update({
    where: { id: addressId },
    data,
  });

  return updated;
};

export const deleteCustomerAddress = async (
  addressId: string,
  userId: string
) => {
  const address = await prisma.customerAddress.findUnique({
    where: { id: addressId },
  });

  if (!address || address.userId !== userId) {
    throw new AppError(404, 'Address not found');
  }

  // If an address is referenced by any orders, soft-delete instead of hard-delete
  // to preserve order history integrity (foreign key constraint).
  const usedInOrders = await prisma.order.count({
    where: { customerId: userId, shippingAddressId: addressId },
  });

  if (usedInOrders > 0) {
    // Soft-delete: mark inactive, keep for order references
    await prisma.customerAddress.update({
      where: { id: addressId },
      data: {
        isActive: false,
        deactivatedAt: new Date(),
        deactivationReason: 'Kullanıcı tarafından silindi (siparişlerde kullanılmış)',
      },
    });
  } else {
    // No orders reference this address, safe to hard-delete
    await prisma.customerAddress.delete({
      where: { id: addressId },
    });
  }

  // If the deleted address was default, try to set another one as default.
  if (address.isDefault) {
    const next = await prisma.customerAddress.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    if (next?.id) {
      await prisma.customerAddress.update({
        where: { id: next.id },
        data: { isDefault: true },
      });
    }
  }

  return { success: true };
};

export const setDefaultAddress = async (
  addressId: string,
  userId: string
) => {
  const address = await prisma.customerAddress.findUnique({
    where: { id: addressId },
  });

  if (!address || address.userId !== userId) {
    throw new AppError(404, 'Address not found');
  }

  // Remove default from all other addresses
  await prisma.customerAddress.updateMany({
    where: { userId },
    data: { isDefault: false },
  });

  // Set this address as default
  const updated = await prisma.customerAddress.update({
    where: { id: addressId },
    data: { isDefault: true },
  });

  return updated;
};

export const getCategories = async () => {
  const subCategories = await (prisma as any).subCategory.findMany({
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

interface GetProductsOptions {
  categoryId?: string;
  vendorId?: string;
  search?: string;
  sort?: 'newest' | 'price-asc' | 'price-desc';
  page?: number;
  limit?: number;
  neighborhood?: string; // Müşterinin seçtiği mahalle - önceliklendirme için
  district?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  expandToNeighbors?: boolean;
  discountOnly?: boolean;
  specialOnly?: boolean;
}

const buildPublicProductWhere = (): any => ({
  isActive: true,
  vendor: { status: 'APPROVED', user: { isActive: true } },
  OR: [{ subCategoryId: null }, { subCategory: { isActive: true, category: { isActive: true } } }],
});

const safeJsonArray = (raw: any): string[] => {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed.map((x) => String(x)) : [];
  } catch {
    return [];
  }
};

const computeDiscountForProduct = (params: {
  price: number;
  campaigns: Array<{
    scope: string;
    discountType: string;
    discountAmount: number;
    selectedProducts: string;
  }>;
  productId: string;
}) => {
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
      if (!selected.includes(params.productId)) continue;
    }

    const type = String(c.discountType || '').toLowerCase();
    const amount = Number(c.discountAmount || 0);
    if (!Number.isFinite(amount) || amount <= 0) continue;

    let pct = 0;
    let discounted = price;

    if (type === 'percentage') {
      pct = Math.max(0, Math.min(100, amount));
      discounted = price * (1 - pct / 100);
    } else if (type === 'fixed') {
      discounted = Math.max(0, price - amount);
      pct = price > 0 ? (amount / price) * 100 : 0;
    } else {
      continue;
    }

    if (
      discounted < bestPrice - 1e-6 ||
      (Math.abs(discounted - bestPrice) < 1e-6 && pct > bestPct)
    ) {
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

const attachActiveCampaignDiscounts = async (products: any[]) => {
  if (!Array.isArray(products) || products.length === 0) return products;

  const vendorIds = Array.from(
    new Set(products.map((p) => p?.vendor?.id || p?.vendorId).filter(Boolean).map(String))
  );
  if (vendorIds.length === 0) return products;

  const now = new Date();
  let campaigns: Array<{
    vendorProfileId: string;
    scope: string;
    discountType: string;
    discountAmount: number;
    selectedProducts: string;
  }> = [];

  try {
    campaigns = await prisma.campaign.findMany({
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
  } catch (error) {
    // Campaign enrichment is optional for customer catalog; do not break product listing.
    console.warn('[customerService] campaign enrichment skipped:', String((error as any)?.message || error));
    campaigns = [];
  }

  const campaignsByVendor = new Map<string, typeof campaigns>();
  for (const c of campaigns) {
    const k = String(c.vendorProfileId);
    const prev = campaignsByVendor.get(k);
    if (prev) prev.push(c);
    else campaignsByVendor.set(k, [c]);
  }

  return products.map((p: any) => {
    const vendorId = String(p?.vendor?.id || p?.vendorId || '');
    const list = (campaignsByVendor.get(vendorId) || []) as any;
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

export const getProducts = async (options: GetProductsOptions) => {
  const {
    categoryId,
    vendorId,
    search,
    sort = 'newest',
    page = 1,
    limit = 20,
    neighborhood,
    district,
    city,
    latitude,
    longitude,
    expandToNeighbors = false,
    discountOnly = false,
    specialOnly = false,
  } = options;

  const skip = (page - 1) * limit;

  const baseWhere: any = {
    ...buildPublicProductWhere(),
  };

  if (categoryId) {
    const normalizedCategoryId = String(categoryId).trim();
    const resolvedSubCategory = await (prisma as any).subCategory.findFirst({
      where: {
        isActive: true,
        category: { isActive: true },
        OR: [{ id: normalizedCategoryId }, { slug: normalizedCategoryId }],
      },
      select: { id: true, slug: true, categoryId: true },
    });

    if (resolvedSubCategory) {
      baseWhere.subCategoryId = resolvedSubCategory.id;
    } else {
    const resolvedCategory = await prisma.category.findFirst({
      where: {
        OR: [{ id: normalizedCategoryId }, { slug: normalizedCategoryId }],
      },
      select: { id: true, slug: true },
    });

      if (resolvedCategory) {
        baseWhere.categoryId = resolvedCategory.id;
      } else {
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

  let orderBy: any = { createdAt: 'desc' };

  if (sort === 'price-asc') {
    orderBy = { price: 'asc' };
  } else if (sort === 'price-desc') {
    orderBy = { price: 'desc' };
  }

  const hasCenter = Number.isFinite(latitude) && Number.isFinite(longitude);

  if (neighborhood || hasCenter) {
    const normalizedNeighborhood = neighborhood ? normalizeTrForCompare(neighborhood) : '';
    const normalizedDistrict = district ? normalizeTrForCompare(district) : '';
    const normalizedCity = city ? normalizeTrForCompare(city) : '';

    const allProductsResult = await prisma.product.findMany({
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

    const withinRadiusProducts: typeof allProductsResult = [];
    const sameNeighborhoodProducts: typeof allProductsResult = [];
    const neighborProducts: typeof allProductsResult = [];

    for (const product of allProductsResult) {
      const vendorLat = Number(product.vendor?.latitude);
      const vendorLng = Number(product.vendor?.longitude);

      if (hasCenter) {
        if (!Number.isFinite(vendorLat) || !Number.isFinite(vendorLng)) {
          continue;
        }
        const distanceKm = haversineKm(
          Number(latitude),
          Number(longitude),
          vendorLat,
          vendorLng
        );
        if (!Number.isFinite(distanceKm) || distanceKm > MAX_DELIVERY_RADIUS_KM) {
          continue;
        }
      }

      withinRadiusProducts.push(product);

      const vendorNeighborhood = normalizeTrForCompare(product.vendor?.neighborhood);
      const vendorDistrict = normalizeTrForCompare(product.vendor?.district);
      const vendorCity = normalizeTrForCompare(product.vendor?.city);

      const neighborhoodMatch =
        normalizedNeighborhood &&
        vendorNeighborhood &&
        vendorNeighborhood === normalizedNeighborhood;
      const districtMatch = normalizedDistrict ? vendorDistrict === normalizedDistrict : true;
      const cityMatch = normalizedCity ? vendorCity === normalizedCity : true;

      if (neighborhoodMatch && districtMatch && cityMatch) {
        sameNeighborhoodProducts.push(product);
      } else {
        neighborProducts.push(product);
      }
    }

    const neighborhoodLabel = [neighborhood, district, city]
      .map((x) => String(x || '').trim())
      .filter(Boolean)
      .join(', ');

    const taggedSameNeighborhood = sameNeighborhoodProducts.map((p: any) => ({
      ...p,
      _isFromSelectedNeighborhood: true,
      _neighborhoodLabel: neighborhoodLabel || neighborhood || p.vendor?.neighborhood || 'Mahalle',
    }));

    const taggedNeighbors = neighborProducts.map((p: any) => ({
      ...p,
      _isFromSelectedNeighborhood: false,
      _neighborhoodLabel: p.vendor?.neighborhood || 'Komşu Mahalle',
    }));

    let selectedProducts: any[] = [];
    if (neighborhood) {
      if (taggedSameNeighborhood.length > 0) {
        selectedProducts = taggedSameNeighborhood;
      } else if (expandToNeighbors) {
        selectedProducts = taggedNeighbors;
      } else {
        selectedProducts = [];
      }
    } else {
      selectedProducts = withinRadiusProducts.map((p: any) => ({
        ...p,
        _isFromSelectedNeighborhood: null,
        _neighborhoodLabel: p.vendor?.neighborhood || 'Mahalle',
      }));
    }

    let allProducts: any[] = await attachActiveCampaignDiscounts(selectedProducts);
    if (discountOnly) {
      allProducts = allProducts
        .filter((p: any) => Number(p?._discountPercentage || 0) > 0)
        .sort((a: any, b: any) => {
          const pct = Number(b?._discountPercentage || 0) - Number(a?._discountPercentage || 0);
          if (pct !== 0) return pct;

          const bOld = Number(b?.price || 0);
          const aOld = Number(a?.price || 0);
          const bNew = Number(b?._discountedPrice || b?.price || 0);
          const aNew = Number(a?._discountedPrice || a?.price || 0);
          const bAbs = bOld - bNew;
          const aAbs = aOld - aNew;
          if (bAbs !== aAbs) return bAbs - aAbs;

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
    prisma.product.findMany({
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
    prisma.product.count({ where: baseWhere }),
  ]);

  let enriched: any[] = await attachActiveCampaignDiscounts(products as any);

  // `discountOnly` requires post-filter + pagination on the server side.
  if (discountOnly) {
    enriched = enriched
      .filter((p: any) => Number(p?._discountPercentage || 0) > 0)
      .sort((a: any, b: any) => {
        const pct = Number(b?._discountPercentage || 0) - Number(a?._discountPercentage || 0);
        if (pct !== 0) return pct;

        const bOld = Number(b?.price || 0);
        const aOld = Number(a?.price || 0);
        const bNew = Number(b?._discountedPrice || b?.price || 0);
        const aNew = Number(a?._discountedPrice || a?.price || 0);
        const bAbs = bOld - bNew;
        const aAbs = aOld - aNew;
        if (bAbs !== aAbs) return bAbs - aAbs;

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

export const getBestSellerProductsForVendor = async (params: {
  vendorId: string;
  limit?: number;
}) => {
  const vendorId = String(params.vendorId || '').trim();
  const limit = Math.max(1, Math.min(40, Number(params.limit || 12) || 12));

  if (!vendorId) {
    throw new AppError(400, 'vendorId is required');
  }

  // Count only delivered orders to represent actual best-sellers.
  const grouped = await (prisma as any).orderItem.groupBy({
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
    ? grouped.map((g: any) => String(g.productId)).filter(Boolean)
    : [];

  if (productIds.length === 0) {
    // Fallback: if there are no delivered orders yet, return newest vendor products.
    const newest = await prisma.product.findMany({
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

    return await attachActiveCampaignDiscounts(newest as any);
  }

  const products = await prisma.product.findMany({
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

  const enriched: any[] = await attachActiveCampaignDiscounts(products as any);
  const byId = new Map(enriched.map((p: any) => [String(p.id), p]));

  // Keep the ranking order from groupBy
  return productIds.map((id) => byId.get(String(id))).filter(Boolean);
};

export const getProductById = async (productId: string) => {
  const product = await prisma.product.findFirst({
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
    throw new AppError(404, 'Product not found');
  }

  const enriched = await attachActiveCampaignDiscounts([product as any]);
  return (enriched[0] as any) || product;
};

export const getProductReviews = async (productId: string, limit: number = 30) => {
  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      ...buildPublicProductWhere(),
    },
    select: { id: true },
  });

  if (!product) {
    throw new AppError(404, 'Product not found');
  }

  const reviews = await (prisma as any).productReview.findMany({
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

export const upsertProductReview = async (params: {
  productId: string;
  customerId: string;
  comment: string;
  rating?: number;
}) => {
  const { productId, customerId, comment, rating } = params;

  const product = await prisma.product.findUnique({
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

  if (
    !product ||
    !product.isActive ||
    product.vendor?.status !== 'APPROVED' ||
    !product.vendor?.user?.isActive
  ) {
    throw new AppError(404, 'Product not found');
  }

  const existing = await (prisma as any).productReview.findFirst({
    where: { productId, customerId },
    select: { id: true },
  });

  if (existing) {
    return (prisma as any).productReview.update({
      where: { id: existing.id },
      data: { comment, ...(typeof rating === 'number' ? { rating } : {}) },
      include: { customer: { select: { id: true, name: true } } },
    });
  }

  return (prisma as any).productReview.create({
    data: { productId, customerId, comment, ...(typeof rating === 'number' ? { rating } : {}) },
    include: { customer: { select: { id: true, name: true } } },
  });
};

export const getNeighborhoodLiveStats = async (neighborhood?: string) => {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const input = (neighborhood as any) && typeof (neighborhood as any) === 'object'
    ? (neighborhood as any)
    : { neighborhood };

  const neighborhoodTrimmed = typeof input.neighborhood === 'string' ? input.neighborhood.trim() : '';
  const districtTrimmed = typeof input.district === 'string' ? input.district.trim() : '';
  const cityTrimmed = typeof input.city === 'string' ? input.city.trim() : '';

  const shippingAddress: any = {};
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

  const ordersToday = await prisma.order.count({
    where: {
      createdAt: { gte: start, lt: end },
      ...neighborhoodFilter,
    },
  });

  const preparingVendors = await prisma.orderItem.findMany({
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
