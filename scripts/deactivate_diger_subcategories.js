const path = require('path');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const prisma = new PrismaClient();

async function main() {
  const digerRows = await prisma.subCategory.findMany({
    where: {
      slug: 'diger',
      isActive: true,
    },
    select: { id: true },
  });

  const ids = digerRows.map((row) => row.id);

  if (!ids.length) {
    console.log(JSON.stringify({ deactivatedSubCategories: 0, productsReset: 0 }, null, 2));
    return;
  }

  const updated = await prisma.subCategory.updateMany({
    where: {
      id: { in: ids },
    },
    data: {
      isActive: false,
    },
  });

  const products = await prisma.product.updateMany({
    where: {
      subCategoryId: { in: ids },
    },
    data: {
      subCategoryId: null,
    },
  });

  console.log(
    JSON.stringify(
      {
        deactivatedSubCategories: updated.count,
        productsReset: products.count,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error('deactivate_diger_subcategories failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });