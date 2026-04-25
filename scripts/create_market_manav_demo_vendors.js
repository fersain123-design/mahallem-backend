const path = require('path');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = 'Vendor123!';
const DEFAULT_LOCATION = {
  address: 'Mersin / Tarsus / Gazi Paşa Mahallesi',
  country: 'Turkiye',
  city: 'Mersin',
  district: 'Tarsus',
  neighborhood: 'Gazi Paşa',
  addressLine: 'Gazi Paşa Mahallesi Demo Cad. No: 1',
  latitude: 36.9109,
  longitude: 34.8619,
};

const DEMO_VENDORS = [
  {
    businessType: 'market',
    categorySlug: 'market',
    email: 'market-sample@demo.com',
    phone: '5558100001',
    name: 'Demo Market Satici',
    shopName: 'Demo Market Ornek',
    iban: 'TR000000000000000000001001',
    bankName: 'Demo Bank',
  },
  {
    businessType: 'manav',
    categorySlug: 'manav',
    email: 'manav-sample@demo.com',
    phone: '5558100002',
    name: 'Demo Manav Satici',
    shopName: 'Demo Manav Ornek',
    iban: 'TR000000000000000000001002',
    bankName: 'Demo Bank',
  },
];

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

async function upsertUser(seed) {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const existing = await prisma.user.findUnique({
    where: { email: seed.email },
    include: { vendorProfile: true },
  });

  if (!existing) {
    return prisma.user.create({
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
  }

  return prisma.user.update({
    where: { id: existing.id },
    data: {
      name: seed.name,
      phone: seed.phone,
      role: 'VENDOR',
      isActive: true,
    },
    include: { vendorProfile: true },
  });
}

async function ensureVendorProfile(user, seed) {
  if (!user.vendorProfile) {
    return prisma.vendorProfile.create({
      data: {
        userId: user.id,
        shopName: seed.shopName,
        iban: seed.iban,
        bankName: seed.bankName,
        status: 'APPROVED',
        businessType: seed.businessType,
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
        ...DEFAULT_LOCATION,
      },
    });
  }

  return prisma.vendorProfile.update({
    where: { id: user.vendorProfile.id },
    data: {
      shopName: seed.shopName,
      iban: seed.iban,
      bankName: seed.bankName,
      status: 'APPROVED',
      businessType: seed.businessType,
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
      ...DEFAULT_LOCATION,
    },
  });
}

async function ensureVendorPrimaryCategory(vendorProfileId, seed, baseCategory) {
  const vendorCategorySlug = `vendor-${vendorProfileId}-${seed.categorySlug}`;
  let vendorCategory = await prisma.category.findUnique({
    where: { slug: vendorCategorySlug },
    include: {
      subCategories: {
        where: { isActive: true },
      },
    },
  });

  if (!vendorCategory) {
    vendorCategory = await prisma.category.create({
      data: {
        vendorId: vendorProfileId,
        storeType: seed.businessType,
        name: baseCategory.name,
        slug: vendorCategorySlug,
        icon: baseCategory.icon || 'shape-outline',
        image: baseCategory.image || 'market.jpg',
        description: baseCategory.description || null,
        isCustom: true,
        isActive: true,
      },
      include: {
        subCategories: {
          where: { isActive: true },
        },
      },
    });
  } else {
    vendorCategory = await prisma.category.update({
      where: { id: vendorCategory.id },
      data: {
        vendorId: vendorProfileId,
        storeType: seed.businessType,
        name: baseCategory.name,
        icon: baseCategory.icon || 'shape-outline',
        image: baseCategory.image || 'market.jpg',
        description: baseCategory.description || null,
        isCustom: true,
        isActive: true,
      },
      include: {
        subCategories: {
          where: { isActive: true },
        },
      },
    });
  }

  for (const subCategory of baseCategory.subCategories) {
    await prisma.subCategory.upsert({
      where: {
        categoryId_slug: {
          categoryId: vendorCategory.id,
          slug: subCategory.slug,
        },
      },
      update: {
        name: subCategory.name,
        isActive: true,
      },
      create: {
        categoryId: vendorCategory.id,
        name: subCategory.name,
        slug: subCategory.slug,
        isActive: true,
      },
    });
  }

  await prisma.subCategory.updateMany({
    where: {
      categoryId: vendorCategory.id,
      slug: { notIn: baseCategory.subCategories.map((item) => item.slug) },
      isActive: true,
    },
    data: { isActive: false },
  });

  await prisma.vendorProfile.update({
    where: { id: vendorProfileId },
    data: { categoryId: vendorCategory.id },
  });

  return prisma.category.findUnique({
    where: { id: vendorCategory.id },
    include: {
      subCategories: {
        where: { isActive: true },
        orderBy: { name: 'asc' },
      },
    },
  });
}

function buildProductPayload(categoryName, subCategoryName, index) {
  return {
    name: `${subCategoryName} Ornek ${categoryName}`,
    description: `${categoryName} icin ${subCategoryName} alt kategorisinde demo urun`,
    price: 20 + index * 5,
    stock: 25,
    unit: 'adet',
  };
}

async function upsertProducts(vendorProfileId, vendorCategory) {
  const created = [];
  const activeSlugs = [];

  for (const [index, subCategory] of vendorCategory.subCategories.entries()) {
    const template = buildProductPayload(vendorCategory.name, subCategory.name, index);
    const slug = slugify(`${vendorCategory.slug}-${subCategory.slug}-ornek`);
    activeSlugs.push(slug);

    const product = await prisma.product.upsert({
      where: {
        vendorId_slug: {
          vendorId: vendorProfileId,
          slug,
        },
      },
      update: {
        categoryId: vendorCategory.id,
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
        categoryId: vendorCategory.id,
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

    created.push({
      productId: product.id,
      productName: product.name,
      subCategoryName: subCategory.name,
    });
  }

  await prisma.product.updateMany({
    where: {
      vendorId: vendorProfileId,
      categoryId: vendorCategory.id,
      slug: { notIn: activeSlugs },
      isActive: true,
    },
    data: {
      isActive: false,
    },
  });

  return created;
}

async function main() {
  const summary = [];

  for (const seed of DEMO_VENDORS) {
    const baseCategory = await prisma.category.findUnique({
      where: { slug: seed.categorySlug },
      include: {
        subCategories: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!baseCategory) {
      throw new Error(`Base category not found for slug: ${seed.categorySlug}`);
    }

    const user = await upsertUser(seed);
    const vendorProfile = await ensureVendorProfile(user, seed);
    const vendorCategory = await ensureVendorPrimaryCategory(vendorProfile.id, seed, baseCategory);
    const products = await upsertProducts(vendorProfile.id, vendorCategory);

    summary.push({
      businessType: seed.businessType,
      email: seed.email,
      password: DEFAULT_PASSWORD,
      vendorId: vendorProfile.id,
      categoryName: vendorCategory.name,
      subCategoryCount: vendorCategory.subCategories.length,
      productCount: products.length,
      products,
    });
  }

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error('CREATE_MARKET_MANAV_DEMO_VENDORS_FAILED');
    console.error(error?.stack || String(error));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });