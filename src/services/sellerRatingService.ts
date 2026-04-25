import prisma from '../config/db';
import { AppError } from '../middleware/errorHandler';

const db = prisma as any;

const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

const toOneDecimal = (value: number): number => Math.round(value * 10) / 10;

const normalizeComment = (value?: string): string | null => {
  const trimmed = String(value || '').trim();
  return trimmed.length > 0 ? trimmed : null;
};

const resolveOrderVendorId = (order: { items: Array<{ vendorId: string }> }, requestedVendorId?: string): string => {
  const vendorIds = Array.from(
    new Set(order.items.map((x) => String(x.vendorId || '').trim()).filter(Boolean))
  );

  if (vendorIds.length === 0) {
    throw new AppError(400, 'Order has no vendor item to rate');
  }

  const selected = String(requestedVendorId || '').trim();
  if (selected) {
    if (!vendorIds.includes(selected)) {
      throw new AppError(403, 'Vendor is not part of this order');
    }
    return selected;
  }

  if (vendorIds.length > 1) {
    throw new AppError(400, 'vendorId is required for multi-vendor orders');
  }

  return vendorIds[0];
};

const resolveEligibleAt = (orderUpdatedAt: Date) => {
  return new Date(orderUpdatedAt);
};

const getOwnedDeliveredOrder = async (orderId: string, customerId: string) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      customerId: true,
      status: true,
      updatedAt: true,
      items: {
        select: {
          vendorId: true,
        },
      },
    },
  });

  if (!order || order.customerId !== customerId) {
    throw new AppError(404, 'Order not found');
  }

  if (order.status !== 'DELIVERED') {
    throw new AppError(400, 'Only delivered orders can be rated');
  }

  return order;
};

const mapRating = (rating: any, canEdit: boolean) => {
  if (!rating) return null;
  const editableUntil = new Date(new Date(rating.createdAt).getTime() + EDIT_WINDOW_MS);

  return {
    id: rating.id,
    order_id: rating.orderId,
    user_id: rating.customerId,
    seller_id: rating.vendorId,
    rating: rating.rating,
    comment: rating.comment ?? null,
    created_at: rating.createdAt,
    updated_at: rating.updatedAt,
    can_edit: canEdit,
    editable_until: editableUntil,
    user: rating.customer
      ? {
          id: rating.customer.id,
          name: rating.customer.name,
        }
      : null,
  };
};

export const createSellerRating = async (params: {
  orderId: string;
  customerId: string;
  vendorId?: string;
  rating: number;
  comment?: string;
}) => {
  const order = await getOwnedDeliveredOrder(params.orderId, params.customerId);
  const vendorId = resolveOrderVendorId(order, params.vendorId);
  const eligibleAt = resolveEligibleAt(order.updatedAt);

  const existing = await db.sellerRating.findUnique({
    where: {
      orderId_vendorId: {
        orderId: params.orderId,
        vendorId,
      },
    },
  });

  if (existing) {
    throw new AppError(409, 'Rating already exists for this order and seller');
  }

  const created = await db.sellerRating.create({
    data: {
      orderId: params.orderId,
      customerId: params.customerId,
      vendorId,
      rating: params.rating,
      comment: normalizeComment(params.comment),
    },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return {
    rating: mapRating(created, true),
    eligible_at: eligibleAt,
  };
};

export const updateSellerRating = async (params: {
  orderId: string;
  customerId: string;
  vendorId?: string;
  rating: number;
  comment?: string;
}) => {
  const order = await getOwnedDeliveredOrder(params.orderId, params.customerId);
  const vendorId = resolveOrderVendorId(order, params.vendorId);

  const existing = await db.sellerRating.findUnique({
    where: {
      orderId_vendorId: {
        orderId: params.orderId,
        vendorId,
      },
    },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!existing || existing.customerId !== params.customerId) {
    throw new AppError(404, 'Rating not found');
  }

  const editableUntil = new Date(new Date(existing.createdAt).getTime() + EDIT_WINDOW_MS);
  if (Date.now() > editableUntil.getTime()) {
    throw new AppError(400, 'Rating edit window has expired');
  }

  const updated = await db.sellerRating.update({
    where: { id: existing.id },
    data: {
      rating: params.rating,
      comment: normalizeComment(params.comment),
    },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return {
    rating: mapRating(updated, true),
    editable_until: editableUntil,
  };
};

export const getOrderSellerRating = async (params: {
  orderId: string;
  customerId: string;
  vendorId?: string;
}) => {
  const order = await getOwnedDeliveredOrder(params.orderId, params.customerId);
  const vendorId = resolveOrderVendorId(order, params.vendorId);
  const eligibleAt = resolveEligibleAt(order.updatedAt);

  const rating = await db.sellerRating.findUnique({
    where: {
      orderId_vendorId: {
        orderId: params.orderId,
        vendorId,
      },
    },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  const canRate = !rating && Date.now() >= eligibleAt.getTime();
  const canEdit =
    rating != null &&
    rating.customerId === params.customerId &&
    Date.now() <= new Date(rating.createdAt).getTime() + EDIT_WINDOW_MS;

  return {
    rating: mapRating(rating, canEdit),
    can_rate: canRate,
    eligible_at: eligibleAt,
    can_edit: canEdit,
  };
};

export const getSellerRatingSummary = async (vendorId: string) => {
  const agg = await db.sellerRating.aggregate({
    where: { vendorId },
    _avg: { rating: true },
    _count: { _all: true },
  });

  const rawAvg = Number(agg._avg.rating || 0);
  const count = Number(agg._count._all || 0);

  return {
    seller_id: vendorId,
    rating: count > 0 ? toOneDecimal(rawAvg) : 0,
    rating_count: count,
  };
};

export const getSellerRatings = async (params: {
  vendorId: string;
  page: number;
  limit: number;
}) => {
  const skip = (params.page - 1) * params.limit;

  const [rows, total] = await Promise.all([
    db.sellerRating.findMany({
      where: { vendorId: params.vendorId },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: params.limit,
    }),
    db.sellerRating.count({ where: { vendorId: params.vendorId } }),
  ]);

  const summary = await getSellerRatingSummary(params.vendorId);

  return {
    summary,
    comments: rows.map((row: any) => mapRating(row, false)),
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      has_more: skip + rows.length < total,
    },
  };
};
