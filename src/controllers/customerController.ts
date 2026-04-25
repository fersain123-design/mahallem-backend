import { Request, Response, NextFunction } from 'express';
import * as customerService from '../services/customerService';
import {
  UpdateProfileSchema,
  AddressSchema,
  AddToCartSchema,
  UpdateCartItemSchema,
  CreateOrderSchema,
  CreateProductReviewSchema,
  CreateSellerRatingSchema,
  UpdateSellerRatingSchema,
  GetOrderSellerRatingQuerySchema,
  ListSellerRatingsQuerySchema,
} from '../utils/validationSchemas';
import * as orderService from '../services/orderService';
import * as sellerRatingService from '../services/sellerRatingService';
import prisma from '../config/db';
import { AppError } from '../middleware/errorHandler';
import { normalizeTrForCompare } from '../utils/trNormalize';
import {
  formatCampaignShortLabel,
  getActiveSellerCampaignForSeller,
  getActiveSellerCampaignMapForSellers,
} from '../services/sellerCampaignService';
import {
  getPlatformNeighborhoodSettingsMap,
  resolveEffectiveVendorDeliverySettings,
} from '../services/platformNeighborhoodDeliveryService';
import {
  isExpoPushToken,
  sendPushNotificationToUser,
} from '../services/pushNotificationService';

const normalizeBusinessType = (value?: string | null) => {
  if (!value) return undefined;
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

  const normalized = String(value)
    .trim()
    .split('')
    .map((ch) => map[ch] ?? ch)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

  return normalized || undefined;
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

const computeIsOpenNow = (
  openingTime?: string | null,
  closingTime?: string | null,
  storeOpenOverride?: boolean | null
): boolean | null => {
  if (typeof storeOpenOverride === 'boolean') {
    return storeOpenOverride;
  }

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

const toMoney = (value: unknown): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Number(n.toFixed(2));
};

const formatDeliveryRangeText = (minMinutes: unknown, maxMinutes: unknown): string | null => {
  const min = Number(minMinutes);
  const max = Number(maxMinutes);

  const minOk = Number.isFinite(min) && min > 0;
  const maxOk = Number.isFinite(max) && max > 0;
  if (!minOk && !maxOk) return null;

  const safeMin = minOk ? Math.round(min) : Math.round(max);
  const roundedMax = maxOk ? Math.round(max) : null;

  if (roundedMax != null && roundedMax > safeMin) {
    return `${safeMin}-${roundedMax} dk`;
  }

  return `${safeMin} dk`;
};

const resolveProductDisplayCategory = (product: any) => {
  return String(product?.subCategory?.name || product?.subCategoryName || product?.category?.name || '').trim();
};

// Profile endpoints
export const getProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const profile = await customerService.getCustomerProfile(req.user.userId);
    res.status(200).json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const data = UpdateProfileSchema.parse(req.body);
    const profile = await customerService.updateCustomerProfile(
      req.user.userId,
      data
    );
    res.status(200).json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
};

export const getNotifications = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const limitRaw = req.query.limit;
    const limit = limitRaw ? parseInt(limitRaw as string, 10) : 20;
    const unreadOnlyRaw = String(req.query.unreadOnly || '').trim().toLowerCase();
    const unreadOnly = unreadOnlyRaw === 'true' || unreadOnlyRaw === '1';

    const notifications = await prisma.notification.findMany({
      where: {
        userId: req.user.userId,
        ...(unreadOnly ? { isRead: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
    });

    res.status(200).json({ success: true, data: notifications });
  } catch (error) {
    next(error);
  }
};

export const markNotificationAsRead = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const existing = await prisma.notification.findFirst({
      where: { id, userId: req.user.userId },
    });

    if (!existing) {
      res.status(404).json({ success: false, message: 'Notification not found' });
      return;
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

export const markAllNotificationsAsRead = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const result = await prisma.notification.updateMany({
      where: {
        userId: req.user.userId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    res.status(200).json({ success: true, data: { updatedCount: result.count } });
  } catch (error) {
    next(error);
  }
};

export const registerPushToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const token = String(req.body?.token || '').trim();
    const platform = String(req.body?.platform || '').trim() || null;
    const deviceId = String(req.body?.deviceId || '').trim() || null;

    if (!token || !isExpoPushToken(token)) {
      res.status(400).json({ success: false, message: 'Invalid Expo push token' });
      return;
    }

    const saved = await prisma.userDeviceToken.upsert({
      where: { token },
      update: {
        userId: req.user.userId,
        isActive: true,
        platform,
        deviceId,
        lastSeenAt: new Date(),
      },
      create: {
        userId: req.user.userId,
        token,
        platform,
        deviceId,
        isActive: true,
        lastSeenAt: new Date(),
      },
    });

    res.status(200).json({ success: true, data: { id: saved.id, token: saved.token } });
  } catch (error) {
    next(error);
  }
};

export const unregisterPushToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const token = String(req.body?.token || '').trim();

    if (token) {
      await prisma.userDeviceToken.updateMany({
        where: {
          userId: req.user.userId,
          token,
        },
        data: {
          isActive: false,
          lastSeenAt: new Date(),
        },
      });
    } else {
      await prisma.userDeviceToken.updateMany({
        where: { userId: req.user.userId },
        data: {
          isActive: false,
          lastSeenAt: new Date(),
        },
      });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};

export const sendTestPushNotification = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const title = String(req.body?.title || 'Mahallem Bildirimi').trim();
    const body = String(req.body?.body || 'Mahallem akıllı bildirim sistemi aktif.').trim();
    const route = String(req.body?.route || '/notifications').trim();

    const result = await sendPushNotificationToUser(req.user.userId, {
      title,
      body,
      data: {
        route,
        source: 'test',
        notificationType: 'SYSTEM_TEST',
        logoUrl: 'https://mahallem.live/logo.png',
      },
      subtitle: 'Test Bildirimi',
      imageUrl: 'https://mahallem.live/logo.png',
    });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getPushStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const tokens = await prisma.userDeviceToken.findMany({
      where: {
        userId: req.user.userId,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      select: {
        token: true,
        isActive: true,
        platform: true,
        deviceId: true,
        updatedAt: true,
      },
    });

    const masked = tokens.map((entry) => {
      const token = String(entry.token || '');
      const maskStart = token.slice(0, 22);
      const maskEnd = token.slice(-6);
      return {
        token: `${maskStart}...${maskEnd}`,
        isActive: entry.isActive,
        platform: entry.platform,
        deviceId: entry.deviceId,
        updatedAt: entry.updatedAt,
      };
    });

    const activeCount = tokens.filter((entry) => entry.isActive).length;

    res.status(200).json({
      success: true,
      data: {
        activeCount,
        totalCount: tokens.length,
        tokens: masked,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Address endpoints
export const getAddresses = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const addresses = await customerService.getCustomerAddresses(
      req.user.userId
    );
    res.status(200).json({ success: true, data: addresses });
  } catch (error) {
    next(error);
  }
};

export const getAddressById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const address = await customerService.getCustomerAddressById(id, req.user.userId);
    res.status(200).json({ success: true, data: address });
  } catch (error) {
    next(error);
  }
};

export const addAddress = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const data = AddressSchema.parse(req.body);
    const address = await customerService.addCustomerAddress(
      req.user.userId,
      data
    );
    res.status(201).json({ success: true, data: address });
  } catch (error) {
    next(error);
  }
};

export const updateAddress = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const data = AddressSchema.parse(req.body);
    const address = await customerService.updateCustomerAddress(
      id,
      req.user.userId,
      data
    );
    res.status(200).json({ success: true, data: address });
  } catch (error) {
    next(error);
  }
};

export const deleteAddress = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const result = await customerService.deleteCustomerAddress(
      id,
      req.user.userId
    );
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const setDefaultAddress = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const address = await customerService.setDefaultAddress(
      id,
      req.user.userId
    );
    res.status(200).json({ success: true, data: address });
  } catch (error) {
    next(error);
  }
};

// Product & Category endpoints
export const getCategories = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const categories = await customerService.getCategories();
    res.status(200).json({
      success: true,
      data: categories.map((c: any) => {
        const icon = 'icon' in c ? c.icon : null;
        const image = 'image' in c ? c.image : null;

        return {
          id: c.slug || c.id,
          name: c.name,
          icon: icon || 'shape-outline',
          image: image || 'market.jpg',
        };
      }),
    });
  } catch (error) {
    next(error);
  }
};

export const getProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      categoryId,
      search,
      sort,
      page,
      limit,
      vendorId,
      neighborhood,
      district,
      city,
      discount,
      special,
      expandToNeighbors,
      latitude,
      longitude,
      lat,
      lng,
    } = req.query;

    const parsedLatitude = Number(latitude ?? lat);
    const parsedLongitude = Number(longitude ?? lng);
    const hasCoordinates = Number.isFinite(parsedLatitude) && Number.isFinite(parsedLongitude);

    const result = await customerService.getProducts({
      categoryId: categoryId as string | undefined,
      search: search as string | undefined,
      sort: (sort as any) || 'newest',
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20,
      vendorId: vendorId as string | undefined,
      neighborhood: neighborhood as string | undefined,
      district: district as string | undefined,
      city: city as string | undefined,
      latitude: hasCoordinates ? parsedLatitude : undefined,
      longitude: hasCoordinates ? parsedLongitude : undefined,
      expandToNeighbors:
        String(expandToNeighbors || '')
          .trim()
          .toLowerCase() === 'true',
      discountOnly:
        String(discount || '')
          .trim()
          .toLowerCase() === 'true',
      specialOnly:
        String(special || '')
          .trim()
          .toLowerCase() === 'true',
    } as any);

    const rawProducts = Array.isArray(result.products) ? result.products : [];
    const productIds = rawProducts.map((p: any) => String(p?.id || '')).filter(Boolean);

    const [salesAgg, reviewsAgg] = await Promise.all([
      productIds.length > 0
        ? (prisma as any).orderItem.groupBy({
            by: ['productId'],
            where: {
              productId: { in: productIds },
              order: { status: 'DELIVERED' },
            },
            _sum: { quantity: true },
          })
        : Promise.resolve([]),
      productIds.length > 0
        ? (prisma as any).productReview.groupBy({
            by: ['productId'],
            where: { productId: { in: productIds } },
            _count: { _all: true },
            _avg: { rating: true },
          })
        : Promise.resolve([]),
    ]);

    const soldMap = new Map<string, number>();
    for (const row of (salesAgg || []) as any[]) {
      soldMap.set(String(row.productId), Number(row?._sum?.quantity || 0));
    }

    const reviewMap = new Map<string, { rating: number; rating_count: number }>();
    for (const row of (reviewsAgg || []) as any[]) {
      const avg = Number(row?._avg?.rating || 0);
      const count = Number(row?._count?._all || 0);
      reviewMap.set(String(row.productId), {
        rating: Number.isFinite(avg) ? Math.round(avg * 10) / 10 : 0,
        rating_count: Number.isFinite(count) ? count : 0,
      });
    }

    // Map to customer-app product shape
    const products = rawProducts.map((p: any) => {
      const images: string[] = Array.isArray(p?.images)
        ? p.images.map((im: any) => im?.imageUrl).filter(Boolean)
        : [];
      const primaryImage = p?.imageUrl || images[0];
      const normalizedImages = primaryImage
        ? [primaryImage, ...images.filter((u) => u !== primaryImage)]
        : images;
      const productId = String(p.id || '');
      const review = reviewMap.get(productId) || { rating: 0, rating_count: 0 };

      return {
        _id: p.id,
        name: p.name,
        price: Number(p?._discountedPrice ?? p.price ?? 0),
        created_at: p?.createdAt || null,
        images: normalizedImages,
        category: resolveProductDisplayCategory(p),
        categoryName: resolveProductDisplayCategory(p),
        categorySlug: String(p?.subCategory?.slug || p?.category?.slug || '').trim(),
        unit: p.unit,
        stock: Number(p.stock || 0),
        is_available: Boolean(p.isActive) && Number(p.stock || 0) > 0,
        discount_percentage: Number(p?._discountPercentage || 0),
        vendor_id: p?.vendor?.id || p.vendorId,
        vendor_name: p?.vendor?.shopName || null,
        description: p?.description || '',
        vendor_neighborhood: p?.vendor?.neighborhood || null,
        vendor_district: p?.vendor?.district || null,
        vendor_city: p?.vendor?.city || null,
        likes_count: review.rating_count,
        sold_count: Number(soldMap.get(productId) || 0),
        rating: review.rating,
        rating_count: review.rating_count,
        // Mahalle önceliklendirme bilgisi
        is_from_selected_neighborhood: p?._isFromSelectedNeighborhood ?? null,
        neighborhood_label: p?._neighborhoodLabel ?? null,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        products,
        pagination: result.pagination,
        // Mahalle istatistikleri (eğer varsa)
        neighborhoodStats: (result as any).neighborhoodStats || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getBestSellerProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const vendorId = String(req.query.vendorId || '').trim();
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 12;

    if (!vendorId) {
      res.status(400).json({ success: false, message: 'vendorId is required' });
      return;
    }

    const list: any[] = await customerService.getBestSellerProductsForVendor({
      vendorId,
      limit,
    } as any);

    const products = (list || []).map((p: any) => {
      const images: string[] = Array.isArray(p?.images)
        ? p.images.map((im: any) => im?.imageUrl).filter(Boolean)
        : [];
      const primaryImage = p?.imageUrl || images[0];
      const normalizedImages = primaryImage
        ? [primaryImage, ...images.filter((u) => u !== primaryImage)]
        : images;

      return {
        _id: p.id,
        name: p.name,
        price: Number(p?._discountedPrice ?? p.price ?? 0),
        images: normalizedImages,
        category: resolveProductDisplayCategory(p),
        categoryName: resolveProductDisplayCategory(p),
        categorySlug: String(p?.subCategory?.slug || p?.category?.slug || '').trim(),
        unit: p.unit,
        stock: Number(p.stock || 0),
        is_available: Boolean(p.isActive) && Number(p.stock || 0) > 0,
        discount_percentage: Number(p?._discountPercentage || 0),
        vendor_id: p?.vendor?.id || p.vendorId,
        vendor_name: p?.vendor?.shopName || 'Satıcı',
        vendor_delivery_coverage: p?.vendor?.deliveryCoverage || null,
        description: p?.description || '',
        vendor_neighborhood: p?.vendor?.neighborhood || null,
        vendor_district: p?.vendor?.district || null,
        vendor_city: p?.vendor?.city || null,
        likes_count: 0,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        products,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getProductById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const p: any = await customerService.getProductById(id);

    const reviews = await customerService.getProductReviews(id, 30).catch(() => []);

    const images: string[] = Array.isArray(p?.images)
      ? p.images.map((im: any) => im?.imageUrl).filter(Boolean)
      : [];
    const primaryImage = p?.imageUrl || images[0];
    const normalizedImages = primaryImage
      ? [primaryImage, ...images.filter((u) => u !== primaryImage)]
      : images;

    const mapped = {
      _id: p.id,
      name: p.name,
      price: Number(p?._discountedPrice ?? p.price ?? 0),
      images: normalizedImages,
      category: resolveProductDisplayCategory(p),
      categoryName: resolveProductDisplayCategory(p),
      categorySlug: String(p?.subCategory?.slug || p?.category?.slug || '').trim(),
      unit: p.unit,
      stock: Number(p.stock || 0),
      is_available: Boolean(p.isActive) && Number(p.stock || 0) > 0,
      discount_percentage: Number(p?._discountPercentage || 0),
      vendor_id: p?.vendor?.id || p.vendorId,
      vendor_delivery_coverage: p?.vendor?.deliveryCoverage || null,
      likes_count: 0,
      description: p.description || '',
      vendor_name: p?.vendor?.shopName || 'Satıcı',
      vendor_address: p?.vendor?.address || '',
      vendor_neighborhood: p?.vendor?.neighborhood || null,
      vendor_district: p?.vendor?.district || null,
      vendor_city: p?.vendor?.city || null,
      rating: (() => {
        if (!Array.isArray(reviews) || reviews.length === 0) return 0;
        const rated = reviews
          .map((r: any) => (typeof r?.rating === 'number' ? r.rating : null))
          .filter((v: any) => typeof v === 'number' && Number.isFinite(v)) as number[];
        if (rated.length === 0) return 0;
        const avg = rated.reduce((sum, v) => sum + v, 0) / rated.length;
        return Math.round(avg * 10) / 10;
      })(),
      reviews: Array.isArray(reviews)
        ? reviews.map((r: any) => ({
            id: r.id,
            comment: r.comment,
            rating: typeof r?.rating === 'number' ? r.rating : null,
            vendorReply: r?.vendorReply ?? null,
            createdAt: r.createdAt,
            customer: r.customer ? { id: r.customer.id, name: r.customer.name } : null,
          }))
        : [],
    };

    res.status(200).json({ success: true, data: mapped });
  } catch (error) {
    next(error);
  }
};

export const getProductReviews = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 30;
    const reviews = await customerService.getProductReviews(id, limit);

    res.status(200).json({
      success: true,
      data: reviews.map((r: any) => ({
        id: r.id,
        comment: r.comment,
        rating: typeof r?.rating === 'number' ? r.rating : null,
        vendorReply: r?.vendorReply ?? null,
        createdAt: r.createdAt,
        customer: r.customer ? { id: r.customer.id, name: r.customer.name } : null,
      })),
    });
  } catch (error) {
    next(error);
  }
};

export const addProductReview = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const body = CreateProductReviewSchema.parse(req.body);

    const review = await customerService.upsertProductReview({
      productId: id,
      customerId: req.user.userId,
      comment: body.comment,
      rating: body.rating,
    });

    res.status(201).json({
      success: true,
      data: {
        id: review.id,
        comment: review.comment,
        rating: typeof (review as any)?.rating === 'number' ? (review as any).rating : null,
        vendorReply: (review as any)?.vendorReply ?? null,
        createdAt: review.createdAt,
        customer: review.customer ? { id: review.customer.id, name: review.customer.name } : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createOrderSellerRating = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const body = CreateSellerRatingSchema.parse(req.body);
    const created = await sellerRatingService.createSellerRating({
      orderId: id,
      customerId: req.user.userId,
      vendorId: body.vendorId,
      rating: body.rating,
      comment: body.comment,
    });

    res.status(201).json({
      success: true,
      data: created,
    });
  } catch (error) {
    next(error);
  }
};

export const updateOrderSellerRating = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const body = UpdateSellerRatingSchema.parse(req.body);
    const updated = await sellerRatingService.updateSellerRating({
      orderId: id,
      customerId: req.user.userId,
      vendorId: body.vendorId,
      rating: body.rating,
      comment: body.comment,
    });

    res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

export const getOrderSellerRating = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const query = GetOrderSellerRatingQuerySchema.parse(req.query);
    const result = await sellerRatingService.getOrderSellerRating({
      orderId: id,
      customerId: req.user.userId,
      vendorId: query.vendorId,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getVendorRatingsSummary = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const summary = await sellerRatingService.getSellerRatingSummary(id);
    res.status(200).json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
};

export const getVendorRatings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const query = ListSellerRatingsQuerySchema.parse(req.query);
    const result = await sellerRatingService.getSellerRatings({
      vendorId: id,
      page: query.page,
      limit: query.limit,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getNeighborhoodLiveStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const neighborhood = typeof req.query.neighborhood === 'string' ? req.query.neighborhood : undefined;
    const district = typeof req.query.district === 'string' ? req.query.district : undefined;
    const city = typeof req.query.city === 'string' ? req.query.city : undefined;
    const stats = await customerService.getNeighborhoodLiveStats({ neighborhood, district, city } as any);
    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
};

const computeVendorRatingsFromProductReviews = async (vendorIds: string[]) => {
  const ids = Array.from(new Set((vendorIds || []).map((x) => String(x || '').trim()).filter(Boolean)));
  if (ids.length === 0) return new Map<string, { rating: number | null; rating_count: number }>();

  const rows = await prisma.productReview.findMany({
    where: {
      rating: { not: null },
      product: { vendorId: { in: ids } },
    },
    select: {
      rating: true,
      product: { select: { vendorId: true } },
    },
  });

  const sums = new Map<string, { sum: number; count: number }>();
  for (const r of rows as any[]) {
    const vendorId = String(r?.product?.vendorId || '').trim();
    const rating = typeof r?.rating === 'number' ? r.rating : null;
    if (!vendorId || rating == null) continue;
    const prev = sums.get(vendorId) || { sum: 0, count: 0 };
    sums.set(vendorId, { sum: prev.sum + rating, count: prev.count + 1 });
  }

  const out = new Map<string, { rating: number | null; rating_count: number }>();
  for (const id of ids) {
    const agg = sums.get(id);
    if (!agg || agg.count <= 0) {
      out.set(id, { rating: null, rating_count: 0 });
    } else {
      const avg = Math.round((agg.sum / agg.count) * 10) / 10;
      out.set(id, { rating: avg, rating_count: agg.count });
    }
  }
  return out;
};

// Vendor endpoints
export const getVendors = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { city, district, neighborhood } = req.query;

    const whereClause: any = { status: 'APPROVED', user: { isActive: true } };

    const vendors = await prisma.vendorProfile.findMany({
      where: whereClause,
      select: {
        id: true,
        userId: true,
        createdAt: true,
        shopName: true,
        address: true,
        latitude: true,
        longitude: true,
        status: true,
        businessType: true,
        storeAbout: true,
        openingTime: true,
        closingTime: true,
        storeOpenOverride: true,
        storeCoverImageUrl: true,
        storeLogoImageUrl: true,
        preparationMinutes: true,
        deliveryMinutes: true,
        deliveryMaxMinutes: true,
        minimumOrderAmount: true,
        deliveryMode: true,
        deliveryCoverage: true,
        flatDeliveryFee: true,
        freeOverAmount: true,
        isActive: true,
        neighborhood: true,
        district: true,
        city: true,
        user: {
          select: {
            name: true,
          },
        },
      },
    });

    const neighborhoodFilter = typeof neighborhood === 'string' ? normalizeTrForCompare(neighborhood) : '';
    const districtFilter = typeof district === 'string' ? normalizeTrForCompare(district) : '';
    const cityFilter = typeof city === 'string' ? normalizeTrForCompare(city) : '';

    const filteredVendors = vendors.filter((v) => {
      const vn = normalizeTrForCompare((v as any)?.neighborhood);
      const vd = normalizeTrForCompare((v as any)?.district);
      const vc = normalizeTrForCompare((v as any)?.city);
      if (cityFilter && vc !== cityFilter) return false;
      if (districtFilter && vd !== districtFilter) return false;
      if (neighborhoodFilter && vn !== neighborhoodFilter) return false;
      return true;
    });

    const ratingMap = await computeVendorRatingsFromProductReviews(filteredVendors.map((v) => v.id));
    const campaignMap = await getActiveSellerCampaignMapForSellers(filteredVendors.map((v) => String(v.id)));
    const deliverySettingsMap = await getPlatformNeighborhoodSettingsMap(
      filteredVendors.map((v) => (v as any).neighborhood)
    );
    const campaignOnly = String(req.query?.campaignOnly || '').trim().toLowerCase() === 'true';

    const vendorCards = await Promise.all(
      filteredVendors
        .filter((v) => {
          if (!campaignOnly) return true;
          return campaignMap.has(String(v.id));
        })
        .map(async (v) => {
          const effectiveDelivery = await resolveEffectiveVendorDeliverySettings(v, deliverySettingsMap);
          const displayDeliveryMin =
            effectiveDelivery.deliveryTotalMinutes ?? effectiveDelivery.deliveryMinutes ?? null;
          const displayDeliveryMax = effectiveDelivery.deliveryMaxMinutes ?? null;
          const campaign = campaignMap.get(String(v.id));
          const campaignMinBasketAmount = campaign ? toMoney(campaign.minBasketAmount) : null;
          const campaignDiscountAmount = campaign ? toMoney(campaign.discountAmount) : null;
          const campaignShortLabel =
            campaign && campaignMinBasketAmount != null && campaignDiscountAmount != null
              ? formatCampaignShortLabel(campaignMinBasketAmount, campaignDiscountAmount)
              : null;
          const isOpenNow = computeIsOpenNow(v.openingTime, v.closingTime, (v as any).storeOpenOverride);

          return {
            ...(ratingMap.get(v.id) || { rating: null, rating_count: 0 }),
            _id: v.id,
            store_name: v.shopName || v.businessType || 'İşletme',
            address: v.address || 'Konum bilgisi yok',
            latitude: typeof v.latitude === 'number' ? v.latitude : 0,
            longitude: typeof v.longitude === 'number' ? v.longitude : 0,
            total_orders: 0,
            working_hours: v.openingTime && v.closingTime ? `${v.openingTime}-${v.closingTime}` : '09:00-21:00',
            is_open: isOpenNow,
            open_status: isOpenNow === false ? 'Kapalı' : 'Açık',
            store_image: v.storeLogoImageUrl || v.storeCoverImageUrl || undefined,
            logo_image: v.storeLogoImageUrl || undefined,
            cover_image: v.storeCoverImageUrl || undefined,
            store_about: v.storeAbout || undefined,
            business_type: normalizeBusinessType(v.businessType),
            category: normalizeBusinessType(v.businessType),
            seller_name: (v as any)?.user?.name || v.shopName || normalizeBusinessType(v.businessType),
            preparation_minutes: effectiveDelivery.preparationMinutes,
            pickup_minutes: effectiveDelivery.pickupMinutes,
            delivery_route_minutes: effectiveDelivery.deliveryMinutes,
            delivery_total_minutes: effectiveDelivery.deliveryTotalMinutes,
            delivery_minutes: displayDeliveryMin,
            delivery_max_minutes: displayDeliveryMax,
            delivery_time: formatDeliveryRangeText(
              displayDeliveryMin,
              displayDeliveryMax
            ),
            minimum_order_amount: effectiveDelivery.minimumOrderAmount,
            delivery_fee: effectiveDelivery.flatDeliveryFee,
            free_over_amount: effectiveDelivery.freeOverAmount,
            delivery_mode: String(effectiveDelivery.deliveryMode || 'SELLER').toLowerCase(),
            registered_at: (v as any).createdAt ? new Date((v as any).createdAt).toISOString() : null,
            tags: v.businessType ? [v.businessType] : [],
            neighborhood: (v as any).neighborhood || null,
            district: (v as any).district || null,
            city: (v as any).city || null,
            campaign_id: campaign ? String(campaign.id) : null,
            campaign_min_basket_amount: campaignMinBasketAmount,
            campaign_discount_amount: campaignDiscountAmount,
            campaign_short_label: campaignShortLabel,
            campaign_start_date: campaign?.startDate ? new Date(campaign.startDate).toISOString() : null,
            campaign_end_date: campaign?.endDate ? new Date(campaign.endDate).toISOString() : null,
            campaign_usage_limit: campaign?.usageLimit == null ? null : Number(campaign.usageLimit),
            campaign_usage_count: campaign?.usageCount == null ? null : Number(campaign.usageCount),
          };
        })
    );

    res.status(200).json({
      success: true,
      data: vendorCards,
    });
  } catch (error) {
    next(error);
  }
};

export const getVendorById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const vendor = await prisma.vendorProfile.findFirst({
      where: { id, status: 'APPROVED', user: { isActive: true } },
      include: {
        storeImages: { orderBy: { createdAt: 'desc' } },
        user: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!vendor) {
      res.status(404).json({ success: false, message: 'Vendor not found' });
      return;
    }

    const ratingMap = await computeVendorRatingsFromProductReviews([vendor.id]);
    const ratingInfo = ratingMap.get(vendor.id) || { rating: null, rating_count: 0 };
    const campaign = await getActiveSellerCampaignForSeller(String(vendor.id));
    const deliverySettingsMap = await getPlatformNeighborhoodSettingsMap([(vendor as any).neighborhood]);
    const effectiveDelivery = await resolveEffectiveVendorDeliverySettings(vendor, deliverySettingsMap);
    const displayDeliveryMin =
      effectiveDelivery.deliveryTotalMinutes ?? effectiveDelivery.deliveryMinutes ?? null;
    const displayDeliveryMax = effectiveDelivery.deliveryMaxMinutes ?? null;
    const campaignMinBasketAmount = campaign ? toMoney(campaign.minBasketAmount) : null;
    const campaignDiscountAmount = campaign ? toMoney(campaign.discountAmount) : null;
    const campaignShortLabel =
      campaign && campaignMinBasketAmount != null && campaignDiscountAmount != null
        ? formatCampaignShortLabel(campaignMinBasketAmount, campaignDiscountAmount)
        : null;

    res.status(200).json({
      success: true,
      data: {
        is_open: computeIsOpenNow(vendor.openingTime, vendor.closingTime, (vendor as any).storeOpenOverride),
        _id: vendor.id,
        store_name: vendor.shopName || vendor.businessType || 'İşletme',
        address: vendor.address || 'Konum bilgisi yok',
        latitude: typeof vendor.latitude === 'number' ? vendor.latitude : 0,
        longitude: typeof vendor.longitude === 'number' ? vendor.longitude : 0,
        ...ratingInfo,
        total_orders: 0,
        working_hours:
          vendor.openingTime && vendor.closingTime
            ? `${vendor.openingTime}-${vendor.closingTime}`
            : '09:00-21:00',
        store_image: vendor.storeLogoImageUrl || vendor.storeCoverImageUrl || undefined,
        logo_image: vendor.storeLogoImageUrl || undefined,
        cover_image: vendor.storeCoverImageUrl || undefined,
        store_images: Array.isArray((vendor as any).storeImages)
          ? (vendor as any).storeImages.map((x: any) => x.imageUrl)
          : [],
        store_about: vendor.storeAbout || undefined,
        business_type: normalizeBusinessType(vendor.businessType),
        category: normalizeBusinessType(vendor.businessType),
        seller_name: (vendor as any)?.user?.name || vendor.shopName || normalizeBusinessType(vendor.businessType),
        preparation_minutes: effectiveDelivery.preparationMinutes,
        pickup_minutes: effectiveDelivery.pickupMinutes,
        delivery_route_minutes: effectiveDelivery.deliveryMinutes,
        delivery_total_minutes: effectiveDelivery.deliveryTotalMinutes,
        delivery_minutes: displayDeliveryMin,
        delivery_max_minutes: displayDeliveryMax,
        delivery_time: formatDeliveryRangeText(
          displayDeliveryMin,
          displayDeliveryMax
        ),
        minimum_order_amount: effectiveDelivery.minimumOrderAmount,
        delivery_fee: effectiveDelivery.flatDeliveryFee,
        free_over_amount: effectiveDelivery.freeOverAmount,
        delivery_mode: String(effectiveDelivery.deliveryMode || 'SELLER').toLowerCase(),
        registered_at: vendor.createdAt ? new Date(vendor.createdAt).toISOString() : null,
        tags: vendor.businessType ? [vendor.businessType] : [],
        campaign_id: campaign ? String(campaign.id) : null,
        campaign_min_basket_amount: campaignMinBasketAmount,
        campaign_discount_amount: campaignDiscountAmount,
        campaign_short_label: campaignShortLabel,
        campaign_start_date: campaign?.startDate ? new Date(campaign.startDate).toISOString() : null,
        campaign_end_date: campaign?.endDate ? new Date(campaign.endDate).toISOString() : null,
        campaign_usage_limit:
          campaign?.usageLimit == null ? null : Number(campaign.usageLimit),
        campaign_usage_count:
          campaign?.usageCount == null ? null : Number(campaign.usageCount),
      },
    });
  } catch (error) {
    next(error);
  }
};

const mapCartForCustomerApp = (cart: any) => {
  const items = Array.isArray(cart?.items) ? cart.items : [];

  const mappedItems = items.map((item: any) => {
    const unitPrice =
      typeof item?.unitPrice === 'number'
        ? item.unitPrice
        : typeof item?.product?.price === 'number'
          ? item.product.price
          : 0;

    return {
      product_id: item.productId,
      quantity: Number(item.quantity || 0),
      price: Number(unitPrice || 0),
      vendor_id: String(item?.product?.vendorId || ''),
      vendor_name: String(item?.product?.vendor?.shopName || ''),
      vendor_neighborhood: String(item?.product?.vendor?.neighborhood || ''),
      vendor_district: String(item?.product?.vendor?.district || ''),
      vendor_city: String(item?.product?.vendor?.city || ''),
      product_name: String(item?.product?.name || ''),
      product_image: String(item?.product?.imageUrl || ''),
    };
  });

  const total = mappedItems.reduce(
    (sum: number, it: any) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 0),
    0
  );

  return {
    _id: cart?.id,
    user_id: cart?.userId,
    items: mappedItems,
    total,
  };
};

// Cart endpoints
export const getCart = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const cart = await orderService.getCart(req.user.userId);
    res.status(200).json({ success: true, data: mapCartForCustomerApp(cart) });
  } catch (error) {
    next(error);
  }
};

export const addToCart = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const normalizedBody: any = req.body || {};
    if (normalizedBody.product_id && !normalizedBody.productId) {
      normalizedBody.productId = normalizedBody.product_id;
    }

    const data = AddToCartSchema.parse(normalizedBody);
    await orderService.addToCart(
      req.user.userId,
      data.productId,
      data.quantity
    );

    const cart = await orderService.getCart(req.user.userId);
    res.status(201).json({ success: true, data: mapCartForCustomerApp(cart) });
  } catch (error) {
    next(error);
  }
};

export const updateCartItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const normalizedBody: any = req.body || {};
    if (normalizedBody.product_id && !normalizedBody.productId) {
      normalizedBody.productId = normalizedBody.product_id;
    }

    const data = UpdateCartItemSchema.parse(normalizedBody);
    await orderService.updateCartItem(
      req.user.userId,
      data.productId,
      data.quantity
    );

    const cart = await orderService.getCart(req.user.userId);
    res.status(200).json({ success: true, data: mapCartForCustomerApp(cart) });
  } catch (error) {
    next(error);
  }
};

export const removeFromCart = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const productId = req.body?.productId || req.body?.product_id;
    if (!productId) {
      res.status(400).json({ success: false, message: 'productId is required' });
      return;
    }

    await orderService.removeFromCart(req.user.userId, productId);
    const cart = await orderService.getCart(req.user.userId);
    res.status(200).json({ success: true, data: mapCartForCustomerApp(cart) });
  } catch (error) {
    next(error);
  }
};

export const clearCart = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const vendorId = String(req.body?.vendorId || req.body?.vendor_id || '').trim() || undefined;
    await orderService.clearCart(req.user.userId, vendorId);
    const cart = await orderService.getCart(req.user.userId);
    res.status(200).json({ success: true, data: mapCartForCustomerApp(cart) });
  } catch (error) {
    next(error);
  }
};

export const getCartDeliveryEstimate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const addressId = typeof req.query?.addressId === 'string' ? req.query.addressId.trim() : undefined;
    const vendorId = typeof req.query?.vendorId === 'string' ? req.query.vendorId.trim() : undefined;
    const orderType = typeof req.query?.orderType === 'string' ? req.query.orderType.trim() : undefined;
    const estimate = await orderService.estimateCartDelivery(req.user.userId, addressId, vendorId, orderType);
    res.status(200).json({ success: true, data: estimate });
  } catch (error) {
    next(error);
  }
};

// Order endpoints
export const createOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const rawBody = req.body || {};
    const normalizedBody = {
      ...rawBody,
      ...(rawBody?.vendor_id && !rawBody?.vendorId
        ? { vendorId: String(rawBody.vendor_id) }
        : {}),
    };

    const data = CreateOrderSchema.parse(normalizedBody);

    const order = await orderService.createOrder(req.user.userId, data);

    // Create notifications for involved vendors
    try {
      const uniqueVendorProfileIds: string[] = Array.from(
        new Set(
          order.items
            .map((it: any) => String(it.vendorId || '').trim())
            .filter((id: string) => id.length > 0)
        )
      );

      if (uniqueVendorProfileIds.length > 0) {
        const vendorProfiles = await prisma.vendorProfile.findMany({
          where: { id: { in: uniqueVendorProfileIds } },
          select: { id: true, userId: true, shopName: true },
        });

        const notifications = vendorProfiles
          .map((vp) => ({
            userId: vp.userId,
            title: 'Yeni Sipariş',
            message: `Yeni bir sipariş alındı. Sipariş No: ${order.id}`,
            type: 'SYSTEM_MESSAGE' as const,
          }))
          .filter((n) => Boolean(n.userId));

        if (notifications.length > 0) {
          await prisma.notification.createMany({ data: notifications as any });
        }
      }
    } catch (notifyError) {
      // Do not fail order creation if notifications fail
      console.error('Failed to create vendor notifications:', notifyError);
    }

    res.status(201).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

export const getOrders = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { page, limit } = req.query;

    const orders = await prisma.order.findMany({
      where: { customerId: req.user.userId },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true } },
            vendor: { select: { id: true, shopName: true } },
          },
        },
        shippingAddress: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: page ? (parseInt(page as string) - 1) * (limit ? parseInt(limit as string) : 20) : 0,
      take: limit ? parseInt(limit as string) : 20,
    });

    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    next(error);
  }
};

export const getOrderById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, price: true } },
            vendor: { select: { id: true, shopName: true } },
          },
        },
        shippingAddress: true,
      },
    });

    if (!order || order.customerId !== req.user.userId) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};
