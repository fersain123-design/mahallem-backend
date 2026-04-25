import prisma from '../config/db';
import { AppError } from '../middleware/errorHandler';

export type DeliveryFeeBand = {
  minKm: number;
  maxKm: number;
  fee: number;
};

const MIN_DELIVERY_FEE = 18;

const DEFAULT_BANDS: DeliveryFeeBand[] = [
  { minKm: 0, maxKm: 1, fee: MIN_DELIVERY_FEE },
  { minKm: 1, maxKm: 3, fee: MIN_DELIVERY_FEE },
  { minKm: 3, maxKm: 5, fee: MIN_DELIVERY_FEE },
];

const normalize = (bands: DeliveryFeeBand[]) => {
  const sorted = [...bands].sort((a, b) => a.minKm - b.minKm || a.maxKm - b.maxKm);
  return sorted.map((b) => ({
    minKm: Number(b.minKm),
    maxKm: Number(b.maxKm),
    fee: Number(b.fee),
  }));
};

export const validateBands = (bands: DeliveryFeeBand[]) => {
  if (!Array.isArray(bands) || bands.length === 0) {
    throw new AppError(400, 'Delivery fee bands are required');
  }

  const normalized = normalize(bands);

  for (const b of normalized) {
    if (!Number.isFinite(b.minKm) || !Number.isFinite(b.maxKm) || !Number.isFinite(b.fee)) {
      throw new AppError(400, 'Invalid delivery fee band values');
    }
    if (b.minKm < 0 || b.maxKm <= 0) throw new AppError(400, 'Km values must be > 0');
    if (b.maxKm <= b.minKm) throw new AppError(400, 'maxKm must be greater than minKm');
    if (b.fee < MIN_DELIVERY_FEE) {
      throw new AppError(400, `Fee must be >= ${MIN_DELIVERY_FEE}`);
    }
  }

  // Prevent overlaps
  for (let i = 1; i < normalized.length; i++) {
    const prev = normalized[i - 1];
    const cur = normalized[i];
    if (cur.minKm < prev.maxKm) {
      throw new AppError(400, 'Delivery fee bands must not overlap');
    }
  }

  return normalized;
};

export const getDeliveryFeeBands = async (): Promise<DeliveryFeeBand[]> => {
  const settings = await prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });

  try {
    const parsed = JSON.parse(String((settings as any).deliveryFeeBands ?? '[]'));
    const bands = validateBands(parsed);
    return bands;
  } catch (_e) {
    // Self-heal to defaults if corrupted
    const bands = DEFAULT_BANDS;
    await prisma.settings.update({
      where: { id: 1 },
      data: { deliveryFeeBands: JSON.stringify(bands) } as any,
    });
    return bands;
  }
};

export const updateDeliveryFeeBands = async (bands: DeliveryFeeBand[]) => {
  const validated = validateBands(bands);
  const updated = await prisma.settings.update({
    where: { id: 1 },
    data: { deliveryFeeBands: JSON.stringify(validated) } as any,
  });
  return updated;
};

export const calculateDeliveryFee = async (distanceKm: number): Promise<number> => {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) {
    throw new AppError(400, 'distanceKm must be >= 0');
  }

  const bands = await getDeliveryFeeBands();
  const match = bands.find((b) => distanceKm >= b.minKm && distanceKm <= b.maxKm);
  if (!match) return 0;
  return Math.max(MIN_DELIVERY_FEE, match.fee);
};

export const calculateDeliveryFeeOrThrow = async (distanceKm: number): Promise<number> => {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) {
    throw new AppError(400, 'distanceKm must be >= 0');
  }

  const bands = await getDeliveryFeeBands();
  const match = bands.find((b) => distanceKm >= b.minKm && distanceKm <= b.maxKm);
  if (!match) {
    const maxKm = bands.reduce((m, b) => (b.maxKm > m ? b.maxKm : m), 0);
    throw new AppError(400, `Delivery is not available for this distance (max ${maxKm} km)`);
  }
  return Math.max(MIN_DELIVERY_FEE, match.fee);
};
