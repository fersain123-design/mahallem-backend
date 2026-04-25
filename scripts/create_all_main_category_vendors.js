const path = require('path');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = 'Vendor123!';
const CITY = 'Mersin';
const DISTRICT = 'Tarsus';
const NEIGHBORHOOD = 'Gazipasa Mahallesi';
const ADDRESS = 'Mersin / Tarsus / Gazipasa Mahallesi';
const ADDRESS_LINE = 'Gazipasa Mahallesi Demo Cad. No: 1';
const LATITUDE = 36.9109;
const LONGITUDE = 34.8619;
const MAIN_CATEGORY_SLUGS = [
  'kasap',
  'manav',
  'market',
  'market-manav',
  'firin',
  'pastane',
  'firin-pastane',
  'kasap-sarkuteri',
  'bufe',
  'sarkuteri',
  'su-bayi',
  'balikci',
  'tatlici',
  'kafe-kahve-icecek',
  'ev-gunluk-ihtiyac',
  'kuruyemisci',
  'aktar',
  'cicekci',
  'petshop',
];

const BUSINESS_TYPE_BY_CATEGORY_SLUG = {
  market: 'market',
  manav: 'manav',
  'market-manav': 'market_manav',
  firin: 'firin',
  pastane: 'pastane',
  'firin-pastane': 'pastane',
  'kasap-sarkuteri': 'kasap_sarkuteri',
  kasap: 'kasap',
  bufe: 'bufe',
  sarkuteri: 'sarkuteri',
  'su-bayi': 'su_bayi',
  balikci: 'balikci',
  tatlici: 'tatlici',
  'kafe-kahve-icecek': 'kafe',
  'ev-gunluk-ihtiyac': 'ev_gunluk_ihtiyac',
  kuruyemisci: 'kuruyemis',
  aktar: 'aktar',
  cicekci: 'cicekci',
  petshop: 'petshop',
};

const CATEGORY_BASE_PRICE = {
  market: 35,
  manav: 28,
  'market-manav': 30,
  firin: 26,
  pastane: 42,
  'firin-pastane': 32,
  'kasap-sarkuteri': 120,
  kasap: 180,
  bufe: 24,
  sarkuteri: 75,
  'su-bayi': 20,
  balikci: 140,
  tatlici: 55,
  'kafe-kahve-icecek': 45,
  'ev-gunluk-ihtiyac': 60,
  kuruyemisci: 95,
  aktar: 70,
  cicekci: 160,
  petshop: 110,
};

function slugify(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function titleize(value) {
  return String(value || '')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function buildVendorSeed(category, index) {
  const businessType = BUSINESS_TYPE_BY_CATEGORY_SLUG[category.slug] || 'diger';
  const email = `vendor-${category.slug}@demo.com`;
  const phone = `55572${String(index + 1).padStart(5, '0')}`;
  const categoryLabel = titleize(category.slug);

  return {
    email,
    phone,
    name: `${categoryLabel} Satici`,
    shopName: `Demo ${category.name}`,
    iban: `TR00000000000000000000${String(index + 1).padStart(4, '0')}`,
    bankName: 'Demo Bank',
    businessType,
  };
}

function buildProductTemplate(category, subCategory, index) {
  const basePrice = CATEGORY_BASE_PRICE[category.slug] || 49;
  const unit = category.slug === 'su-bayi' ? 'paket' : category.slug === 'cicekci' ? 'adet' : 'adet';

  return {
    name: `${subCategory.name} Demo`,
    description: `${category.name} kategorisinde ${subCategory.name} icin demo urun`,
    price: basePrice + index * 7,
    stock: Math.max(8, 30 - index),
    unit,
  };
}

async function ensureVendorUser(seed) {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  let user = await prisma.user.findUnique({
    where: { email: seed.email },
    include: { vendorProfile: true },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        name: seed.name,
        email: seed.email,
        passwordHash,
        phone: seed.phone,
        role: 'VENDOR',
        isActive: true,
      },
      include: { vendorProfile: true },
    });
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: seed.name,
        phone: seed.phone,
        role: 'VENDOR',
        isActive: true,
      },
      include: { vendorProfile: true },
    });
  }

  if (!user.vendorProfile) {
    user.vendorProfile = await prisma.vendorProfile.create({
      data: {
        userId: user.id,
        shopName: seed.shopName,
        iban: seed.iban,
        bankName: seed.bankName,
        status: 'APPROVED',
        businessType: seed.businessType,
        address: ADDRESS,
        country: 'Turkiye',
        city: CITY,
        district: DISTRICT,
        neighborhood: NEIGHBORHOOD,
        addressLine: ADDRESS_LINE,
        latitude: LATITUDE,
        longitude: LONGITUDE,
        openingTime: '08:00',
        closingTime: '22:00',
        preparationMinutes: 15,
        deliveryMinutes: 35,
        minimumOrderAmount: 100,
        flatDeliveryFee: 25,
        freeOverAmount: 250,
        deliveryMode: 'SELLER',
        isActive: true,
      },
    });
  }

  return user;
}

async function upsertVendorProfile(vendorProfileId, category, seed) {
  return prisma.vendorProfile.update({
    where: { id: vendorProfileId },
    data: {
      status: 'APPROVED',
      isActive: true,
      categoryId: category.id,
      businessType: seed.businessType,
      shopName: seed.shopName,
      iban: seed.iban,
      bankName: seed.bankName,
      address: ADDRESS,
      country: 'Turkiye',
      city: CITY,
      district: DISTRICT,
      neighborhood: NEIGHBORHOOD,
      addressLine: ADDRESS_LINE,
      latitude: LATITUDE,
      longitude: LONGITUDE,
      openingTime: '08:00',
      closingTime: '22:00',
      preparationMinutes: 15,
      deliveryMinutes: 35,
      minimumOrderAmount: 100,
      flatDeliveryFee: 25,
      freeOverAmount: 250,
      deliveryMode: 'SELLER',
    },
  });
}

async function upsertProducts(vendorProfileId, category) {
  const createdProducts = [];

  for (const [index, subCategory] of category.subCategories.entries()) {
    const template = buildProductTemplate(category, subCategory, index);
    const slug = slugify(`${category.slug}-${subCategory.slug}-demo`);

    const product = await prisma.product.upsert({
      where: {
        vendorId_slug: {
          vendorId: vendorProfileId,
          slug,
        },
      },
      update: {
        categoryId: category.id,
        subCategoryId: subCategory.id,
        name: template.name,
        description: template.description,
        price: template.price,
        stock: template.stock,
        unit: template.unit,
        isActive: true,
        approvalStatus: 'APPROVED',
      },
      create: {
        vendorId: vendorProfileId,
        categoryId: category.id,
        subCategoryId: subCategory.id,
        name: template.name,
        slug,
        description: template.description,
        price: template.price,
        stock: template.stock,
        unit: template.unit,
        isActive: true,
        approvalStatus: 'APPROVED',
      },
    });

    await prisma.sellerProduct.upsert({
      where: {
        sellerId_productId: {
          sellerId: vendorProfileId,
          productId: product.id,
        },
      },
      update: {
        price: Number(product.price || 0),
      },
      create: {
        sellerId: vendorProfileId,
        productId: product.id,
        price: Number(product.price || 0),
      },
    });

    createdProducts.push({
      id: product.id,
      slug: subCategory.slug,
      name: product.name,
      subCategoryName: subCategory.name,
    });
  }

  return createdProducts;
}

async function cleanupUnexpectedDemoVendors() {
  const desiredEmails = new Set(MAIN_CATEGORY_SLUGS.map((slug) => `vendor-${slug}@demo.com`));
  const demoUsers = await prisma.user.findMany({
    where: {
      email: {
        startsWith: 'vendor-',
        endsWith: '@demo.com',
      },
    },
    select: {
      id: true,
      email: true,
    },
  });

  const extraUserIds = demoUsers.filter((user) => !desiredEmails.has(user.email)).map((user) => user.id);

  if (!extraUserIds.length) {
    return 0;
  }

  const deleted = await prisma.user.deleteMany({
    where: {
      id: { in: extraUserIds },
    },
  });

  return deleted.count;
}

async function main() {
  const cleanedVendorCount = await cleanupUnexpectedDemoVendors();

  const categories = await prisma.category.findMany({
    where: {
      vendorId: null,
      isActive: true,
      slug: { in: MAIN_CATEGORY_SLUGS },
    },
    include: {
      subCategories: {
        where: { isActive: true },
        orderBy: { name: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  });

  if (!categories.length) {
    throw new Error('No active base categories found. Run base seed first.');
  }

  const summary = [];

  for (const [index, category] of categories.entries()) {
    const seed = buildVendorSeed(category, index);
    const user = await ensureVendorUser(seed);
    const vendorProfile = await upsertVendorProfile(user.vendorProfile.id, category, seed);
    const products = await upsertProducts(vendorProfile.id, category);

    summary.push({
      category: category.name,
      categorySlug: category.slug,
      email: seed.email,
      password: DEFAULT_PASSWORD,
      vendorProfileId: vendorProfile.id,
      shopName: seed.shopName,
      neighborhood: NEIGHBORHOOD,
      productCount: products.length,
    });
  }

  console.log(
    JSON.stringify(
      {
        success: true,
        cleanedVendorCount,
        location: {
          city: CITY,
          district: DISTRICT,
          neighborhood: NEIGHBORHOOD,
        },
        vendorCount: summary.length,
        vendors: summary,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error('create_all_main_category_vendors failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });