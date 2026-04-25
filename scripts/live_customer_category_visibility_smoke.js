/* eslint-disable no-console */

const { PrismaClient } = require('@prisma/client');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4000';
const prisma = new PrismaClient();

async function httpJson(path) {
  const response = await fetch(`${BASE_URL}${path}`);
  const text = await response.text();
  let body = {};

  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`${path} => ${response.status}: ${text}`);
  }

  return body;
}

async function run() {
  const stamp = Date.now();

  const vendor = await prisma.vendorProfile.findFirst({
    where: {
      status: 'APPROVED',
      user: { isActive: true },
    },
    select: {
      id: true,
      userId: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  if (!vendor) {
    throw new Error('No approved active vendor found for smoke test');
  }

  const categoryName = `Smoke Visible Category ${stamp}`;
  const categorySlug = `smoke-visible-category-${stamp}`;
  const subCategoryName = `Smoke Visible Subcategory ${stamp}`;
  const subCategorySlug = `smoke-visible-subcategory-${stamp}`;
  const productSlug = `smoke-visible-product-${stamp}`;

  const category = await prisma.category.create({
    data: {
      vendorId: vendor.id,
      storeType: 'diger',
      name: categoryName,
      slug: categorySlug,
      icon: 'shape-outline',
      image: 'market.jpg',
      description: 'Smoke test category for customer visibility',
      isCustom: true,
      isActive: true,
    },
    select: {
      id: true,
      slug: true,
      name: true,
      vendorId: true,
    },
  });

  const product = await prisma.product.create({
    data: {
      vendorId: vendor.id,
      categoryId: category.id,
      subCategoryId: undefined,
      name: `Smoke Visible Product ${stamp}`,
      slug: productSlug,
      description: 'Smoke test product',
      price: 49.9,
      stock: 10,
      unit: 'adet',
      isActive: true,
      approvalStatus: 'APPROVED',
    },
    select: {
      id: true,
      name: true,
      categoryId: true,
    },
  });

  const subCategory = await prisma.subCategory.create({
    data: {
      categoryId: category.id,
      name: subCategoryName,
      slug: subCategorySlug,
      isActive: true,
    },
    select: {
      id: true,
      slug: true,
      name: true,
      categoryId: true,
    },
  });

  await prisma.product.update({
    where: { id: product.id },
    data: {
      subCategoryId: subCategory.id,
    },
  });

  const categoriesRes = await httpJson('/api/categories');
  const categories = Array.isArray(categoriesRes?.data) ? categoriesRes.data : [];
  const productsRes = await httpJson(`/api/products?categoryId=${encodeURIComponent(subCategory.slug)}&limit=50`);
  const products = Array.isArray(productsRes?.data?.products) ? productsRes.data.products : [];

  const matched = categories.find((c) => String(c?.id) === String(subCategory.slug));
  const matchedProduct = products.find((p) => String(p?._id || p?.id || '') === String(product.id));
  const productMatched = Boolean(matchedProduct);
  const productUsesSubCategoryName = String(matchedProduct?.category || '').trim() === subCategory.name;

  const output = {
    baseUrl: BASE_URL,
    vendorId: vendor.id,
    createdCategory: category,
    createdSubCategory: subCategory,
    createdProduct: product,
    customerCategoryCount: categories.length,
    categoryVisibleInCustomerApi: Boolean(matched),
    matchedCustomerCategory: matched || null,
    customerProductsByCategoryCount: products.length,
    createdProductVisibleInCustomerProductsApi: productMatched,
    createdProductUsesSubCategoryName: productUsesSubCategoryName,
    customerProductsFirstIds: products
      .slice(0, 5)
      .map((p) => String(p?._id || p?.id || '')),
  };

  console.log(JSON.stringify(output, null, 2));

  if (!matched || !productMatched || !productUsesSubCategoryName) {
    process.exit(1);
  }
}

run()
  .catch((error) => {
    console.error('LIVE_CATEGORY_VISIBILITY_SMOKE_FAILED');
    console.error(error?.stack || String(error));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
