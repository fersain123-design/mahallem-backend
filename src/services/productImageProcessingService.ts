import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import { spawn } from 'child_process';

export type QueuedProductImageInput =
  | {
      kind: 'url';
      url: string;
    }
  | {
      kind: 'file';
      filename: string;
      mimeType?: string;
      contentBase64: string;
    };

const IMAGE_CLEANER_URL = process.env.IMAGE_CLEANER_URL?.trim() || '';
const IMAGE_CLEANER_TIMEOUT_MS = Number(process.env.IMAGE_CLEANER_TIMEOUT_MS || 120000);
const IMAGE_CLEANER_AUTO_ENSURE = String(process.env.IMAGE_CLEANER_AUTO_ENSURE || '0') !== '0';
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
const PRODUCT_IMAGE_WHITE_ITEM_PROTECT_ENABLED =
  String(process.env.PRODUCT_IMAGE_WHITE_ITEM_PROTECT_ENABLED || '1') !== '0';
const PRODUCT_IMAGE_WHITE_ITEM_SHADOW_ENABLED =
  String(process.env.PRODUCT_IMAGE_WHITE_ITEM_SHADOW_ENABLED || '1') !== '0';
const PRODUCT_IMAGE_WHITE_ITEM_MEAN_MIN = Math.min(
  255,
  Math.max(150, Number(process.env.PRODUCT_IMAGE_WHITE_ITEM_MEAN_MIN || 192))
);
const PRODUCT_IMAGE_WHITE_ITEM_SATURATION_MAX = Math.min(
  40,
  Math.max(2, Number(process.env.PRODUCT_IMAGE_WHITE_ITEM_SATURATION_MAX || 9))
);
const PRODUCT_IMAGE_WHITE_ITEM_SHADOW_BASE_ALPHA = Math.min(
  0.35,
  Math.max(0.04, Number(process.env.PRODUCT_IMAGE_WHITE_ITEM_SHADOW_BASE_ALPHA || 0.16))
);
const PRODUCT_IMAGE_WHITE_ITEM_SHADOW_BLUR_SIGMA = Math.min(
  12,
  Math.max(0.5, Number(process.env.PRODUCT_IMAGE_WHITE_ITEM_SHADOW_BLUR_SIGMA || 4.2))
);
const PRODUCT_IMAGE_TARGET_FILL_MIN = Math.min(
  0.95,
  Math.max(0.2, Number(process.env.PRODUCT_IMAGE_TARGET_FILL_MIN || 0.42))
);
const PRODUCT_IMAGE_TARGET_FILL_MAX = Math.min(
  0.98,
  Math.max(PRODUCT_IMAGE_TARGET_FILL_MIN + 0.05, Number(process.env.PRODUCT_IMAGE_TARGET_FILL_MAX || 0.82))
);

const BACKEND_ROOT = path.resolve(__dirname, '..', '..');
const IMAGE_CLEANER_ENSURE_SCRIPT =
  process.env.IMAGE_CLEANER_ENSURE_SCRIPT?.trim() ||
  path.join(BACKEND_ROOT, 'scripts', 'ensure_image_cleaner.js');

let imageCleanerHealthyUntil = 0;
let imageCleanerEnsureInFlight: Promise<void> | null = null;
let sharpModulePromise: Promise<any | null> | null = null;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

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

const normalizeImageMimeType = (
  rawMimeType: string | undefined,
  filename: string,
  buffer: Buffer
): string => {
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

  return 'image/png';
};

const forcePngFilename = (name: string): string => {
  const base = String(name || '').trim();
  if (!base) return `image_${Date.now()}.png`;
  if (/\.png$/i.test(base)) return base;
  return base.replace(/\.[a-z0-9]{2,5}$/i, '') + '.png';
};

const sanitizeFilename = (name: string) => String(name || '').replace(/[^a-zA-Z0-9._-]+/g, '_');

const getSharpModule = async (): Promise<any | null> => {
  if (!sharpModulePromise) {
    sharpModulePromise = import('sharp')
      .then((mod) => mod?.default || mod)
      .catch((error) => {
        console.warn('[product-image] sharp module unavailable:', String((error as any)?.message || error));
        return null;
      });
  }

  return sharpModulePromise;
};

const getImageDimensions = async (
  inputBuffer: Buffer
): Promise<{ width: number; height: number } | null> => {
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

  const applySubtleWhiteProductShadow = async (
    imageBuffer: Buffer,
    canvasWidth: number,
    canvasHeight: number,
    subjectWidth: number,
    subjectHeight: number,
    fillRatio: number
  ): Promise<Buffer> => {
    if (!PRODUCT_IMAGE_WHITE_ITEM_SHADOW_ENABLED) {
      return imageBuffer;
    }

    const safeW = Math.max(1, canvasWidth);
    const safeH = Math.max(1, canvasHeight);
    const ellipseWidth = Math.max(56, Math.floor(subjectWidth * 0.5));
    const ellipseHeight = Math.max(14, Math.floor(subjectHeight * 0.1));
    const cx = Math.floor(safeW / 2);
    const cy = Math.min(safeH - 10, Math.floor(safeH * 0.88));
    const dynamicAlpha = Math.min(
      0.24,
      Math.max(0.08, PRODUCT_IMAGE_WHITE_ITEM_SHADOW_BASE_ALPHA + (0.16 - Math.min(fillRatio, 0.16)) * 0.22)
    );

    const shadowSvg = Buffer.from(
      `<svg width="${safeW}" height="${safeH}" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="${cx}" cy="${cy}" rx="${Math.floor(ellipseWidth / 2)}" ry="${Math.floor(ellipseHeight / 2)}" fill="rgba(118,118,118,${dynamicAlpha.toFixed(3)})" />
      </svg>`
    );

    const blurredShadow = await sharp(shadowSvg)
      .ensureAlpha()
      .blur(PRODUCT_IMAGE_WHITE_ITEM_SHADOW_BLUR_SIGMA)
      .png()
      .toBuffer();

    return sharp({
      create: {
        width: safeW,
        height: safeH,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
      .composite([
        { input: blurredShadow },
        { input: imageBuffer },
      ])
      .png({ compressionLevel: 3, adaptiveFiltering: false })
      .toBuffer();
  };

  const isWhiteDominantSubject = async (
    imageBuffer: Buffer,
    estimatedWidth: number,
    estimatedHeight: number
  ): Promise<boolean> => {
    if (!PRODUCT_IMAGE_WHITE_ITEM_PROTECT_ENABLED) {
      return false;
    }

    try {
      const stats = await sharp(imageBuffer, { failOn: 'none', limitInputPixels: 40_000_000 }).stats();
      const red = Number(stats?.channels?.[0]?.mean || 0);
      const green = Number(stats?.channels?.[1]?.mean || 0);
      const blue = Number(stats?.channels?.[2]?.mean || 0);
      const brightness = (red + green + blue) / 3;
      const channelDistance = (Math.abs(red - green) + Math.abs(red - blue) + Math.abs(green - blue)) / 3;
      const isVeryLight = brightness >= PRODUCT_IMAGE_WHITE_ITEM_MEAN_MIN;
      const isLowSaturation = channelDistance <= PRODUCT_IMAGE_WHITE_ITEM_SATURATION_MAX;
      const hasReasonableSubject = estimatedWidth * estimatedHeight > 0;
      return hasReasonableSubject && isVeryLight && isLowSaturation;
    } catch {
      return false;
    }
  };

  const source = sharp(inputBuffer, { failOn: 'none', limitInputPixels: 40_000_000 });
  const meta = await source.metadata();
  const width = Number(meta?.width || 0);
  const height = Number(meta?.height || 0);
  if (width <= 0 || height <= 0) {
    return inputBuffer;
  }

  const trimMeta = await sharp(inputBuffer, { failOn: 'none', limitInputPixels: 40_000_000 })
    .trim({ background: { r: 255, g: 255, b: 255 }, threshold: 12 })
    .metadata();

  const trimWidth = Number(trimMeta?.width || width);
  const trimHeight = Number(trimMeta?.height || height);
  const fullArea = Math.max(1, width * height);
  const subjectArea = Math.max(1, trimWidth * trimHeight);
  const fillRatio = subjectArea / fullArea;
  const whiteDominantSubject = await isWhiteDominantSubject(inputBuffer, trimWidth, trimHeight);

  let enhanced = sharp(inputBuffer, { failOn: 'none', limitInputPixels: 40_000_000 });
  if (!whiteDominantSubject) {
    enhanced = enhanced
      .normalize()
      .modulate({ brightness: 1.02, saturation: 1.04 })
      .sharpen({ sigma: 1.05, m1: 1, m2: 2, x1: 2, y2: 10, y3: 20 });
  } else {
    // White products are sensitive to aggressive normalization; keep true color and shape.
    enhanced = enhanced.sharpen({ sigma: 0.85, m1: 1, m2: 2, x1: 2, y2: 10, y3: 20 });
  }

  if (fillRatio < PRODUCT_IMAGE_TARGET_FILL_MIN) {
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

  let finalBuffer = await enhanced
    .resize(PRODUCT_IMAGE_MIN_WIDTH, PRODUCT_IMAGE_MIN_HEIGHT, {
      fit: 'inside',
      withoutEnlargement: false,
      kernel: 'lanczos3',
    })
    .png({ compressionLevel: 3, adaptiveFiltering: false })
    .toBuffer();

  if (whiteDominantSubject) {
    const finalMeta = await sharp(finalBuffer, { failOn: 'none', limitInputPixels: 40_000_000 }).metadata();
    finalBuffer = await applySubtleWhiteProductShadow(
      finalBuffer,
      Number(finalMeta?.width || PRODUCT_IMAGE_MIN_WIDTH),
      Number(finalMeta?.height || PRODUCT_IMAGE_MIN_HEIGHT),
      Math.max(1, Math.floor(trimWidth)),
      Math.max(1, Math.floor(trimHeight)),
      fillRatio
    );
  }

  return finalBuffer;
};

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

      await wait(300 * (attempt + 1));
    }
  }

  throw new Error('image cleaner request failed after retries');
};

const readJobBuffer = async (
  input: QueuedProductImageInput
): Promise<{ buffer: Buffer; filename: string; mimeType: string }> => {
  if (input.kind === 'file') {
    const base64 = String(input.contentBase64 || '').includes('base64,')
      ? String(input.contentBase64).split('base64,').pop() || ''
      : String(input.contentBase64 || '');

    if (!base64) {
      throw new Error('Image content is empty');
    }

    const rawName = sanitizeFilename(String(input.filename || `image_${Date.now()}.png`));
    const buffer = Buffer.from(base64, 'base64');
    return {
      buffer,
      filename: rawName,
      mimeType: normalizeImageMimeType(input.mimeType, rawName, buffer),
    };
  }

  const url = String(input.url || '').trim();
  if (!url) {
    throw new Error('Image URL is empty');
  }

  if (url.startsWith('/uploads/')) {
    const relative = url.replace(/^\/+/, '');
    const absPath = path.join(process.cwd(), relative);
    const fileBuffer = fs.readFileSync(absPath);
    const filename = sanitizeFilename(path.basename(absPath));
    return {
      buffer: fileBuffer,
      filename,
      mimeType: normalizeImageMimeType(undefined, filename, fileBuffer),
    };
  }

  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) {
    throw new Error(`Image download failed (${response.status})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const parsedUrl = new URL(url);
  const filename = sanitizeFilename(path.basename(parsedUrl.pathname) || `image_${Date.now()}.png`);
  const mimeType = normalizeImageMimeType(response.headers.get('content-type') || undefined, filename, buffer);

  return { buffer, filename, mimeType };
};

const persistProcessedImage = (buffer: Buffer, suggestedName: string, filePrefix: string): string => {
  const safePrefix = sanitizeFilename(filePrefix || 'product');
  const safeName = sanitizeFilename(forcePngFilename(suggestedName));
  const filename = `${safePrefix}_${Date.now()}_${safeName}`;

  const uploadsDir = path.join(process.cwd(), 'uploads', 'product-images');
  fs.mkdirSync(uploadsDir, { recursive: true });
  const fullPath = path.join(uploadsDir, filename);
  fs.writeFileSync(fullPath, buffer);

  return `/uploads/product-images/${filename}`;
};

export const processQueuedProductImage = async (
  input: QueuedProductImageInput,
  filePrefix: string
): Promise<string> => {
  const loaded = await readJobBuffer(input);
  let buffer = loaded.buffer;
  let filename = loaded.filename;
  let mimeType = loaded.mimeType;

  const dimensions = await getImageDimensions(buffer);
  if (dimensions) {
    if (dimensions.width < PRODUCT_IMAGE_MIN_WIDTH || dimensions.height < PRODUCT_IMAGE_MIN_HEIGHT) {
      if (PRODUCT_IMAGE_AUTO_ENHANCE_LOW_QUALITY) {
        try {
          buffer = await enhanceLowQualityProductImage(buffer);
          mimeType = 'image/png';
          filename = forcePngFilename(filename);
        } catch (error) {
          // Do not reject the whole product due optional enhancement failures.
          console.warn(
            '[product-image] low-quality enhance failed, continuing with original buffer:',
            String((error as any)?.message || error)
          );
        }
      } else if (PRODUCT_IMAGE_QUALITY_GATE_STRICT) {
        throw new Error(
          `Image is too small (${dimensions.width}x${dimensions.height}), min ${PRODUCT_IMAGE_MIN_WIDTH}x${PRODUCT_IMAGE_MIN_HEIGHT}`
        );
      } else {
        console.warn(
          '[product-image] low-quality image accepted (strict gate disabled):',
          `${dimensions.width}x${dimensions.height} < ${PRODUCT_IMAGE_MIN_WIDTH}x${PRODUCT_IMAGE_MIN_HEIGHT}`
        );
      }
    }
  }

  try {
    buffer = await cleanProductImageWithWhiteBackground(buffer, filename, mimeType);
    mimeType = 'image/png';
    filename = forcePngFilename(filename);
  } catch (error) {
    try {
      buffer = await flattenToWhiteWithSharp(buffer);
      mimeType = 'image/png';
      filename = forcePngFilename(filename);
      console.warn('[product-image] cleaner failed, applied local sharp white fallback');
    } catch (fallbackError) {
      throw new Error(
        `white background processing failed: ${String(
          (fallbackError as any)?.message || fallbackError || (error as any)?.message || error
        )}`
      );
    }
  }

  if (PRODUCT_IMAGE_SMART_ENHANCE_ENABLED) {
    try {
      buffer = await smartEnhanceProductImage(buffer);
      mimeType = 'image/png';
      filename = forcePngFilename(filename);
    } catch (error) {
      console.warn('[product-image] smart enhance failed, continuing:', String((error as any)?.message || error));
    }
  }

  return persistProcessedImage(buffer, filename, filePrefix);
};