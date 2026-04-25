const path = require('path');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const prisma = new PrismaClient();

const TARGET_SHOPS = ['Demo Firin Ornek', 'Demo Pastane Ornek'];

async function main() {
  const vendors = await prisma.vendorProfile.findMany({
    where: {
      shopName: { in: TARGET_SHOPS },
    },
    orderBy: { shopName: 'asc' },
    select: {
      shopName: true,
      businessType: true,
      category: {
        select: {
          name: true,
          slug: true,
          subCategories: {
            where: { isActive: true },
            orderBy: { name: 'asc' },
            select: { name: true, slug: true },
          },
        },
      },
      products: {
        where: {
          isActive: true,
          approvalStatus: 'APPROVED',
        },
        orderBy: { name: 'asc' },
        select: {
          name: true,
          slug: true,
          subCategory: {
            select: {
              name: true,
              slug: true,
            },
          },
        },
      },
    },
  });

  const summary = vendors.map((vendor) => ({
    shopName: vendor.shopName,
    businessType: vendor.businessType,
    category: vendor.category,
    productCount: vendor.products.length,
    products: vendor.products,
  }));

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error('VERIFY_FIRIN_PASTANE_DEMO_FAILED');
    console.error(error?.stack || String(error));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });