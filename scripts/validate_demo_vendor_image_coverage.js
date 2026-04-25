const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const prisma = new PrismaClient();

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u');
}

function toCategoryKey(category) {
  const normalized = normalizeKey(category);
  return normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function toStoreScopeKey(storeScope) {
  const normalized = normalizeKey(String(storeScope || ''));
  if (!normalized) return '';
  if (normalized.includes('pastane') || normalized.includes('firin')) return 'pastane';
  if (normalized.includes('kafe') || normalized.includes('kahve')) return 'kafe';
  if (normalized.includes('kasap')) return 'kasap';
  if (normalized.includes('balik')) return 'balikci';
  if (normalized.includes('gunluk') || normalized.includes('ihtiyac')) return 'ev-gunluk-ihtiyac';
  if (normalized.includes('kuruyemis')) return 'kuruyemisci';
  if (normalized.includes('petshop') || normalized.includes('pet')) return 'petshop';
  if (normalized.includes('su bayi') || normalized.includes('su-bayi') || normalized === 'su') return 'su-bayi';
  if (normalized.includes('sarkuteri')) return 'sarkuteri';
  if (normalized.includes('tatlici') || normalized.includes('tatli')) return 'tatlici';
  if (normalized.includes('aktar')) return 'aktar';
  if (normalized.includes('cicek')) return 'cicekci';
  if (normalized.includes('bufe') || normalized.includes('atistirmalik bufe')) return 'bufe';
  return normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function main() {
  const mappingFile = path.join(__dirname, '..', '..', 'musteribir-main', 'frontend', 'src', 'config', 'vendorCategoryImages.ts');
  const mappingText = fs.readFileSync(mappingFile, 'utf8');
  const mappingKeys = new Set([...mappingText.matchAll(/'([^']+)'\s*:/g)].map((match) => match[1]));

  const vendors = await prisma.vendorProfile.findMany({
    where: {
      user: {
        email: {
          startsWith: 'vendor-',
          endsWith: '@demo.com',
        },
      },
    },
    include: {
      user: true,
      products: {
        where: { isActive: true },
        include: { subCategory: true },
        orderBy: { name: 'asc' },
      },
    },
    orderBy: { shopName: 'asc' },
  });

  const missing = [];
  const covered = [];

  for (const vendor of vendors) {
    const storeScopeKey = toStoreScopeKey(vendor.businessType);
    for (const product of vendor.products) {
      const subCategory = product.subCategory;
      if (!subCategory?.slug) {
        missing.push({
          email: vendor.user.email,
          shopName: vendor.shopName,
          productName: product.name,
          reason: 'missing-subcategory',
        });
        continue;
      }

      const categoryKey = toCategoryKey(subCategory.slug);
      const scopedKey = storeScopeKey ? `global:${storeScopeKey}:${categoryKey}` : '';
      const globalKey = `global:${categoryKey}`;
      if (scopedKey && mappingKeys.has(scopedKey)) {
        covered.push({ email: vendor.user.email, productName: product.name, imageKey: scopedKey });
        continue;
      }
      if (mappingKeys.has(globalKey)) {
        covered.push({ email: vendor.user.email, productName: product.name, imageKey: globalKey });
        continue;
      }
      missing.push({
        email: vendor.user.email,
        shopName: vendor.shopName,
        productName: product.name,
        subCategorySlug: subCategory.slug,
        expectedScopedKey: scopedKey || null,
        expectedGlobalKey: globalKey,
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        vendorCount: vendors.length,
        coveredCount: covered.length,
        missingCount: missing.length,
        missing,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error('validate_demo_vendor_image_coverage failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });