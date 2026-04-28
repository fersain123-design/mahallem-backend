import { logger } from '../utils/logger';

export type OpenFoodFactsRawProductResponse = {
  code?: string;
  status?: number;
  status_verbose?: string;
  product?: {
    code?: string;
    product_name?: string;
    generic_name?: string;
    brands?: string;
    quantity?: string;
    image_url?: string;
    categories?: string;
    category_tags?: string[];
    ingredients_text?: string;
  };
};

export type OpenFoodFactsNormalizedProduct = {
  barcode: string;
  name: string;
  genericName: string;
  brand: string;
  imageUrl: string;
  quantity: string;
  category: string;
  categories: string;
  categoryTags: string[];
  ingredientsText: string;
};

export type OpenFoodFactsLookupErrorCode = 'timeout' | 'api_error';

export class OpenFoodFactsLookupError extends Error {
  constructor(
    message: string,
    public code: OpenFoodFactsLookupErrorCode
  ) {
    super(message);
    this.name = 'OpenFoodFactsLookupError';
  }
}

export type OpenFoodFactsLookupResult = {
  product: OpenFoodFactsNormalizedProduct | null;
  rawPayload: OpenFoodFactsRawProductResponse | null;
};

const OFF_API_BASE_URL =
  String(process.env.OPEN_FOOD_FACTS_BASE_URL || process.env.OFF_API_BASE_URL || 'https://world.openfoodfacts.net/api/v2')
    .trim()
    .replace(/\/+$/, '');

const OFF_API_TIMEOUT_MS = Math.max(1500, Number(process.env.OFF_API_TIMEOUT_MS || 10000));
const OFF_FIELDS =
  'code,product_name,generic_name,brands,quantity,image_url,categories,category_tags,ingredients_text,status,status_verbose';

const asText = (value: unknown) => String(value ?? '').trim();

const pickFirstNonEmpty = (values: unknown[]) => {
  for (const value of values) {
    const normalized = asText(value);
    if (normalized) return normalized;
  }
  return '';
};

const categoryFromTags = (tags: unknown): string => {
  if (!Array.isArray(tags) || tags.length === 0) return '';

  for (const tag of tags) {
    const value = asText(tag);
    if (!value) continue;

    const normalized = value.includes(':') ? value.split(':').slice(1).join(':') : value;
    const candidate = normalized.replace(/-/g, ' ').trim();
    if (candidate) return candidate;
  }

  return '';
};

export const fetchOpenFoodFactsProduct = async (
  barcode: string
): Promise<OpenFoodFactsRawProductResponse | null> => {
  const normalizedBarcode = asText(barcode);
  if (!normalizedBarcode) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OFF_API_TIMEOUT_MS);

  try {
    const url = `${OFF_API_BASE_URL}/product/${encodeURIComponent(normalizedBarcode)}?fields=${encodeURIComponent(OFF_FIELDS)}`;
    logger.debug('OFF_REQUEST', {
      barcode: normalizedBarcode,
      timeoutMs: OFF_API_TIMEOUT_MS,
      url,
    });

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      logger.error('OFF_RESPONSE_ERROR', {
        barcode: normalizedBarcode,
        status: response.status,
      });
      throw new OpenFoodFactsLookupError(`OFF returned status ${response.status}`, 'api_error');
    }

    const payload = (await response.json()) as OpenFoodFactsRawProductResponse;
    logger.debug('OFF_RESPONSE_OK', {
      barcode: normalizedBarcode,
      status: payload?.status,
      hasProduct: Boolean(payload?.product),
      name: asText(payload?.product?.product_name),
    });
    return payload && typeof payload === 'object' ? payload : null;
  } catch (error: any) {
    const timeoutLike =
      String(error?.name || '').toLowerCase() === 'aborterror' ||
      String(error?.message || '').toLowerCase().includes('abort');
    logger.error('OFF_REQUEST_FAILED', {
      barcode: normalizedBarcode,
      timeoutLike,
      message: String(error?.message || 'Unknown OFF request failure'),
    });

    if (error instanceof OpenFoodFactsLookupError) {
      throw error;
    }

    throw new OpenFoodFactsLookupError(
      String(error?.message || 'Unknown OFF request failure'),
      timeoutLike ? 'timeout' : 'api_error'
    );
  } finally {
    clearTimeout(timeoutId);
  }
};

export const normalizeOpenFoodFactsProduct = (
  barcode: string,
  rawPayload: OpenFoodFactsRawProductResponse | null
): OpenFoodFactsNormalizedProduct | null => {
  if (!rawPayload || Number(rawPayload.status || 0) !== 1) {
    return null;
  }

  const product = rawPayload.product;
  if (!product || typeof product !== 'object') {
    return null;
  }

  const normalized: OpenFoodFactsNormalizedProduct = {
    barcode: asText(product.code || rawPayload.code || barcode),
    name: pickFirstNonEmpty([product.product_name]),
    genericName: pickFirstNonEmpty([product.generic_name]),
    brand: pickFirstNonEmpty([product.brands]),
    imageUrl: pickFirstNonEmpty([product.image_url]),
    quantity: pickFirstNonEmpty([product.quantity]),
    category: pickFirstNonEmpty([product.categories, categoryFromTags(product.categories)]),
    categories: pickFirstNonEmpty([product.categories]),
    categoryTags: Array.isArray(product.category_tags)
      ? product.category_tags
          .map((item) => asText(item))
          .filter(Boolean)
      : [],
    ingredientsText: pickFirstNonEmpty([product.ingredients_text]),
  };

  if (!normalized.name) {
    return null;
  }

  return normalized;
};

export const lookupOpenFoodFactsByBarcode = async (
  barcode: string
): Promise<OpenFoodFactsNormalizedProduct | null> => {
  const raw = await fetchOpenFoodFactsProduct(barcode);
  return normalizeOpenFoodFactsProduct(barcode, raw);
};

export const lookupOpenFoodFactsByBarcodeDetailed = async (
  barcode: string
): Promise<OpenFoodFactsLookupResult> => {
  const raw = await fetchOpenFoodFactsProduct(barcode);
  return {
    product: normalizeOpenFoodFactsProduct(barcode, raw),
    rawPayload: raw,
  };
};
