"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lookupOpenFoodFactsByBarcode = exports.normalizeOpenFoodFactsProduct = exports.fetchOpenFoodFactsProduct = void 0;
const OFF_API_BASE_URL = String(process.env.OPEN_FOOD_FACTS_BASE_URL || process.env.OFF_API_BASE_URL || 'https://world.openfoodfacts.net/api/v2')
    .trim()
    .replace(/\/+$/, '');
const OFF_API_TIMEOUT_MS = Math.max(1500, Number(process.env.OFF_API_TIMEOUT_MS || 10000));
const OFF_FIELDS = 'code,product_name,brands,quantity,image_url,categories,status,status_verbose';
const asText = (value) => String(value ?? '').trim();
const pickFirstNonEmpty = (values) => {
    for (const value of values) {
        const normalized = asText(value);
        if (normalized)
            return normalized;
    }
    return '';
};
const categoryFromTags = (tags) => {
    if (!Array.isArray(tags) || tags.length === 0)
        return '';
    for (const tag of tags) {
        const value = asText(tag);
        if (!value)
            continue;
        const normalized = value.includes(':') ? value.split(':').slice(1).join(':') : value;
        const candidate = normalized.replace(/-/g, ' ').trim();
        if (candidate)
            return candidate;
    }
    return '';
};
const fetchOpenFoodFactsProduct = async (barcode) => {
    const normalizedBarcode = asText(barcode);
    if (!normalizedBarcode)
        return null;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OFF_API_TIMEOUT_MS);
    try {
        const url = `${OFF_API_BASE_URL}/product/${encodeURIComponent(normalizedBarcode)}?fields=${encodeURIComponent(OFF_FIELDS)}`;
        console.log('OFF_REQUEST', {
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
            console.log('OFF_RESPONSE_ERROR', {
                barcode: normalizedBarcode,
                status: response.status,
            });
            return null;
        }
        const payload = (await response.json());
        console.log('OFF_RESPONSE_OK', {
            barcode: normalizedBarcode,
            status: payload?.status,
            hasProduct: Boolean(payload?.product),
            name: asText(payload?.product?.product_name),
        });
        return payload && typeof payload === 'object' ? payload : null;
    }
    catch (error) {
        const timeoutLike = String(error?.name || '').toLowerCase() === 'aborterror' ||
            String(error?.message || '').toLowerCase().includes('abort');
        console.log('OFF_REQUEST_FAILED', {
            barcode: normalizedBarcode,
            timeoutLike,
            message: String(error?.message || 'Unknown OFF request failure'),
        });
        return null;
    }
    finally {
        clearTimeout(timeoutId);
    }
};
exports.fetchOpenFoodFactsProduct = fetchOpenFoodFactsProduct;
const normalizeOpenFoodFactsProduct = (barcode, rawPayload) => {
    if (!rawPayload || Number(rawPayload.status || 0) !== 1) {
        return null;
    }
    const product = rawPayload.product;
    if (!product || typeof product !== 'object') {
        return null;
    }
    const normalized = {
        barcode: asText(product.code || rawPayload.code || barcode),
        name: pickFirstNonEmpty([product.product_name]),
        brand: pickFirstNonEmpty([product.brands]),
        imageUrl: pickFirstNonEmpty([product.image_url]),
        quantity: pickFirstNonEmpty([product.quantity]),
        category: pickFirstNonEmpty([product.categories, categoryFromTags(product.categories)]),
    };
    if (!normalized.name) {
        return null;
    }
    return normalized;
};
exports.normalizeOpenFoodFactsProduct = normalizeOpenFoodFactsProduct;
const lookupOpenFoodFactsByBarcode = async (barcode) => {
    const raw = await (0, exports.fetchOpenFoodFactsProduct)(barcode);
    return (0, exports.normalizeOpenFoodFactsProduct)(barcode, raw);
};
exports.lookupOpenFoodFactsByBarcode = lookupOpenFoodFactsByBarcode;
