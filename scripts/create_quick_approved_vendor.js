const path = require('path');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const prisma = new PrismaClient();

const EMAIL = process.env.TEST_VENDOR_EMAIL || 'test@vendor.com';
const PASSWORD = process.env.TEST_VENDOR_PASSWORD || '123456';
const NAME = process.env.TEST_VENDOR_NAME || 'Test Vendor';
const PHONE = process.env.TEST_VENDOR_PHONE || '5551234567';
const SHOP_NAME = process.env.TEST_VENDOR_SHOP_NAME || 'Test Market Manav';
const IBAN = process.env.TEST_VENDOR_IBAN || 'TR000000000000000000009999';
const BANK = process.env.TEST_VENDOR_BANK || 'Demo Bank';

const PRIMARY_CATEGORY_SLUG = (process.env.TEST_VENDOR_PRIMARY_CATEGORY || 'market').toLowerCase();
const EXTRA_CATEGORY_SLUG = (process.env.TEST_VENDOR_EXTRA_CATEGORY || 'manav').toLowerCase();

const DEFAULT_LOCATION = {
  address: 'Mersin / Tarsus / Gazipasa Mahallesi',
  country: 'Turkiye',
  city: 'Mersin',
  district: 'Tarsus',
  neighborhood: 'Gazipasa',
  addressLine: 'Gazipasa Mahallesi Demo Cad. No: 1',
  latitude: 36.9109,
  longitude: 34.8619,
};

function fallbackCategoryName(slug) {
  const map = {
    market: 'Market',
    manav: 'Manav',
  };
  return map[slug] || slug.charAt(0).toUpperCase() + slug.slice(1);
}

function vendorCategorySlug(vendorId, slug) {
  return `vendor-${vendorId}-${slug}`;
}

async function ensureBaseCategory(slug) {
  let category = await prisma.category.findFirst({
    where: { slug, vendorId: null },
    include: { subCategories: { where: { isActive: true }, orderBy: { name: 'asc' } } },
  });

  if (!category) {
    category = await prisma.category.create({
      data: {
        name: fallbackCategoryName(slug),
        slug,
        storeType: slug,
        icon: 'shape-outline',
        image: 'market.jpg',
        isCustom: false,
        isActive: true,
      },
      include: { subCategories: { where: { isActive: true }, orderBy: { name: 'asc' } } },
    });
  }

  if (!category.subCategories.length) {
    const genericSlug = `${slug}-genel`;
    await prisma.subCategory.upsert({
      where: {
        categoryId_slug: {
          categoryId: category.id,
          slug: genericSlug,
        },
      },
      update: { name: `${fallbackCategoryName(slug)} Genel`, isActive: true },
      create: {
        categoryId: category.id,
        name: `${fallbackCategoryName(slug)} Genel`,
        slug: genericSlug,
        isActive: true,
      },
    });

    category = await prisma.category.findUnique({
      where: { id: category.id },
      include: { subCategories: { where: { isActive: true }, orderBy: { name: 'asc' } } },
    });
  }

  return category;
}

async function ensureVendorOwnedCategory(vendorId, baseCategory, slug) {
  const targetSlug = vendorCategorySlug(vendorId, slug);

  let category = await prisma.category.findUnique({
    where: { slug: targetSlug },
    include: { subCategories: { where: { isActive: true }, orderBy: { name: 'asc' } } },
  });

  const baseName = baseCategory?.name || fallbackCategoryName(slug);

  if (!category) {
    category = await prisma.category.create({
      data: {
        vendorId,
        storeType: slug,
        name: baseName,
        slug: targetSlug,
        icon: baseCategory?.icon || 'shape-outline',
        image: baseCategory?.image || 'market.jpg',
        description: baseCategory?.description || null,
        isCustom: true,
        isActive: true,
      },
      include: { subCategories: { where: { isActive: true }, orderBy: { name: 'asc' } } },
    });
  } else {
    category = await prisma.category.update({
      where: { id: category.id },
      data: {
        vendorId,
        storeType: slug,
        name: baseName,
        icon: baseCategory?.icon || 'shape-outline',
        image: baseCategory?.image || 'market.jpg',
        description: baseCategory?.description || null,
        isCustom: true,
        isActive: true,
      },
      include: { subCategories: { where: { isActive: true }, orderBy: { name: 'asc' } } },
    });
  }

  const sourceSubCategories = Array.isArray(baseCategory?.subCategories) ? baseCategory.subCategories : [];
  const syncedSlugs = [];

  for (const sub of sourceSubCategories) {
    syncedSlugs.push(sub.slug);
    await prisma.subCategory.upsert({
      where: {
        categoryId_slug: {
          categoryId: category.id,
          slug: sub.slug,
        },
      },
      update: {
        name: sub.name,
        isActive: true,
      },
      create: {
        categoryId: category.id,
        name: sub.name,
        slug: sub.slug,
        isActive: true,
      },
    });
  }

  if (!syncedSlugs.length) {
    const genericSlug = `${slug}-genel`;
    syncedSlugs.push(genericSlug);
    await prisma.subCategory.upsert({
      where: {
        categoryId_slug: {
          categoryId: category.id,
          slug: genericSlug,
        },
      },
      update: {
        name: `${fallbackCategoryName(slug)} Genel`,
        isActive: true,
      },
      create: {
        categoryId: category.id,
        name: `${fallbackCategoryName(slug)} Genel`,
        slug: genericSlug,
        isActive: true,
      },
    });
  }

  await prisma.subCategory.updateMany({
    where: {
      categoryId: category.id,
      slug: { notIn: syncedSlugs },
      isActive: true,
    },
    data: { isActive: false },
  });

  return prisma.category.findUnique({
    where: { id: category.id },
    include: { subCategories: { where: { isActive: true }, orderBy: { name: 'asc' } } },
  });
}

async function upsertUser() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const existing = await prisma.user.findUnique({
    where: { email: EMAIL },
    include: { vendorProfile: true },
  });

  if (!existing) {
    return prisma.user.create({
      data: {
        name: NAME,
        email: EMAIL,
        passwordHash,
        phone: PHONE,
        role: 'VENDOR',
        isActive: true,
      },
      include: { vendorProfile: true },
    });
  }

  return prisma.user.update({
    where: { id: existing.id },
    data: {
      name: NAME,
      phone: PHONE,
      role: 'VENDOR',
      isActive: true,
      passwordHash,
    },
    include: { vendorProfile: true },
  });
}

async function upsertVendorProfile(userId, categoryId) {
  const existing = await prisma.vendorProfile.findUnique({
    where: { userId },
  });

  const payload = {
    shopName: SHOP_NAME,
    iban: IBAN,
    bankName: BANK,
    status: 'APPROVED',
    businessType: PRIMARY_CATEGORY_SLUG,
    deliveryCoverage: 'SELF',
    deliveryMode: 'SELLER',
    openingTime: '08:00',
    closingTime: '22:00',
    preparationMinutes: 15,
    deliveryMinutes: 35,
    minimumOrderAmount: 100,
    flatDeliveryFee: 25,
    freeOverAmount: 250,
    isActive: true,
    categoryId,
    ...DEFAULT_LOCATION,
  };

  if (!existing) {
    return prisma.vendorProfile.create({
      data: {
        userId,
        ...payload,
      },
    });
  }

  return prisma.vendorProfile.update({
    where: { id: existing.id },
    data: payload,
  });
}

async function main() {
  const primaryBase = await ensureBaseCategory(PRIMARY_CATEGORY_SLUG);
  const extraBase = await ensureBaseCategory(EXTRA_CATEGORY_SLUG);

  const user = await upsertUser();
  let vendorProfile = await prisma.vendorProfile.findUnique({ where: { userId: user.id } });

  if (!vendorProfile) {
    vendorProfile = await upsertVendorProfile(user.id, null);
  }

  const vendorPrimaryCategory = await ensureVendorOwnedCategory(
    vendorProfile.id,
    primaryBase,
    PRIMARY_CATEGORY_SLUG
  );

  await ensureVendorOwnedCategory(vendorProfile.id, extraBase, EXTRA_CATEGORY_SLUG);

  vendorProfile = await upsertVendorProfile(user.id, vendorPrimaryCategory.id);

  console.log(
    JSON.stringify(
      {
        ok: true,
        email: EMAIL,
        password: PASSWORD,
        vendorId: vendorProfile.id,
        status: vendorProfile.status,
        primaryCategory: PRIMARY_CATEGORY_SLUG,
        extraCategory: EXTRA_CATEGORY_SLUG,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error('CREATE_QUICK_APPROVED_VENDOR_FAILED');
    console.error(error?.stack || String(error));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
