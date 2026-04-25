const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const prisma = new PrismaClient();

function normalize(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildTokens(value) {
  return new Set(normalize(value).split(' ').filter(Boolean));
}

function scoreSubCategory(productName, subCategory) {
  const productText = normalize(productName);
  const slugText = normalize(subCategory.slug);
  const nameText = normalize(subCategory.name);

  if (productText.includes(nameText)) return 100;
  if (productText.includes(slugText)) return 95;

  const productTokens = buildTokens(productName);
  const subTokens = new Set([...buildTokens(subCategory.name), ...buildTokens(subCategory.slug)]);
  let overlap = 0;
  for (const token of subTokens) {
    if (productTokens.has(token)) overlap += 1;
  }
  return overlap;
}

async function main() {
  const products = await prisma.product.findMany({
    where: {
      subCategoryId: null,
    },
    include: {
      category: {
        include: {
          subCategories: {
            where: { isActive: true },
            orderBy: { name: 'asc' },
          },
        },
      },
      vendor: {
        include: {
          user: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  const reassigned = [];
  const unresolved = [];

  for (const product of products) {
    const subCategories = product.category?.subCategories || [];
    let best = null;
    let bestScore = 0;

    for (const subCategory of subCategories) {
      const score = scoreSubCategory(product.name, subCategory);
      if (score > bestScore) {
        best = subCategory;
        bestScore = score;
      }
    }

    if (!best || bestScore <= 0) {
      unresolved.push({
        productId: product.id,
        productName: product.name,
        categorySlug: product.category?.slug || null,
        email: product.vendor?.user?.email || null,
      });
      continue;
    }

    await prisma.product.update({
      where: { id: product.id },
      data: { subCategoryId: best.id },
    });

    reassigned.push({
      productId: product.id,
      productName: product.name,
      categorySlug: product.category?.slug || null,
      subCategorySlug: best.slug,
      email: product.vendor?.user?.email || null,
    });
  }

  console.log(
    JSON.stringify(
      {
        totalNullProducts: products.length,
        reassignedCount: reassigned.length,
        unresolvedCount: unresolved.length,
        reassigned,
        unresolved,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error('reassign_null_subcategories failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });