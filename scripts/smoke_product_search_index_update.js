/*
 * Deterministic smoke test for vendor product search index create/update flow.
 * No external API dependency.
 */

const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4000/api';
const VENDOR_EMAIL = process.env.VENDOR_EMAIL || 'vendor@demo.com';
const VENDOR_PASSWORD = process.env.VENDOR_PASSWORD || 'Vendor123!';

const prisma = new PrismaClient();

const assert = (condition, message, details) => {
  if (!condition) {
    const error = new Error(message);
    error.details = details;
    throw error;
  }
};

const requestJson = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let parsed = {};
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }
  }

  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`);
    error.status = response.status;
    error.data = parsed;
    throw error;
  }

  return parsed;
};

const authHeaders = (token) => ({ Authorization: `Bearer ${token}` });

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

  assert(token, `Login token missing for ${email}`, payload);
  return token;
};

const getVendorToken = async () => {
  try {
    return await login(VENDOR_EMAIL, VENDOR_PASSWORD);
  } catch (error) {
    const vendorUser =
      (await prisma.user.findUnique({
        where: { email: VENDOR_EMAIL },
        select: { id: true, role: true, isActive: true },
      })) ||
      (await prisma.user.findFirst({
        where: { role: 'VENDOR', isActive: true },
        orderBy: { createdAt: 'asc' },
        select: { id: true, role: true, isActive: true, email: true },
      }));

    assert(vendorUser?.id, 'Vendor user not found for JWT fallback', { email: VENDOR_EMAIL });
    assert(vendorUser?.role === 'VENDOR', 'JWT fallback user must be VENDOR', vendorUser);
    assert(vendorUser?.isActive !== false, 'JWT fallback vendor must be active', vendorUser);

    const secret = process.env.JWT_SECRET || 'your-secret-key';
    return jwt.sign({ userId: vendorUser.id, role: 'VENDOR' }, secret, { expiresIn: '30m' });
  }
};

(async () => {
  let createdProductId = null;
  try {
    const health = await requestJson('http://127.0.0.1:4000/health');
    assert(String(health?.status || '') === 'ok', 'Backend health check failed', health);

    const token = await getVendorToken();

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

    const createName = `Smoke IDX Create ${Date.now()}`;
    const updateName = `Smoke IDX Updated ${Date.now()}`;

    const createPayload = await requestJson(`${BASE_URL}/vendor/products`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        name: createName,
        categoryId: String(firstCategory.id),
        categoryName: String(firstCategory.name || 'Smoke Category'),
        subCategoryId: String(firstSubCategory.id),
        subCategoryName: String(firstSubCategory.name || 'Smoke Subcategory'),
        price: 29.9,
        stock: 5,
        unit: 'adet',
        status: 'active',
        images: [],
      }),
    });

    createdProductId = String(createPayload?.data?.id || '').trim();
    assert(createdProductId, 'Created product id missing from API response', createPayload);

    const indexAfterCreate = await prisma.productSearchIndex.findUnique({
      where: { productId: createdProductId },
    });

    assert(Boolean(indexAfterCreate), 'Product search index should be created after product create', {
      productId: createdProductId,
    });

    const updatePayload = await requestJson(`${BASE_URL}/vendor/products/${createdProductId}`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({
        name: updateName,
      }),
    });

    assert(updatePayload?.success === true, 'Product update should return success=true', updatePayload);

    const indexAfterUpdate = await prisma.productSearchIndex.findUnique({
      where: { productId: createdProductId },
    });

    assert(Boolean(indexAfterUpdate), 'Product search index should exist after update', {
      productId: createdProductId,
    });

    const normalizedName = String(indexAfterUpdate?.normalizedName || '').toLocaleLowerCase('tr-TR');
    assert(
      normalizedName.includes('updated') || normalizedName.includes('smoke idx'),
      'Product search index normalizedName should reflect updated product name',
      {
        normalizedName,
        expectedName: updateName,
      }
    );

    console.log('PASS smoke_product_search_index_update');
    console.log(
      JSON.stringify(
        {
          productId: createdProductId,
          indexAfterCreate: Boolean(indexAfterCreate),
          indexAfterUpdate: Boolean(indexAfterUpdate),
          normalizedName,
        },
        null,
        2
      )
    );
  } catch (error) {
    console.error('FAIL smoke_product_search_index_update');
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
