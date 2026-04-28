/*
 * Smoke tests for barcode intelligence layers:
 * - global product pool hit
 * - barcode cache hit/miss
 * - category learning threshold
 * - smart suggestion endpoint
 * - product search index update
 */

const { PrismaClient } = require('@prisma/client');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4000/api';
const VENDOR_EMAIL = process.env.VENDOR_EMAIL || 'vendor@demo.com';
const VENDOR_PASSWORD = process.env.VENDOR_PASSWORD || 'Vendor123!';

const prisma = new PrismaClient();

const requestJson = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  const parsed = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`);
    error.status = response.status;
    error.data = parsed;
    throw error;
  }

  return parsed;
};

const authHeaders = (token) => ({ Authorization: `Bearer ${token}` });

const randomDigits = (length) => {
  const seed = `${Date.now()}${Math.floor(Math.random() * 1000000)}`;
  return seed.slice(-length).padStart(length, '0');
};

const uniqueBarcode8 = () => {
  const candidate = randomDigits(8);
  return candidate.startsWith('0') ? `1${candidate.slice(1)}` : candidate;
};

const assert = (condition, message, details) => {
  if (!condition) {
    const error = new Error(message);
    error.details = details;
    throw error;
  }
};

const login = async (email, password) => {
  const payload = await requestJson(`${BASE_URL}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  const token =
    payload?.data?.accessToken ||
    payload?.data?.access_token ||
    payload?.accessToken ||
    payload?.access_token;

  if (!token) {
    throw new Error(`Login token missing for ${email}`);
  }

  return token;
};

const lookupBarcode = async (token, barcode) =>
  requestJson(`${BASE_URL}/vendor/products/lookup-barcode`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ barcode }),
  });

(async () => {
  let createdProductId = null;
  let createdBarcode = null;
  try {
    const health = await requestJson('http://127.0.0.1:4000/health');
    assert(String(health?.status || '') === 'ok', 'Backend health check failed', health);

    const token = await login(VENDOR_EMAIL, VENDOR_PASSWORD);

    const categoriesPayload = await requestJson(`${BASE_URL}/vendor/categories`, {
      method: 'GET',
      headers: authHeaders(token),
    });

    const categories = Array.isArray(categoriesPayload?.data?.categories)
      ? categoriesPayload.data.categories
      : [];
    const firstCategory = categories[0] || null;
    const firstSubCategory = Array.isArray(firstCategory?.subCategories)
      ? firstCategory.subCategories[0]
      : null;

    assert(firstCategory?.id && firstSubCategory?.id, 'No vendor category/subcategory found', {
      categoriesCount: categories.length,
    });

    const globalBarcode = uniqueBarcode8();
    const cacheBarcode = uniqueBarcode8();
    const missBarcode = uniqueBarcode8();
    const learnedCategory = 'Smoke Learned Category';

    await prisma.globalProduct.upsert({
      where: { barcode: globalBarcode },
      update: {
        name: 'Smoke Global Product',
        brand: 'SmokeBrand',
        image: 'https://example.com/global.png',
        category: 'Global Category Fallback',
      },
      create: {
        barcode: globalBarcode,
        name: 'Smoke Global Product',
        brand: 'SmokeBrand',
        image: 'https://example.com/global.png',
        category: 'Global Category Fallback',
      },
    });

    await prisma.barcodeCategoryLearning.upsert({
      where: {
        barcode_selectedCategory: {
          barcode: globalBarcode,
          selectedCategory: learnedCategory,
        },
      },
      update: { count: 3 },
      create: {
        barcode: globalBarcode,
        selectedCategory: learnedCategory,
        count: 3,
      },
    });

    await prisma.barcodeCache.upsert({
      where: { barcode: cacheBarcode },
      update: {
        name: 'Smoke Cached Product',
        brand: 'SmokeCacheBrand',
        image: 'https://example.com/cache.png',
        lastFetchedAt: new Date(),
        rawApiResponse: JSON.stringify({
          normalized: {
            quantity: '1 adet',
            category: 'Smoke Cache Category',
          },
        }),
      },
      create: {
        barcode: cacheBarcode,
        name: 'Smoke Cached Product',
        brand: 'SmokeCacheBrand',
        image: 'https://example.com/cache.png',
        lastFetchedAt: new Date(),
        rawApiResponse: JSON.stringify({
          normalized: {
            quantity: '1 adet',
            category: 'Smoke Cache Category',
          },
        }),
      },
    });

    const globalLookup = await lookupBarcode(token, globalBarcode);
    assert(globalLookup?.success === true, 'Global lookup should return success=true', globalLookup);
    assert(globalLookup?.data?.found === true, 'Global lookup should be found=true', globalLookup);
    assert(globalLookup?.data?.source === 'global_pool', 'Global lookup should be served from global_pool', globalLookup);
    assert(
      String(globalLookup?.data?.product?.suggestedCategory || '') === learnedCategory,
      'Category learning threshold should override category to learned category',
      globalLookup
    );

    const cacheLookup = await lookupBarcode(token, cacheBarcode);
    assert(cacheLookup?.success === true, 'Cache lookup should return success=true', cacheLookup);
    assert(cacheLookup?.data?.found === true, 'Cache lookup should be found=true', cacheLookup);
    assert(cacheLookup?.data?.source === 'barcode_cache', 'Cache lookup should be served from barcode_cache', cacheLookup);

    const missLookup = await lookupBarcode(token, missBarcode);
    assert(missLookup?.success === true, 'Miss lookup should return success=true', missLookup);
    assert(
      String(missLookup?.data?.source || '') !== 'barcode_cache',
      'Miss lookup should not be served from barcode_cache',
      missLookup
    );

    createdBarcode = uniqueBarcode8();

    const createPayload = await requestJson(`${BASE_URL}/vendor/products`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        name: `Smoke Search Product ${Date.now()}`,
        categoryName: String(firstCategory.name),
        categoryId: String(firstCategory.id),
        subCategoryId: String(firstSubCategory.id),
        subCategoryName: String(firstSubCategory.name),
        price: 29.9,
        stock: 5,
        unit: 'adet',
        barcode: createdBarcode,
        status: 'active',
        images: [],
      }),
    });

    createdProductId = String(createPayload?.data?.id || createPayload?.data?.product?.id || '').trim();
    if (!createdProductId && createdBarcode) {
      const createdRow = await prisma.product.findFirst({
        where: { barcode: createdBarcode },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      createdProductId = String(createdRow?.id || '').trim();
    }
    assert(createdProductId, 'Created product id missing', createPayload);

    const indexAfterCreate = await prisma.productSearchIndex.findUnique({
      where: { productId: createdProductId },
    });
    assert(Boolean(indexAfterCreate), 'Product search index should be created after product create', {
      productId: createdProductId,
    });

    const updateTargetId = String(createdProductId || '').trim();
    assert(updateTargetId, 'No product id available for update/index check', {
      createdProductId,
    });

    const updatePayload = await requestJson(`${BASE_URL}/vendor/products/${updateTargetId}`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({
        name: `Updated Search Name ${Date.now()}`,
      }),
    });
    assert(updatePayload?.success === true, 'Product update should return success=true', updatePayload);

    const indexAfterUpdate = await prisma.productSearchIndex.findUnique({
      where: { productId: updateTargetId },
    });
    assert(Boolean(indexAfterUpdate), 'Product search index should exist after update', {
      productId: updateTargetId,
    });

    const suggestionsPayload = await requestJson(
      `${BASE_URL}/vendor/products/smart-suggestions?categoryId=${encodeURIComponent(
        String(firstCategory.id)
      )}&subCategoryId=${encodeURIComponent(String(firstSubCategory.id))}&limit=6`,
      {
        method: 'GET',
        headers: authHeaders(token),
      }
    );

    assert(suggestionsPayload?.success === true, 'Smart suggestions should return success=true', suggestionsPayload);
    assert(Array.isArray(suggestionsPayload?.data), 'Smart suggestions data should be array', suggestionsPayload);

    console.log('PASS smoke_barcode_intelligence_layers');
    console.log(
      JSON.stringify(
        {
          globalPoolHit: globalLookup?.data?.source,
          categoryLearningSuggestedCategory: globalLookup?.data?.product?.suggestedCategory,
          cacheHitSource: cacheLookup?.data?.source,
          cacheMissSource: missLookup?.data?.source,
          searchIndexAfterCreate: Boolean(indexAfterCreate),
          searchIndexAfterUpdate: Boolean(indexAfterUpdate),
          smartSuggestionsCount: suggestionsPayload?.data?.length || 0,
        },
        null,
        2
      )
    );
  } catch (error) {
    console.error('FAIL smoke_barcode_intelligence_layers');
    console.error(error?.message || error);
    if (error?.details) {
      console.error(JSON.stringify(error.details, null, 2));
    }
    if (error?.data) {
      console.error(JSON.stringify(error.data, null, 2));
    }
    process.exitCode = 1;
  } finally {
    if (createdProductId) {
      try {
        await prisma.product.delete({ where: { id: createdProductId } });
      } catch {}
    }
    await prisma.$disconnect();
  }
})();
