/* eslint-disable no-console */

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4000';

const nowTag = Date.now();

const VENDORS = [
  {
    label: 'KASAP',
    businessType: 'kasap',
    email: `auto.kasap.${nowTag}@demo.com`,
    password: 'Vendor123!',
    productName: 'Dana Kiyma 500gr',
    expectedSubCategorySlug: 'kiyma',
    invalidSubCategorySlug: 'kahve-cesitleri',
  },
  {
    label: 'MANAV',
    businessType: 'manav',
    email: `auto.manav.${nowTag}@demo.com`,
    password: 'Vendor123!',
    productName: 'Taze Domates',
    expectedSubCategorySlug: 'sebze',
    invalidSubCategorySlug: 'kiyma',
  },
  {
    label: 'MARKET',
    businessType: 'market',
    email: `auto.market.${nowTag}@demo.com`,
    password: 'Vendor123!',
    productName: 'Ayran 1L',
    expectedSubCategorySlug: 'sut-urunleri',
    invalidSubCategorySlug: 'kiyma',
  },
  {
    label: 'FIRIN_PASTANE',
    businessType: 'firin_pastane',
    email: `auto.firin.${nowTag}@demo.com`,
    password: 'Vendor123!',
    productName: 'Tereyagli Pogaca',
    expectedSubCategorySlug: 'unlu-mamuller',
    invalidSubCategorySlug: 'kiyma',
  },
  {
    label: 'BUFE',
    businessType: 'bufe',
    email: `auto.bufe.${nowTag}@demo.com`,
    password: 'Vendor123!',
    productName: 'Patates Cipsi 150gr',
    expectedSubCategorySlug: 'atistirmalik',
    invalidSubCategorySlug: 'kiyma',
  },
  {
    label: 'SARKUTERI',
    businessType: 'sarkuteri',
    email: `auto.sarkuteri.${nowTag}@demo.com`,
    password: 'Vendor123!',
    productName: 'Kasar Peynir 500gr',
    expectedSubCategorySlug: 'peynir',
    invalidSubCategorySlug: 'kiyma',
  },
  {
    label: 'SU_BAYI',
    businessType: 'su_bayi',
    email: `auto.subayi.${nowTag}@demo.com`,
    password: 'Vendor123!',
    productName: 'Damacana Su 19L',
    expectedSubCategorySlug: 'damacana-su',
    invalidSubCategorySlug: 'kiyma',
  },
  {
    label: 'BALIKCI',
    businessType: 'balikci',
    email: `auto.balikci.${nowTag}@demo.com`,
    password: 'Vendor123!',
    productName: 'Levrek 1kg',
    expectedSubCategorySlug: 'gunluk-balik',
    invalidSubCategorySlug: 'kiyma',
  },
  {
    label: 'TATLICI',
    businessType: 'tatlici',
    email: `auto.tatlici.${nowTag}@demo.com`,
    password: 'Vendor123!',
    productName: 'Fistikli Baklava',
    expectedSubCategorySlug: 'serbetli-tatlilar',
    invalidSubCategorySlug: 'kiyma',
  },
  {
    label: 'KAFE',
    businessType: 'kafe_kahve_icecek',
    email: `auto.kafe.${nowTag}@demo.com`,
    password: 'Vendor123!',
    productName: 'Filtre Kahve',
    expectedSubCategorySlug: 'kahve',
    invalidSubCategorySlug: 'kiyma',
  },
  {
    label: 'GIYIM_AKSESUAR',
    businessType: 'giyim_aksesuar',
    email: `auto.giyim.${nowTag}@demo.com`,
    password: 'Vendor123!',
    productName: 'Kadin Elbise',
    expectedSubCategorySlug: 'ust-giyim',
    invalidSubCategorySlug: 'kiyma',
  },
  {
    label: 'EV_GUNLUK_IHTIYAC',
    businessType: 'ev_gunluk_ihtiyac',
    email: `auto.evgunluk.${nowTag}@demo.com`,
    password: 'Vendor123!',
    productName: 'Camasir Deterjani',
    expectedSubCategorySlug: 'temizlik-urunleri',
    invalidSubCategorySlug: 'kiyma',
  },
  {
    label: 'KURUYEMIS',
    businessType: 'kuruyemis',
    email: `auto.kuruyemis.${nowTag}@demo.com`,
    password: 'Vendor123!',
    productName: 'Karisik Kuruyemis Ozel',
    expectedSubCategorySlug: 'kuruyemis',
    invalidSubCategorySlug: 'kiyma',
  },
  {
    label: 'AKTAR',
    businessType: 'aktar',
    email: `auto.aktar.${nowTag}@demo.com`,
    password: 'Vendor123!',
    productName: 'Ihlamur Bitki Cayi',
    expectedSubCategorySlug: 'bitki-caylari',
    invalidSubCategorySlug: 'kiyma',
  },
  {
    label: 'CICEKCI',
    businessType: 'cicekci',
    email: `auto.cicekci.${nowTag}@demo.com`,
    password: 'Vendor123!',
    productName: 'Gul Buketi',
    expectedSubCategorySlug: 'buketler',
    invalidSubCategorySlug: 'kiyma',
  },
  {
    label: 'PETSHOP',
    businessType: 'petshop',
    email: `auto.petshop.${nowTag}@demo.com`,
    password: 'Vendor123!',
    productName: 'Kedi Mamasi Somonlu',
    expectedSubCategorySlug: 'mama',
    invalidSubCategorySlug: 'kiyma',
  },
  {
    label: 'TUP_GAZ_BAYI',
    businessType: 'tup_gaz_bayi',
    email: `auto.tupgaz.${nowTag}@demo.com`,
    password: 'Vendor123!',
    productName: 'Ev Tupu 12kg',
    expectedSubCategorySlug: 'ev-tupu',
    invalidSubCategorySlug: 'kiyma',
  },
  {
    label: 'RESTORAN',
    businessType: 'restoran',
    email: `auto.restoran.${nowTag}@demo.com`,
    password: 'Vendor123!',
    productName: 'Kebap Menu',
    expectedSubCategorySlug: 'ana-yemek',
    invalidSubCategorySlug: 'kiyma',
  },
  {
    label: 'ECZANE',
    businessType: 'eczane',
    email: `auto.eczane.${nowTag}@demo.com`,
    password: 'Vendor123!',
    productName: 'Multivitamin Tablet',
    expectedSubCategorySlug: 'vitamin-supplement',
    invalidSubCategorySlug: 'kiyma',
  },
  {
    label: 'TEMIZLIK_KOZMETIK',
    businessType: 'temizlik_kozmetik',
    email: `auto.kozmetik.${nowTag}@demo.com`,
    password: 'Vendor123!',
    productName: 'Nemlendirici Cilt Serumu',
    expectedSubCategorySlug: 'cilt-bakim',
    invalidSubCategorySlug: 'kiyma',
  },
  {
    label: 'DIGER',
    businessType: 'diger',
    email: `auto.diger.${nowTag}@demo.com`,
    password: 'Vendor123!',
    productName: 'Mikser 1000W',
    expectedSubCategorySlug: 'diger',
    invalidSubCategorySlug: 'kiyma',
  },
];

async function http(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, options);
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch (_) {
    body = { raw: text };
  }

  if (!response.ok) {
    const message = body?.message || body?.error || text || `HTTP ${response.status}`;
    const err = new Error(`${path} => ${response.status}: ${message}`);
    err.status = response.status;
    err.body = body;
    throw err;
  }

  return body;
}

async function registerVendor(vendor) {
  const payload = {
    name: `${vendor.label} Otomasyon`,
    email: vendor.email,
    password: vendor.password,
    role: 'VENDOR',
    businessType: vendor.businessType,
    deliveryCoverage: 'PLATFORM',
  };

  try {
    await http('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return { registered: true };
  } catch (error) {
    if (String(error.message || '').includes('Email already registered')) {
      return { registered: false, reused: true };
    }
    throw error;
  }
}

async function login(email, password) {
  const loginRes = await http('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const accessToken = loginRes?.data?.accessToken;
  if (!accessToken) {
    throw new Error(`Token missing for ${email}`);
  }
  return accessToken;
}

async function createProduct(vendorToken, productName) {
  const slug = `${productName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Math.floor(Math.random() * 10000)}`;
  const res = await http('/api/vendor/products', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${vendorToken}`,
    },
    body: JSON.stringify({
      name: productName,
      slug,
      description: `Otomasyon test urunu: ${productName}`,
      price: 129.9,
      stock: 25,
      unit: 'adet',
      status: 'active',
    }),
  });

  return res?.data;
}

async function createProductWithWrongSubCategory(vendorToken, productName, invalidSubCategorySlug) {
  try {
    await http('/api/vendor/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${vendorToken}`,
      },
      body: JSON.stringify({
        name: `${productName} Yanlis Alt Kategori`,
        description: 'Negatif test',
        price: 99,
        stock: 10,
        unit: 'adet',
        subCategoryId: invalidSubCategorySlug,
      }),
    });
    return { rejected: false };
  } catch (error) {
    return {
      rejected: true,
      status: error.status,
      message: error?.body?.message || String(error.message || ''),
    };
  }
}

async function run() {
  const output = {
    baseUrl: BASE_URL,
    startedAt: new Date().toISOString(),
    tests: [],
  };

  await http('/api/products?limit=1');

  for (const vendor of VENDORS) {
    const registerInfo = await registerVendor(vendor);
    const token = await login(vendor.email, vendor.password);

    const created = await createProduct(token, vendor.productName);
    const actualSub = created?.subCategory?.slug || null;
    const actualCat = created?.category?.slug || null;

    const negative = await createProductWithWrongSubCategory(
      token,
      vendor.productName,
      vendor.invalidSubCategorySlug
    );

    const result = {
      vendor: vendor.label,
      email: vendor.email,
      businessType: vendor.businessType,
      registerInfo,
      createdProductId: created?.id,
      createdProductName: created?.name,
      categorySlug: actualCat,
      subCategorySlug: actualSub,
      expectedSubCategorySlug: vendor.expectedSubCategorySlug,
      matched: actualSub === vendor.expectedSubCategorySlug,
      subCategoryAssigned: Boolean(actualSub),
      wrongSubCategoryRejected: negative.rejected,
      wrongSubCategoryRejectStatus: negative.status || null,
      wrongSubCategoryRejectMessage: negative.message || null,
    };

    output.tests.push(result);
  }

  output.success =
    output.tests.every(
      (t) => t.matched && t.subCategoryAssigned && t.wrongSubCategoryRejected && Number(t.wrongSubCategoryRejectStatus) === 400
    );
  output.finishedAt = new Date().toISOString();

  console.log(JSON.stringify(output, null, 2));

  if (!output.success) {
    process.exit(1);
  }
}

run().catch((error) => {
  console.error('LIVE_VALIDATION_FAILED');
  console.error(error?.stack || String(error));
  process.exit(1);
});
