import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import { spawn } from 'child_process';
import * as vendorService from '../services/vendorService';
import prisma from '../config/db';
import { z } from 'zod';
import {
  UpdateVendorProfileSchema,
  UpdateBankAccountSchema,
  CreateProductSchema,
  CreateVendorCategorySchema,
  LookupBarcodeSchema,
  UpdateProductSchema,
  UpdateVendorCategorySchema,
  UpdateOrderStatusSchema,
  CreatePayoutRequestSchema,
  RequestDeliveryCoverageChangeSchema,
  UpdateVendorDeliverySettingsSchema,
} from '../utils/validationSchemas';

const IMAGE_CLEANER_URL = process.env.IMAGE_CLEANER_URL?.trim() || '';
const IMAGE_CLEANER_TIMEOUT_MS = Number(process.env.IMAGE_CLEANER_TIMEOUT_MS || 120000);
const IMAGE_CLEANER_AUTO_ENSURE = String(process.env.IMAGE_CLEANER_AUTO_ENSURE || '0') !== '0';
const IMAGE_CLEANER_STRICT = String(process.env.IMAGE_CLEANER_STRICT || '0') !== '0';
const IMAGE_CLEANER_MAX_RETRIES = Math.max(0, Number(process.env.IMAGE_CLEANER_MAX_RETRIES || 1));
const IMAGE_CLEANER_HEALTH_URL = process.env.IMAGE_CLEANER_HEALTH_URL?.trim() || '';
const IMAGE_CLEANER_HEALTH_CACHE_MS = Number(process.env.IMAGE_CLEANER_HEALTH_CACHE_MS || 20000);
const PRODUCT_IMAGE_MIN_WIDTH = Math.max(1, Number(process.env.PRODUCT_IMAGE_MIN_WIDTH || 700));
const PRODUCT_IMAGE_MIN_HEIGHT = Math.max(1, Number(process.env.PRODUCT_IMAGE_MIN_HEIGHT || 700));
const PRODUCT_IMAGE_QUALITY_GATE_STRICT =
  String(process.env.PRODUCT_IMAGE_QUALITY_GATE_STRICT || '0') === '1';
const PRODUCT_IMAGE_FIDELITY_FIRST =
  String(process.env.PRODUCT_IMAGE_FIDELITY_FIRST || '1') !== '0';
const PRODUCT_IMAGE_AUTO_ENHANCE_LOW_QUALITY =
  !PRODUCT_IMAGE_FIDELITY_FIRST && String(process.env.PRODUCT_IMAGE_AUTO_ENHANCE_LOW_QUALITY || '0') !== '0';
const PRODUCT_IMAGE_SMART_ENHANCE_ENABLED =
  !PRODUCT_IMAGE_FIDELITY_FIRST && String(process.env.PRODUCT_IMAGE_SMART_ENHANCE_ENABLED || '0') !== '0';
const PRODUCT_IMAGE_TARGET_FILL_MIN = Math.min(
  0.95,
  Math.max(0.2, Number(process.env.PRODUCT_IMAGE_TARGET_FILL_MIN || 0.42))
);
const PRODUCT_IMAGE_TARGET_FILL_MAX = Math.min(
  0.98,
  Math.max(PRODUCT_IMAGE_TARGET_FILL_MIN + 0.05, Number(process.env.PRODUCT_IMAGE_TARGET_FILL_MAX || 0.82))
);
const MAX_DOCUMENT_UPLOAD_BYTES = Math.max(
  256 * 1024,
  Number(process.env.MAX_DOCUMENT_UPLOAD_BYTES || 5 * 1024 * 1024)
);
const BACKEND_ROOT = path.resolve(__dirname, '..', '..');
const IMAGE_CLEANER_ENSURE_SCRIPT =
  process.env.IMAGE_CLEANER_ENSURE_SCRIPT?.trim() || path.join(BACKEND_ROOT, 'scripts', 'ensure_image_cleaner.js');

let imageCleanerHealthyUntil = 0;
let imageCleanerEnsureInFlight: Promise<void> | null = null;
let sharpModulePromise: Promise<any | null> | null = null;

const inferMimeTypeFromFilename = (filename: string): string => {
  const ext = path.extname(filename || '').toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.bmp') return 'image/bmp';
  return 'application/octet-stream';
};

const inferMimeTypeFromBuffer = (buffer: Buffer): string | null => {
  if (!buffer || buffer.length < 12) {
    return null;
  }

  // PNG signature
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // JPEG signature
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // WEBP signature: RIFF....WEBP
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  // GIF signature
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return 'image/gif';
  }

  return null;
};

const inferDocumentMimeTypeFromBuffer = (buffer: Buffer): string | null => {
  if (!buffer || buffer.length < 4) {
    return null;
  }

  // PDF signature
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return 'application/pdf';
  }

  return inferMimeTypeFromBuffer(buffer);
};

const parseBase64Content = (contentBase64: string): Buffer => {
  const cleaned = String(contentBase64 || '').trim();
  if (!cleaned) {
    throw new Error('contentBase64 is required');
  }

  const base64 = cleaned.includes('base64,') ? cleaned.split('base64,').pop()! : cleaned;
  const buffer = Buffer.from(base64, 'base64');
  if (!buffer.length) {
    throw new Error('Invalid base64 payload');
  }
  if (buffer.length > MAX_DOCUMENT_UPLOAD_BYTES) {
    throw new Error(`Document too large. Max ${MAX_DOCUMENT_UPLOAD_BYTES} bytes`);
  }

  return buffer;
};

const normalizeImageMimeType = (rawMimeType: string | undefined, filename: string, buffer: Buffer): string => {
  const raw = String(rawMimeType || '').trim().toLowerCase();
  if (raw.startsWith('image/')) {
    return raw;
  }

  const fromName = inferMimeTypeFromFilename(filename);
  if (fromName.startsWith('image/')) {
    return fromName;
  }

  const fromBytes = inferMimeTypeFromBuffer(buffer);
  if (fromBytes) {
    return fromBytes;
  }

  // Avoid cleaner-side 415 for clients that omit/strip MIME metadata.
  return 'image/png';
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isTransientCleanerError = (error: unknown): boolean => {
  const message = String(error instanceof Error ? error.message : error || '').toLowerCase();
  return (
    message.includes('econnrefused') ||
    message.includes('econnreset') ||
    message.includes('timeout') ||
    message.includes('socket hang up') ||
    message.includes('did not become healthy in time')
  );
};

const checkImageCleanerHealth = async (): Promise<boolean> => {
  if (!IMAGE_CLEANER_HEALTH_URL) {
    return false;
  }

  try {
    const target = new URL(IMAGE_CLEANER_HEALTH_URL);
    const requestModule = target.protocol === 'https:' ? https : http;

    return await new Promise<boolean>((resolve) => {
      const req = requestModule.request(
        {
          method: 'GET',
          protocol: target.protocol,
          hostname: target.hostname,
          port: target.port,
          path: `${target.pathname}${target.search}`,
          timeout: 1500,
        },
        (res) => resolve((res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300)
      );

      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
      req.end();
    });
  } catch {
    return false;
  }
};

const runEnsureCleanerScript = async (): Promise<void> => {
  if (!fs.existsSync(IMAGE_CLEANER_ENSURE_SCRIPT)) {
    throw new Error(`ensure script not found: ${IMAGE_CLEANER_ENSURE_SCRIPT}`);
  }

  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [IMAGE_CLEANER_ENSURE_SCRIPT], {
      cwd: BACKEND_ROOT,
      windowsHide: true,
      stdio: 'ignore',
    });

    child.once('error', reject);
    child.once('exit', () => resolve());
  });
};

const ensureImageCleanerReady = async (force: boolean = false): Promise<void> => {
  if (!IMAGE_CLEANER_AUTO_ENSURE) {
    return;
  }

  if (!force && Date.now() < imageCleanerHealthyUntil) {
    return;
  }

  if (await checkImageCleanerHealth()) {
    imageCleanerHealthyUntil = Date.now() + IMAGE_CLEANER_HEALTH_CACHE_MS;
    return;
  }

  if (!imageCleanerEnsureInFlight) {
    imageCleanerEnsureInFlight = (async () => {
      await runEnsureCleanerScript();

      const deadline = Date.now() + 15000;
      while (Date.now() < deadline) {
        if (await checkImageCleanerHealth()) {
          imageCleanerHealthyUntil = Date.now() + IMAGE_CLEANER_HEALTH_CACHE_MS;
          return;
        }
        await wait(400);
      }

      throw new Error('image cleaner did not become healthy in time');
    })().finally(() => {
        imageCleanerEnsureInFlight = null;
      });
  }

  await imageCleanerEnsureInFlight;
};

const cleanProductImageWithWhiteBackground = async (
  inputBuffer: Buffer,
  filename: string,
  mimeType: string
): Promise<Buffer> => {
  if (!IMAGE_CLEANER_URL) {
    throw new Error('IMAGE_CLEANER_URL is not configured');
  }

  const doRequest = async (): Promise<Buffer> => {
    const formData = new FormData();
    const bytes = new Uint8Array(inputBuffer);
    const blob = new Blob([bytes], { type: mimeType || 'application/octet-stream' });
    formData.append('file', blob, filename || 'image.png');

    const response = await fetch(IMAGE_CLEANER_URL, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(IMAGE_CLEANER_TIMEOUT_MS),
    });

    const bodyBuffer = Buffer.from(await response.arrayBuffer());
    if (!response.ok) {
      throw new Error(`Cleaner HTTP ${response.status}: ${bodyBuffer.toString('utf8') || 'unknown error'}`);
    }

    if (!bodyBuffer.length) {
      throw new Error('Cleaner returned an empty file');
    }

    return bodyBuffer;
  };

  for (let attempt = 0; attempt <= IMAGE_CLEANER_MAX_RETRIES; attempt += 1) {
    try {
      await ensureImageCleanerReady(attempt > 0);
      const cleaned = await doRequest();
      imageCleanerHealthyUntil = Date.now() + IMAGE_CLEANER_HEALTH_CACHE_MS;
      return cleaned;
    } catch (error) {
      const isLastAttempt = attempt >= IMAGE_CLEANER_MAX_RETRIES;
      if (isLastAttempt || !isTransientCleanerError(error)) {
        throw error;
      }

      // Brief backoff avoids hammering while uvicorn process is still warming up.
      await wait(300 * (attempt + 1));
    }
  }

  throw new Error('image cleaner request failed after retries');
};

const getSharpModule = async (): Promise<any | null> => {
  if (!sharpModulePromise) {
    sharpModulePromise = import('sharp')
      .then((mod) => mod?.default || mod)
      .catch((error) => {
        console.warn('[image-upload] sharp module unavailable:', String((error as any)?.message || error));
        return null;
      });
  }

  return sharpModulePromise;
};

const enhanceLowQualityProductImage = async (inputBuffer: Buffer): Promise<Buffer> => {
  const sharp = await getSharpModule();
  if (!sharp) {
    throw new Error('sharp module unavailable');
  }

  return sharp(inputBuffer, { failOn: 'none', limitInputPixels: 40_000_000 })
    .resize(PRODUCT_IMAGE_MIN_WIDTH, PRODUCT_IMAGE_MIN_HEIGHT, {
      fit: 'inside',
      withoutEnlargement: false,
      kernel: 'lanczos3',
    })
    .sharpen({ sigma: 1.1, m1: 1, m2: 2, x1: 2, y2: 10, y3: 20 })
    .png({ compressionLevel: 3, adaptiveFiltering: false })
    .toBuffer();
};

const flattenToWhiteWithSharp = async (inputBuffer: Buffer): Promise<Buffer> => {
  const sharp = await getSharpModule();
  if (!sharp) {
    throw new Error('sharp module unavailable');
  }

  return sharp(inputBuffer, { failOn: 'none', limitInputPixels: 40_000_000 })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .png({ compressionLevel: 3, adaptiveFiltering: false })
    .toBuffer();
};

const smartEnhanceProductImage = async (inputBuffer: Buffer): Promise<Buffer> => {
  const sharp = await getSharpModule();
  if (!sharp) {
    return inputBuffer;
  }

  const source = sharp(inputBuffer, { failOn: 'none', limitInputPixels: 40_000_000 });
  const meta = await source.metadata();
  const width = Number(meta?.width || 0);
  const height = Number(meta?.height || 0);
  if (width <= 0 || height <= 0) {
    return inputBuffer;
  }

  // On white-background photos, trim provides a practical subject bbox for fill-ratio estimation.
  const trimMeta = await sharp(inputBuffer, { failOn: 'none', limitInputPixels: 40_000_000 })
    .trim({ background: { r: 255, g: 255, b: 255 }, threshold: 12 })
    .metadata();

  const trimWidth = Number(trimMeta?.width || width);
  const trimHeight = Number(trimMeta?.height || height);
  const fullArea = Math.max(1, width * height);
  const subjectArea = Math.max(1, trimWidth * trimHeight);
  const fillRatio = subjectArea / fullArea;

  let enhanced = sharp(inputBuffer, { failOn: 'none', limitInputPixels: 40_000_000 })
    .normalize()
    .modulate({ brightness: 1.02, saturation: 1.04 })
    .sharpen({ sigma: 1.05, m1: 1, m2: 2, x1: 2, y2: 10, y3: 20 });

  if (fillRatio < PRODUCT_IMAGE_TARGET_FILL_MIN) {
    // Subject appears too small (far shot): zoom in by center-crop window and fit back.
    const zoomFactor = Math.min(2.0, Math.max(1.12, PRODUCT_IMAGE_TARGET_FILL_MIN / Math.max(fillRatio, 0.01)));
    const cropW = Math.max(1, Math.floor(width / zoomFactor));
    const cropH = Math.max(1, Math.floor(height / zoomFactor));
    const left = Math.max(0, Math.floor((width - cropW) / 2));
    const top = Math.max(0, Math.floor((height - cropH) / 2));

    enhanced = enhanced
      .extract({ left, top, width: cropW, height: cropH })
      .resize(Math.max(width, PRODUCT_IMAGE_MIN_WIDTH), Math.max(height, PRODUCT_IMAGE_MIN_HEIGHT), {
        fit: 'cover',
        position: 'centre',
      });
  } else if (fillRatio > PRODUCT_IMAGE_TARGET_FILL_MAX) {
    // Subject appears too large (close shot): zoom out by adding white canvas around image.
    const zoomOutFactor = Math.min(1.8, Math.max(1.08, Math.sqrt(fillRatio / PRODUCT_IMAGE_TARGET_FILL_MAX)));
    const canvasW = Math.max(width, Math.floor(width * zoomOutFactor));
    const canvasH = Math.max(height, Math.floor(height * zoomOutFactor));

    enhanced = enhanced
      .resize(width, height, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
      .extend({
        top: Math.max(0, Math.floor((canvasH - height) / 2)),
        bottom: Math.max(0, Math.ceil((canvasH - height) / 2)),
        left: Math.max(0, Math.floor((canvasW - width) / 2)),
        right: Math.max(0, Math.ceil((canvasW - width) / 2)),
        background: { r: 255, g: 255, b: 255 },
      });
  }

  return enhanced
    .resize(PRODUCT_IMAGE_MIN_WIDTH, PRODUCT_IMAGE_MIN_HEIGHT, {
      fit: 'inside',
      withoutEnlargement: false,
      kernel: 'lanczos3',
    })
    .png({ compressionLevel: 3, adaptiveFiltering: false })
    .toBuffer();
};

const getImageDimensions = async (inputBuffer: Buffer): Promise<{ width: number; height: number } | null> => {
  const sharp = await getSharpModule();
  if (!sharp) {
    return null;
  }

  try {
    const meta = await sharp(inputBuffer, { failOn: 'none' }).metadata();
    const width = Number(meta?.width || 0);
    const height = Number(meta?.height || 0);
    if (width <= 0 || height <= 0) {
      return null;
    }
    return { width, height };
  } catch {
    return null;
  }
};

const forcePngFilename = (name: string): string => {
  const base = String(name || '').trim();
  if (!base) return `image_${Date.now()}.png`;
  if (/\.png$/i.test(base)) return base;
  return base.replace(/\.[a-z0-9]{2,5}$/i, '') + '.png';
};

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

    const profile = await vendorService.getVendorProfile(req.user.userId);
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

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'businessType')) {
      res.status(400).json({ success: false, message: 'Business type cannot be changed after registration' });
      return;
    }

    const data = UpdateVendorProfileSchema.parse(req.body);
    const profile = await vendorService.updateVendorProfile(
      req.user.userId,
      data
    );
    res.status(200).json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
};

export const requestDeliveryCoverageChange = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const data = RequestDeliveryCoverageChangeSchema.parse(req.body);
    const updated = await vendorService.requestDeliveryCoverageChange(
      req.user.userId,
      data.deliveryCoverage
    );

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

export const getDeliverySettings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const data = await vendorService.getVendorDeliverySettings(req.user.userId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const updateDeliverySettings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const payload = UpdateVendorDeliverySettingsSchema.parse(req.body);
    const data = await vendorService.updateVendorDeliverySettings(req.user.userId, payload);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getStorefront = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const profile = await vendorService.getVendorProfile(req.user.userId);
    const deliverySettings = await vendorService.getVendorDeliverySettings(req.user.userId);
    res.status(200).json({
      success: true,
      data: {
        vendorProfileId: profile.id,
        shopName: profile.shopName,
        businessType: (profile as any).businessType ?? null,
        address: (profile as any).address ?? null,
        storeAbout: (profile as any).storeAbout ?? null,
        openingTime: (profile as any).openingTime ?? null,
        closingTime: (profile as any).closingTime ?? null,
        storeOpenOverride: (profile as any).storeOpenOverride ?? null,
        storeCoverImageUrl: (profile as any).storeCoverImageUrl ?? null,
        storeLogoImageUrl: (profile as any).storeLogoImageUrl ?? null,
        preparationMinutes: deliverySettings.preparationMinutes,
        pickupMinutes: deliverySettings.pickupMinutes,
        deliveryTotalMinutes: deliverySettings.deliveryTotalMinutes,
        deliveryMinutes: deliverySettings.deliveryMinutes,
        deliveryMaxMinutes: deliverySettings.deliveryMaxMinutes,
        flatDeliveryFee: deliverySettings.flatDeliveryFee,
        minimumOrderAmount: deliverySettings.minimumOrderAmount,
        freeOverAmount: deliverySettings.freeOverAmount,
        deliveryCoverage: deliverySettings.deliveryCoverage,
        deliveryMode: deliverySettings.deliveryMode,
        canEditDeliveryPricing: deliverySettings.canEditDeliveryPricing,
        deliverySource: deliverySettings.deliverySource,
        pendingDeliveryCoverage: deliverySettings.pendingDeliveryCoverage,
        deliveryCoverageChangeRequestedAt: deliverySettings.deliveryCoverageChangeRequestedAt,
        neighborhood: deliverySettings.neighborhood,
        missingPlatformNeighborhoodSetting: deliverySettings.missingPlatformNeighborhoodSetting,
        platformNeighborhoodSetting: deliverySettings.platformNeighborhoodSetting,
        registeredAt: (profile as any).createdAt ?? null,
        storeImages: (profile as any).storeImages || [],
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateStorefront = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'businessType')) {
      res.status(400).json({ success: false, message: 'Business type cannot be changed after registration' });
      return;
    }

    // Reuse vendor profile schema (contains storefront fields)
    const data = UpdateVendorProfileSchema.parse(req.body);
    const updated = await vendorService.updateVendorProfile(req.user.userId, data);
    const refreshed = await vendorService.getVendorProfile(req.user.userId);
    const deliverySettings = await vendorService.getVendorDeliverySettings(req.user.userId);

    res.status(200).json({
      success: true,
      data: {
        vendorProfileId: refreshed.id,
        shopName: refreshed.shopName,
        businessType: (refreshed as any).businessType ?? null,
        address: (refreshed as any).address ?? null,
        storeAbout: (refreshed as any).storeAbout ?? null,
        openingTime: (refreshed as any).openingTime ?? null,
        closingTime: (refreshed as any).closingTime ?? null,
        storeOpenOverride: (refreshed as any).storeOpenOverride ?? null,
        storeCoverImageUrl: (refreshed as any).storeCoverImageUrl ?? null,
        storeLogoImageUrl: (refreshed as any).storeLogoImageUrl ?? null,
        preparationMinutes: deliverySettings.preparationMinutes,
        pickupMinutes: deliverySettings.pickupMinutes,
        deliveryTotalMinutes: deliverySettings.deliveryTotalMinutes,
        deliveryMinutes: deliverySettings.deliveryMinutes,
        deliveryMaxMinutes: deliverySettings.deliveryMaxMinutes,
        flatDeliveryFee: deliverySettings.flatDeliveryFee,
        minimumOrderAmount: deliverySettings.minimumOrderAmount,
        freeOverAmount: deliverySettings.freeOverAmount,
        deliveryCoverage: deliverySettings.deliveryCoverage,
        deliveryMode: deliverySettings.deliveryMode,
        canEditDeliveryPricing: deliverySettings.canEditDeliveryPricing,
        deliverySource: deliverySettings.deliverySource,
        pendingDeliveryCoverage: deliverySettings.pendingDeliveryCoverage,
        deliveryCoverageChangeRequestedAt: deliverySettings.deliveryCoverageChangeRequestedAt,
        neighborhood: deliverySettings.neighborhood,
        missingPlatformNeighborhoodSetting: deliverySettings.missingPlatformNeighborhoodSetting,
        platformNeighborhoodSetting: deliverySettings.platformNeighborhoodSetting,
        registeredAt: (refreshed as any).createdAt ?? null,
        storeImages: (refreshed as any).storeImages || [],
      },
      _debug: { updatedId: (updated as any)?.id },
    });
  } catch (error) {
    next(error);
  }
};

export const uploadStoreImage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const profile = await prisma.vendorProfile.findUnique({ where: { userId: req.user.userId } });
    if (!profile) {
      res.status(404).json({ success: false, message: 'Vendor profile not found' });
      return;
    }

    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) {
      res.status(400).json({ success: false, message: 'file is required' });
      return;
    }

    const ext = (() => {
      const mime = String(file.mimetype || '').toLowerCase();
      if (mime.includes('png')) return 'png';
      if (mime.includes('webp')) return 'webp';
      if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
      return 'jpg';
    })();

    const uploadsDir = path.join(process.cwd(), 'uploads', 'vendor-store');
    fs.mkdirSync(uploadsDir, { recursive: true });
    const filename = `vendor_${profile.id}_${Date.now()}.${ext}`;
    const fullPath = path.join(uploadsDir, filename);
    fs.writeFileSync(fullPath, file.buffer);

    const imageUrl = `/uploads/vendor-store/${filename}`;
    const created = await prisma.vendorStoreImage.create({
      data: {
        vendorProfileId: profile.id,
        imageUrl,
      },
    });

    // Auto-set cover if empty
    if (!(profile as any).storeCoverImageUrl) {
      await prisma.vendorProfile.update({
        where: { id: profile.id },
        data: { storeCoverImageUrl: imageUrl },
      });
    }

    res.status(201).json({ success: true, data: created });
  } catch (error) {
    next(error);
  }
};

export const deleteStoreImage = async (
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
    const profile = await prisma.vendorProfile.findUnique({ where: { userId: req.user.userId } });
    if (!profile) {
      res.status(404).json({ success: false, message: 'Vendor profile not found' });
      return;
    }

    const img = await prisma.vendorStoreImage.findFirst({ where: { id, vendorProfileId: profile.id } });
    if (!img) {
      res.status(404).json({ success: false, message: 'Image not found' });
      return;
    }

    await prisma.vendorStoreImage.delete({ where: { id: img.id } });

    // If it was cover, clear cover
    if ((profile as any).storeCoverImageUrl && (profile as any).storeCoverImageUrl === img.imageUrl) {
      await prisma.vendorProfile.update({
        where: { id: profile.id },
        data: { storeCoverImageUrl: null },
      });
    }

    res.status(200).json({ success: true, data: { id: img.id } });
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
    const limit = limitRaw ? parseInt(limitRaw as string) : 20;

    const notifications = await vendorService.listNotifications(req.user.userId, limit);
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
    const updated = await vendorService.markNotificationAsRead(req.user.userId, id);
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

export const uploadTaxSheet = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { filename: originalFilename, contentBase64 } = req.body || {};
    
    console.log('📥 Tax sheet upload request:', {
      userId: req.user.userId,
      hasContent: !!contentBase64,
      contentLength: contentBase64?.length,
      filename: originalFilename,
    });

    if (!contentBase64 || typeof contentBase64 !== 'string') {
      res.status(400).json({ success: false, message: 'contentBase64 is required' });
      return;
    }

    const safeOriginal = String(originalFilename || 'tax_sheet.pdf').replace(
      /[^a-zA-Z0-9._-]+/g,
      '_'
    );
    const filename = `${req.user.userId}_${Date.now()}_${safeOriginal}`;

    const uploadsDir = path.join(process.cwd(), 'uploads', 'tax-sheets');
    
    console.log('📁 Creating directory:', uploadsDir);
    fs.mkdirSync(uploadsDir, { recursive: true });

    const fullPath = path.join(uploadsDir, filename);
    
    try {
      console.log('🔄 Converting base64 to buffer...');
      const buffer = parseBase64Content(contentBase64);
      const mimeType = inferDocumentMimeTypeFromBuffer(buffer);
      if (mimeType !== 'application/pdf') {
        res.status(415).json({
          success: false,
          message: 'Vergi levhasi yalnizca PDF olabilir.',
        });
        return;
      }
      
      console.log('💾 Writing file:', fullPath, `(${buffer.length} bytes)`);
      fs.writeFileSync(fullPath, buffer);
      
      const url = `/uploads/tax-sheets/${filename}`;
      console.log('✅ File written successfully:', url);
      
      res.status(200).json({ success: true, data: { url } });
    } catch (fileErr: any) {
      console.error('❌ File operation failed:', fileErr.message);
      throw new Error(`File operation failed: ${fileErr.message}`);
    }
  } catch (error) {
    console.error('❌ Upload tax sheet error:', error);
    next(error);
  }
};

export const uploadDocument = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { filename: originalFilename, contentBase64, type } = req.body || {};
    
    console.log('📥 Document upload request:', {
      userId: req.user.userId,
      type,
      hasContent: !!contentBase64,
      contentLength: contentBase64?.length,
      filename: originalFilename,
    });

    if (!contentBase64 || typeof contentBase64 !== 'string') {
      res.status(400).json({ success: false, message: 'contentBase64 is required' });
      return;
    }

    // Belge tipi belirleme
    const docType = String(type || 'document').toLowerCase();
    let folderName = 'documents';
    if (docType === 'residence') folderName = 'residence-docs';
    else if (docType === 'id_front') folderName = 'id-photos';
    else if (docType === 'id_back') folderName = 'id-photos';

    const safeOriginal = String(originalFilename || `${docType}.pdf`).replace(
      /[^a-zA-Z0-9._-]+/g,
      '_'
    );
    const filename = `${req.user.userId}_${Date.now()}_${docType}_${safeOriginal}`;

    const uploadsDir = path.join(process.cwd(), 'uploads', folderName);
    
    console.log('📁 Creating directory:', uploadsDir);
    fs.mkdirSync(uploadsDir, { recursive: true });

    const fullPath = path.join(uploadsDir, filename);
    
    try {
      console.log('🔄 Converting base64 to buffer...');
      const buffer = parseBase64Content(contentBase64);
      const mimeType = inferDocumentMimeTypeFromBuffer(buffer);
      const allowedMimeTypes = new Set([
        'application/pdf',
        'image/png',
        'image/jpeg',
        'image/webp',
      ]);

      if (!mimeType || !allowedMimeTypes.has(mimeType)) {
        res.status(415).json({
          success: false,
          message: 'Desteklenmeyen belge tipi. Yalnizca PDF/JPG/PNG/WEBP yuklenebilir.',
        });
        return;
      }
      
      console.log('💾 Writing file:', fullPath, `(${buffer.length} bytes)`);
      fs.writeFileSync(fullPath, buffer);
      
      const url = `/uploads/${folderName}/${filename}`;
      console.log('✅ File written successfully:', url);
      
      res.status(200).json({ success: true, data: { url } });
    } catch (fileErr: any) {
      console.error('❌ File operation failed:', fileErr.message);
      throw new Error(`File operation failed: ${fileErr.message}`);
    }
  } catch (error) {
    console.error('❌ Upload document error:', error);
    next(error);
  }
};

export const uploadImage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    console.log('📥 Image upload request:', {
      userId: req.user.userId,
      hasFile: !!req.file,
      hasBody: !!req.body,
      contentLength: req.file?.size || req.body?.contentBase64?.length,
      filename: req.file?.originalname || req.body?.filename,
    });

    let buffer: Buffer;
    let filename: string;
    let mimeType: string;

    // Handle multipart form-data (from multer)
    if (req.file) {
      buffer = req.file.buffer;
      const safeOriginal = req.file.originalname.replace(/[^a-zA-Z0-9._-]+/g, '_');
      filename = `${req.user.userId}_${Date.now()}_${safeOriginal}`;
      mimeType = normalizeImageMimeType(req.file.mimetype, filename, buffer);
      console.log('✓ Processing multipart file:', filename);
    }
    // Handle JSON with base64
    else if (req.body?.contentBase64) {
      const { filename: originalFilename, contentBase64 } = req.body;
      
      if (!contentBase64 || typeof contentBase64 !== 'string') {
        res.status(400).json({ success: false, message: 'contentBase64 is required' });
        return;
      }

      const safeOriginal = String(originalFilename || 'product_image.jpg').replace(
        /[^a-zA-Z0-9._-]+/g,
        '_'
      );
      filename = `${req.user.userId}_${Date.now()}_${safeOriginal}`;

      const base64 = contentBase64.includes('base64,')
        ? contentBase64.split('base64,').pop()!
        : contentBase64;

      console.log('🔄 Converting base64 to buffer...');
      buffer = Buffer.from(base64, 'base64');
      mimeType = normalizeImageMimeType(req.body?.mimeType, filename, buffer);
      console.log('✓ Base64 converted, buffer size:', buffer.length);
    } else {
      res.status(400).json({ success: false, message: 'File or contentBase64 is required' });
      return;
    }

    const dimensions = await getImageDimensions(buffer);
    if (dimensions) {
      if (dimensions.width < PRODUCT_IMAGE_MIN_WIDTH || dimensions.height < PRODUCT_IMAGE_MIN_HEIGHT) {
        if (PRODUCT_IMAGE_AUTO_ENHANCE_LOW_QUALITY) {
          try {
            buffer = await enhanceLowQualityProductImage(buffer);
            mimeType = 'image/png';
            filename = forcePngFilename(filename);

            const enhanced = await getImageDimensions(buffer);
            console.log('⚙️ Low-quality image auto-enhanced:', {
              filename,
              beforeWidth: dimensions.width,
              beforeHeight: dimensions.height,
              afterWidth: enhanced?.width ?? null,
              afterHeight: enhanced?.height ?? null,
            });
          } catch (enhanceErr: any) {
            console.warn('⚠️ Low-quality image enhancement failed, continuing with original image:', String(enhanceErr?.message || enhanceErr));
          }
        } else if (PRODUCT_IMAGE_QUALITY_GATE_STRICT) {
          res.status(422).json({
            success: false,
            message: `Gorsel kalitesi dusuk. En az ${PRODUCT_IMAGE_MIN_WIDTH}x${PRODUCT_IMAGE_MIN_HEIGHT} piksel yukleyin.`,
            details: {
              width: dimensions.width,
              height: dimensions.height,
              minWidth: PRODUCT_IMAGE_MIN_WIDTH,
              minHeight: PRODUCT_IMAGE_MIN_HEIGHT,
            },
          });
          return;
        } else {
          console.warn('⚠️ Low-quality image accepted (strict gate disabled):', {
            filename,
            width: dimensions.width,
            height: dimensions.height,
            minWidth: PRODUCT_IMAGE_MIN_WIDTH,
            minHeight: PRODUCT_IMAGE_MIN_HEIGHT,
          });
        }
      }
    }

    let cleanerApplied = false;
    let cleanerErrorMessage = '';

    try {
      buffer = await cleanProductImageWithWhiteBackground(buffer, filename, mimeType);
      cleanerApplied = true;
      console.log('✅ Image cleaner applied white background:', { filename, bytes: buffer.length });
    } catch (cleanErr: any) {
      cleanerErrorMessage = String(cleanErr?.message || cleanErr || 'unknown error');
      console.error('❌ Image cleaner failed:', cleanerErrorMessage);
    }

    if (!cleanerApplied) {
      try {
        // Final forced retry path so uploads never bypass white-background cleaning.
        await ensureImageCleanerReady(true);
        buffer = await cleanProductImageWithWhiteBackground(buffer, filename, mimeType);
        cleanerApplied = true;
        console.log('✅ Image cleaner applied white background after forced retry:', { filename, bytes: buffer.length });
      } catch (forcedRetryErr: any) {
        cleanerErrorMessage = [cleanerErrorMessage, String(forcedRetryErr?.message || forcedRetryErr || '')]
          .filter(Boolean)
          .join(' | ');
      }
    }

    if (!cleanerApplied) {
      try {
        if (!IMAGE_CLEANER_STRICT) {
          buffer = await flattenToWhiteWithSharp(buffer);
          cleanerApplied = true;
          mimeType = 'image/png';
          filename = forcePngFilename(filename);
          console.warn('⚠️ Image cleaner unavailable, used local sharp white-background fallback:', { filename, bytes: buffer.length });
        }
      } catch (fallbackErr: any) {
        cleanerErrorMessage = [cleanerErrorMessage, String(fallbackErr?.message || fallbackErr || '')]
          .filter(Boolean)
          .join(' | ');
      }
    }

    if (!cleanerApplied && !IMAGE_CLEANER_STRICT) {
      console.warn('⚠️ Image cleaner and sharp fallback unavailable, continuing with original image buffer:', {
        filename,
        details: cleanerErrorMessage,
      });
    }

    if (!cleanerApplied && IMAGE_CLEANER_STRICT) {
      res.status(503).json({
        success: false,
        message:
          'Gorsel beyaz arka plan isleme servisine ulasilamadi. Lutfen kisa sure sonra tekrar deneyin.',
        details: cleanerErrorMessage,
      });
      return;
    }

    // Cleaner already returns final PNG; avoid a second re-encode that can soften detail.
    if (cleanerApplied) {
      mimeType = 'image/png';
      filename = forcePngFilename(filename);
    }

    if (PRODUCT_IMAGE_SMART_ENHANCE_ENABLED) {
      try {
        const before = await getImageDimensions(buffer);
        buffer = await smartEnhanceProductImage(buffer);
        const after = await getImageDimensions(buffer);
        mimeType = 'image/png';
        filename = forcePngFilename(filename);
        console.log('✨ Smart image enhance applied:', {
          filename,
          beforeWidth: before?.width ?? null,
          beforeHeight: before?.height ?? null,
          afterWidth: after?.width ?? null,
          afterHeight: after?.height ?? null,
        });
      } catch (enhanceErr: any) {
        console.warn('⚠️ Smart image enhance failed, continuing with processed image:', String(enhanceErr?.message || enhanceErr));
      }
    }

    const uploadsDir = path.join(process.cwd(), 'uploads', 'product-images');
    
    console.log('📁 Creating directory:', uploadsDir);
    fs.mkdirSync(uploadsDir, { recursive: true });

    const fullPath = path.join(uploadsDir, filename);
    
    try {
      console.log('💾 Writing file:', fullPath, `(${buffer.length} bytes)`);
      fs.writeFileSync(fullPath, buffer);
      
      const url = `/uploads/product-images/${filename}`;
      console.log('✅ Image uploaded successfully:', url);
      
      res.status(200).json({ success: true, data: { url, imageUrl: url } });
    } catch (fileErr: any) {
      console.error('❌ File operation failed:', fileErr.message);
      throw new Error(`File operation failed: ${fileErr.message}`);
    }
  } catch (error) {
    console.error('❌ Upload image error:', error);
    next(error);
  }
};

export const getBankAccount = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const account = await vendorService.getBankAccount(req.user.userId);
    res.status(200).json({ success: true, data: account });
  } catch (error) {
    next(error);
  }
};

export const updateBankAccount = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const data = UpdateBankAccountSchema.parse(req.body);
    const account = await vendorService.updateBankAccount(
      req.user.userId,
      data
    );
    res.status(200).json({ success: true, data: account });
  } catch (error) {
    next(error);
  }
};

export const requestIbanChange = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const result = await vendorService.requestIbanChange(req.user.userId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

// Payouts (Vendor)
export const getPayouts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { status, page, limit } = req.query;
    const result = await vendorService.getPayouts(
      req.user.userId,
      status as string | undefined,
      page ? parseInt(page as string) : 1,
      limit ? parseInt(limit as string) : 20
    );

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getPayoutById = async (
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
    const payout = await vendorService.getPayoutById(req.user.userId, id);
    res.status(200).json({ success: true, data: payout });
  } catch (error) {
    next(error);
  }
};

export const createPayoutRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const payload = CreatePayoutRequestSchema.parse(req.body);
    const payout = await vendorService.createPayoutRequest(req.user.userId, payload.amount);
    res.status(201).json({ success: true, data: payout });
  } catch (error) {
    next(error);
  }
};

// Products
export const getProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    let page = 1;
    let limit = 20;

    // Safely parse page and limit
    if (req.query.page) {
      const parsedPage = parseInt(req.query.page as string);
      if (!isNaN(parsedPage) && parsedPage > 0) {
        page = parsedPage;
      }
    }

    if (req.query.limit) {
      const parsedLimit = parseInt(req.query.limit as string);
      if (!isNaN(parsedLimit) && parsedLimit > 0) {
        limit = Math.min(parsedLimit, 100); // Cap at 100
      }
    }

    const result = await vendorService.getVendorProducts(
      req.user.userId,
      page,
      limit
    );
    res.status(200).json({ success: true, data: result });
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
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const product = await vendorService.getVendorProductById(id, req.user.userId);
    res.status(200).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

export const createProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const data = CreateProductSchema.parse(req.body);
    const product = await vendorService.createProduct(req.user.userId, data);
    res.status(201).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

export const lookupProductByBarcode = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const payload = LookupBarcodeSchema.parse(req.body);
    console.log('BARCODE_REQUEST', {
      vendorUserId: req.user.userId,
      barcode: String(payload.barcode || '').trim(),
    });

    const result = await vendorService.lookupProductByBarcode(req.user.userId, payload.barcode);

    if (result.found) {
      console.log('BARCODE_RESULT', {
        barcode: String(payload.barcode || '').trim(),
        source: result.source,
        name: String(result.product?.name || ''),
      });
    } else {
      console.log('BARCODE_NOT_FOUND', {
        barcode: String(payload.barcode || '').trim(),
        source: result.source,
      });
    }

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getCategories = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const data = await (await import('../services/categoryService')).listCategoriesForVendor(req.user.userId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const data = CreateVendorCategorySchema.parse(req.body);
    const category = await (await import('../services/categoryService')).createVendorCategory(req.user.userId, data);
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const data = UpdateVendorCategorySchema.parse(req.body);
    const category = await (await import('../services/categoryService')).updateVendorCategory(req.params.id, req.user.userId, data);
    res.status(200).json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
};

export const deleteCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const result = await (await import('../services/categoryService')).deleteVendorCategory(req.params.id, req.user.userId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const updateProduct = async (
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
    const data = UpdateProductSchema.parse(req.body);
    const product = await vendorService.updateProduct(id, req.user.userId, data);
    res.status(200).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

export const deleteProduct = async (
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
    const result = await vendorService.deleteProduct(id, req.user.userId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

// Product Reviews (Vendor)
export const getProductReviews = async (
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
    const reviews = await vendorService.getProductReviews(id, req.user.userId);
    res.status(200).json({ success: true, data: reviews });
  } catch (error) {
    next(error);
  }
};

export const replyToProductReview = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { id, reviewId } = req.params;
    const schema = z.object({ reply: z.string().trim().min(1).max(1000) });
    const { reply } = schema.parse(req.body);

    const updated = await vendorService.replyToProductReview(
      id,
      reviewId,
      req.user.userId,
      reply
    );
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

// Orders
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

    const { status, page, limit } = req.query;
    const result = await vendorService.getVendorOrders(
      req.user.userId,
      status as string | undefined,
      page ? parseInt(page as string) : 1,
      limit ? parseInt(limit as string) : 20
    );
    res.status(200).json({ success: true, data: result });
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
    const order = await vendorService.getVendorOrderById(id, req.user.userId);
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

export const updateOrderStatus = async (
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
    const data = UpdateOrderStatusSchema.parse(req.body);
    const updated = await vendorService.updateVendorOrderStatus(
      id,
      req.user.userId,
      data.status,
      data.note,
      data.reasonTitle
    );
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

// Dashboard
export const getDashboard = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const dashboard = await vendorService.getVendorDashboard(req.user.userId);
    res.status(200).json({ success: true, data: dashboard });
  } catch (error) {
    next(error);
  }
};
// Campaigns
export const createCampaign = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { scope, discountType, discountAmount, startDate, endDate, selectedProducts } = req.body;

    // Validation
    if (!scope || !discountType || discountAmount === undefined || !startDate || !endDate) {
      res.status(400).json({ success: false, message: 'Missing required fields' });
      return;
    }

    if (discountAmount <= 0) {
      res.status(400).json({ success: false, message: 'Discount amount must be positive' });
      return;
    }

    if (scope === 'selected' && (!selectedProducts || selectedProducts.length === 0)) {
      res.status(400).json({ success: false, message: 'Please select at least one product' });
      return;
    }

    const campaign = await vendorService.createCampaign(req.user.userId, {
      scope,
      discountType,
      discountAmount,
      startDate,
      endDate,
      selectedProducts,
    });

    res.status(201).json({ success: true, message: 'Campaign created successfully', data: campaign });
  } catch (error) {
    next(error);
  }
};

export const getCampaigns = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const campaigns = await vendorService.getCampaigns(req.user.userId);
    res.status(200).json({ success: true, data: campaigns });
  } catch (error) {
    next(error);
  }
};

export const updateCampaign = async (
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
    const { scope, discountType, discountAmount, startDate, endDate, selectedProducts } = req.body;

    const campaign = await vendorService.updateCampaign(req.user.userId, id, {
      scope,
      discountType,
      discountAmount,
      startDate,
      endDate,
      selectedProducts,
    });

    res.status(200).json({ success: true, message: 'Campaign updated successfully', data: campaign });
  } catch (error) {
    next(error);
  }
};

export const deleteCampaign = async (
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
    await vendorService.deleteCampaign(req.user.userId, id);

    res.status(200).json({ success: true, message: 'Campaign deleted successfully' });
  } catch (error) {
    next(error);
  }
};