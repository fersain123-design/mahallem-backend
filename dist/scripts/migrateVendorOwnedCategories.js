"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("../config/env");
const db_1 = __importDefault(require("../config/db"));
const subcategoryService_1 = require("../services/subcategoryService");
const normalize = (value) => String(value || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/[^a-z0-9]+/g, '-');
const toMapKey = (value) => normalize(String(value || ''));
async function main() {
    const dryRun = process.argv.includes('--dry-run');
    const vendors = await db_1.default.vendorProfile.findMany({
        select: {
            id: true,
            businessType: true,
            categoryId: true,
        },
        orderBy: { id: 'asc' },
    });
    let scannedProducts = 0;
    let updatedProducts = 0;
    let fallbackCategoryCount = 0;
    let fallbackSubCategoryCount = 0;
    for (const vendor of vendors) {
        const primaryCategory = await (0, subcategoryService_1.ensureVendorPrimaryCategory)({
            id: vendor.id,
            businessType: String(vendor.businessType || ''),
            categoryId: vendor.categoryId,
        });
        const vendorCategories = await db_1.default.category.findMany({
            where: {
                vendorId: vendor.id,
                isActive: true,
            },
            include: {
                subCategories: {
                    where: { isActive: true },
                    orderBy: { name: 'asc' },
                },
            },
            orderBy: { name: 'asc' },
        });
        const categoryByName = new Map();
        const categoryBySuffixSlug = new Map();
        for (const category of vendorCategories) {
            categoryByName.set(toMapKey(category.name), category);
            const slug = String(category.slug || '');
            const suffix = slug.includes(`vendor-${vendor.id}-`)
                ? slug.replace(`vendor-${vendor.id}-`, '')
                : slug;
            categoryBySuffixSlug.set(toMapKey(suffix), category);
        }
        const products = await db_1.default.product.findMany({
            where: { vendorId: vendor.id },
            include: {
                category: { select: { id: true, name: true, slug: true, vendorId: true } },
                subCategory: { select: { id: true, name: true, slug: true, categoryId: true } },
            },
            orderBy: { createdAt: 'asc' },
        });
        scannedProducts += products.length;
        for (const product of products) {
            const currentCategory = product.category;
            const currentSubCategory = product.subCategory;
            let targetCategory = currentCategory && String(currentCategory.vendorId || '') === vendor.id
                ? currentCategory
                : undefined;
            if (!targetCategory && currentCategory) {
                targetCategory = categoryByName.get(toMapKey(currentCategory.name));
            }
            if (!targetCategory && currentCategory) {
                targetCategory = categoryBySuffixSlug.get(toMapKey(currentCategory.slug));
            }
            if (!targetCategory && primaryCategory) {
                targetCategory = await db_1.default.category.findUnique({ where: { id: primaryCategory.id } }) || undefined;
                fallbackCategoryCount += 1;
            }
            if (!targetCategory) {
                continue;
            }
            const targetSubCategories = await db_1.default.subCategory.findMany({
                where: { categoryId: targetCategory.id, isActive: true },
                orderBy: { name: 'asc' },
            });
            const subBySlug = new Map();
            const subByName = new Map();
            for (const sub of targetSubCategories) {
                subBySlug.set(toMapKey(sub.slug), sub);
                subByName.set(toMapKey(sub.name), sub);
            }
            let targetSubCategory = currentSubCategory && String(currentSubCategory.categoryId || '') === targetCategory.id
                ? currentSubCategory
                : undefined;
            if (!targetSubCategory && currentSubCategory) {
                targetSubCategory =
                    subBySlug.get(toMapKey(currentSubCategory.slug)) ||
                        subByName.get(toMapKey(currentSubCategory.name));
            }
            if (!targetSubCategory) {
                targetSubCategory = subBySlug.get('diger') || targetSubCategories[0] || null;
                fallbackSubCategoryCount += 1;
            }
            const needsUpdate = String(product.categoryId || '') !== String(targetCategory.id || '') ||
                String(product.subCategoryId || '') !== String(targetSubCategory?.id || '');
            if (!needsUpdate) {
                continue;
            }
            if (!dryRun) {
                await db_1.default.product.update({
                    where: { id: product.id },
                    data: {
                        categoryId: String(targetCategory.id),
                        subCategoryId: targetSubCategory ? String(targetSubCategory.id) : null,
                    },
                });
            }
            updatedProducts += 1;
        }
    }
    const output = {
        dryRun,
        vendorsScanned: vendors.length,
        productsScanned: scannedProducts,
        productsUpdated: updatedProducts,
        categoryFallbackCount: fallbackCategoryCount,
        subCategoryFallbackCount: fallbackSubCategoryCount,
    };
    console.log(JSON.stringify(output, null, 2));
}
main()
    .catch((error) => {
    console.error('MIGRATE_VENDOR_OWNED_CATEGORIES_FAILED');
    console.error(error?.stack || String(error));
    process.exit(1);
})
    .finally(async () => {
    await db_1.default.$disconnect();
});
