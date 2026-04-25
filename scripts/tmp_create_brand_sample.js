/* eslint-disable no-console */

const BASE = 'http://127.0.0.1:4000/api';

async function request(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, options);
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${path} -> ${response.status} ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  }
  return data;
}

async function main() {
  const stamp = Date.now();

  const login = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'vendor@demo.com', password: 'Vendor123!' }),
  });

  const token = login?.data?.accessToken;
  if (!token) throw new Error('Vendor token missing');

  const categories = await request('/vendor/categories', {
    headers: { Authorization: `Bearer ${token}` },
  });

  const list = categories?.data?.categories || [];
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error('No vendor categories found');
  }

  const first = list[0];
  const categoryId = String(first.id || '').trim();
  const categoryName = String(first.name || 'Diger').trim();

  const meta = {
    sku: `SMK-${stamp}`,
    barcode: '',
    brand: 'Ulker',
    origin: 'Turkiye',
    shelfLifeDays: 30,
    netWeightValue: 1,
    netWeightUnit: 'adet',
    vatRate: 10,
    minOrderQty: 1,
    maxOrderQty: null,
    prepTimeMin: 10,
    tags: ['ornek', 'marka-test'],
    highlights: ['Marka alani test urunu'],
    seoTitle: '',
    seoDescription: '',
    specs: [{ key: 'Paket', value: 'Ornek' }],
  };

  const description = `Marka gorunumu kontrol urunu\n\n[MAHALLEM_PRODUCT_META_V1]\n${JSON.stringify(meta)}\n[/MAHALLEM_PRODUCT_META_V1]`;

  const payload = {
    name: `Marka Test Urunu ${stamp}`,
    category: categoryName,
    categoryId,
    price: 39.9,
    stock: 12,
    unit: 'adet',
    status: 'active',
    description,
    imageUrl: `https://picsum.photos/seed/mahallem-brand-${stamp}/900/900`,
    submissionSource: 'ADVANCED',
  };

  const created = await request('/vendor/products', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  console.log(JSON.stringify({
    ok: true,
    productId: created?.data?.id || null,
    productName: created?.data?.name || null,
    brand: meta.brand,
    category: categoryName,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, message: String(error?.message || error) }, null, 2));
  process.exit(1);
});
