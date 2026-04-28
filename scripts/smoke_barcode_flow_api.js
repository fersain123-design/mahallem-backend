/*
 * API smoke test for seller barcode flow.
 *
 * Requires backend running on BASE_URL and demo vendor seeded.
 * Usage:
 *   node scripts/smoke_barcode_flow_api.js
 */

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4000/api';
const VENDOR_EMAIL = process.env.VENDOR_EMAIL || 'vendor@demo.com';
const VENDOR_PASSWORD = process.env.VENDOR_PASSWORD || 'Vendor123!';

const randomDigits = (length) => {
  const seed = `${Date.now()}${Math.floor(Math.random() * 1000000)}`;
  return seed.slice(-length).padStart(length, '0');
};

const uniqueBarcode8 = () => {
  // 8-digit barcode is valid in current validation rules.
  const candidate = randomDigits(8);
  return candidate.startsWith('0') ? `1${candidate.slice(1)}` : candidate;
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
  const parsed = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`);
    error.status = response.status;
    error.data = parsed;
    throw error;
  }

  return parsed;
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

const authHeaders = (token) => ({ Authorization: `Bearer ${token}` });

const getVendorCategories = async (token) => {
  const payload = await requestJson(`${BASE_URL}/vendor/categories`, {
    method: 'GET',
    headers: authHeaders(token),
  });

  const categories = Array.isArray(payload?.data?.categories) ? payload.data.categories : [];
  if (categories.length === 0) {
    throw new Error('No vendor categories returned from /vendor/categories');
  }

  const firstCategory = categories[0] || {};
  const firstSubCategory = Array.isArray(firstCategory?.subCategories) ? firstCategory.subCategories[0] : null;

  if (!firstCategory?.id || !firstCategory?.name || !firstSubCategory?.id || !firstSubCategory?.name) {
    throw new Error('Vendor categories response does not include a usable sub-category');
  }

  return {
    categoryId: String(firstCategory.id),
    categoryName: String(firstCategory.name),
    subCategoryId: String(firstSubCategory.id),
    subCategoryName: String(firstSubCategory.name),
  };
};

const createProduct = async (token, data) => {
  return requestJson(`${BASE_URL}/vendor/products`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
};

const lookupBarcode = async (token, barcode) => {
  return requestJson(`${BASE_URL}/vendor/products/lookup-barcode`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ barcode }),
  });
};

const registerVendor = async ({ name, email, password }) => {
  return requestJson(`${BASE_URL}/auth/register`, {
    method: 'POST',
    body: JSON.stringify({
      name,
      email,
      password,
      role: 'VENDOR',
      businessType: 'market',
    }),
  });
};

const ensureVendorLogin = async (email, password) => {
  try {
    return await login(email, password);
  } catch {
    await registerVendor({
      name: `Smoke Seed Vendor ${Date.now()}`,
      email,
      password,
    });
    return login(email, password);
  }
};

const assert = (condition, message, details) => {
  if (!condition) {
    const error = new Error(message);
    error.details = details;
    throw error;
  }
};

(async () => {
  const localBarcode = uniqueBarcode8();
  const notFoundBarcode = uniqueBarcode8();
  const duplicateProductName = `Smoke Local Product ${Date.now()}`;

  try {
    const vendorToken = await ensureVendorLogin(VENDOR_EMAIL, VENDOR_PASSWORD);
    const categoryMeta = await getVendorCategories(vendorToken);

    const firstCreate = await createProduct(vendorToken, {
      name: duplicateProductName,
      categoryName: categoryMeta.categoryName,
      categoryId: categoryMeta.categoryId,
      subCategoryId: categoryMeta.subCategoryId,
      subCategoryName: categoryMeta.subCategoryName,
      price: 19.9,
      stock: 11,
      unit: 'adet',
      barcode: localBarcode,
      status: 'active',
      images: [],
    });

    assert(Boolean(firstCreate?.data?.id || firstCreate?.data?.product?.id), 'Create product did not return a product id', firstCreate);

    const lookupLocal = await lookupBarcode(vendorToken, localBarcode);
    assert(lookupLocal?.success === true, 'lookupLocal should return success=true', lookupLocal);
    assert(lookupLocal?.data?.found === true, 'lookupLocal should be found', lookupLocal);
    assert(lookupLocal?.data?.source === 'database', 'lookupLocal source should be database', lookupLocal);
    assert(
      lookupLocal?.data?.alreadyExistsInVendorStore === true,
      'lookupLocal should flag alreadyExistsInVendorStore=true',
      lookupLocal
    );
    assert(
      String(lookupLocal?.data?.normalizedBarcode || '') === localBarcode,
      'lookupLocal normalizedBarcode should equal created barcode',
      lookupLocal
    );

    let duplicateError = null;
    try {
      await createProduct(vendorToken, {
        name: `${duplicateProductName} Duplicate`,
        categoryName: categoryMeta.categoryName,
        categoryId: categoryMeta.categoryId,
        subCategoryId: categoryMeta.subCategoryId,
        subCategoryName: categoryMeta.subCategoryName,
        price: 21.5,
        stock: 4,
        unit: 'adet',
        barcode: localBarcode,
        status: 'active',
        images: [],
      });
    } catch (error) {
      duplicateError = error;
    }

    assert(Boolean(duplicateError), 'Duplicate create should fail with 409');
    assert(Number(duplicateError?.status) === 409, 'Duplicate create should return HTTP 409', duplicateError?.data);

    const secondVendorEmail = `vendor.smoke.${Date.now()}@example.com`;
    const secondVendorPassword = 'Vendor123!';

    await registerVendor({
      name: `Smoke Vendor ${Date.now()}`,
      email: secondVendorEmail,
      password: secondVendorPassword,
    });

    const secondVendorToken = await login(secondVendorEmail, secondVendorPassword);
    const secondVendorCategories = await getVendorCategories(secondVendorToken);

    const secondVendorCreate = await createProduct(secondVendorToken, {
      name: `Smoke Shared Barcode ${Date.now()}`,
      categoryName: secondVendorCategories.categoryName,
      categoryId: secondVendorCategories.categoryId,
      subCategoryId: secondVendorCategories.subCategoryId,
      subCategoryName: secondVendorCategories.subCategoryName,
      price: 13.5,
      stock: 7,
      unit: 'adet',
      barcode: localBarcode,
      status: 'active',
      images: [],
    });

    assert(Boolean(secondVendorCreate?.data?.id || secondVendorCreate?.data?.product?.id), 'Second vendor should create same barcode successfully', secondVendorCreate);

    const lookupNotFound = await lookupBarcode(vendorToken, `  ${notFoundBarcode}  `);
    assert(lookupNotFound?.success === true, 'lookupNotFound should return success=true', lookupNotFound);
    assert(lookupNotFound?.data?.found === false, 'lookupNotFound should be found=false', lookupNotFound);
    assert(
      String(lookupNotFound?.data?.normalizedBarcode || '') === notFoundBarcode,
      'lookupNotFound should preserve normalizedBarcode',
      lookupNotFound
    );

    let invalidError = null;
    try {
      await lookupBarcode(vendorToken, '12AB34');
    } catch (error) {
      invalidError = error;
    }

    assert(Boolean(invalidError), 'Invalid barcode lookup should fail');
    assert(Number(invalidError?.status) === 400, 'Invalid barcode should return HTTP 400', invalidError?.data);

    console.log('PASS smoke_barcode_flow_api');
    console.log(
      JSON.stringify(
        {
          localLookup: {
            found: lookupLocal?.data?.found,
            source: lookupLocal?.data?.source,
            alreadyExistsInVendorStore: lookupLocal?.data?.alreadyExistsInVendorStore,
            normalizedBarcode: lookupLocal?.data?.normalizedBarcode,
          },
          duplicateStatus: duplicateError?.status,
          sharedBarcodeAcrossSellers: true,
          notFoundLookup: {
            found: lookupNotFound?.data?.found,
            source: lookupNotFound?.data?.source,
            normalizedBarcode: lookupNotFound?.data?.normalizedBarcode,
          },
          invalidStatus: invalidError?.status,
        },
        null,
        2
      )
    );
  } catch (error) {
    console.error('FAIL smoke_barcode_flow_api');
    console.error(error?.message || error);
    if (error?.details) {
      console.error(JSON.stringify(error.details, null, 2));
    }
    if (error?.data) {
      console.error(JSON.stringify(error.data, null, 2));
    }
    process.exitCode = 1;
  }
})();
