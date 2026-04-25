"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteVendorCategory = exports.updateVendorCategory = exports.createVendorCategory = exports.resolveCategoryForVendor = exports.listCategoriesForVendor = exports.getVendorCategoryAccess = exports.upsertSpecialCategory = void 0;
const db_1 = __importDefault(require("../config/db"));
const errorHandler_1 = require("../middleware/errorHandler");
const storeCategories_1 = require("../config/storeCategories");
const subcategoryService_1 = require("./subcategoryService");
const SPECIAL_CATEGORY_NAME = 'Ozel Urunler';
const SPECIAL_CATEGORY_SLUG = 'ozel-urunler';
const slugify = (input) => String(input || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
const mapCategoryRecord = (category) => ({
    id: category.isCustom ? category.id : category.slug,
    dbId: category.id,
    name: category.name,
    slug: category.slug,
    icon: category.icon || 'shape-outline',
    image: category.image || 'market.jpg',
    description: category.description || '',
    isCustom: Boolean(category.isCustom),
    isActive: Boolean(category.isActive),
    storeType: category.storeType || null,
    subCategories: Array.isArray(category.subCategories)
        ? category.subCategories
            .filter((sub) => Boolean(sub?.isActive))
            .map((sub) => ({ id: sub.id, name: sub.name, slug: sub.slug }))
        : [],
});
const upsertSpecialCategory = async () => {
    return db_1.default.category.upsert({
        where: { slug: SPECIAL_CATEGORY_SLUG },
        update: {
            name: SPECIAL_CATEGORY_NAME,
            icon: 'sparkles',
            image: 'market.jpg',
            isCustom: false,
            isActive: true,
        },
        create: {
            name: SPECIAL_CATEGORY_NAME,
            slug: SPECIAL_CATEGORY_SLUG,
            icon: 'sparkles',
            image: 'market.jpg',
            isCustom: false,
            isActive: true,
        },
    });
};
exports.upsertSpecialCategory = upsertSpecialCategory;
const getVendorCategoryAccess = async (userId) => {
    const vendor = await db_1.default.vendorProfile.findUnique({
        where: { userId },
        select: { id: true, businessType: true },
    });
    if (!vendor) {
        throw new errorHandler_1.AppError(404, 'Vendor profile not found');
    }
    const storeType = (0, storeCategories_1.normalizeStoreType)(vendor.businessType);
    return {
        vendorId: vendor.id,
        rawStoreType: vendor.businessType,
        storeType,
        isVendorManaged: true,
    };
};
exports.getVendorCategoryAccess = getVendorCategoryAccess;
const listCategoriesForVendor = async (userId) => {
    const access = await (0, exports.getVendorCategoryAccess)(userId);
    await (0, subcategoryService_1.ensureVendorPrimaryCategory)({
        id: access.vendorId,
        businessType: access.rawStoreType,
    });
    const categories = await db_1.default.category.findMany({
        where: {
            vendorId: access.vendorId,
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
    return {
        storeType: access.storeType,
        isVendorManaged: true,
        categories: categories.map(mapCategoryRecord),
    };
};
exports.listCategoriesForVendor = listCategoriesForVendor;
const resolveCategoryForVendor = async (vendor, data, required) => {
    const storeType = (0, storeCategories_1.normalizeStoreType)(vendor.businessType);
    const rawCategoryId = String(data.categoryId || '').trim();
    const rawCategoryName = String(data.categoryName || '').trim();
    if (rawCategoryId === SPECIAL_CATEGORY_SLUG || slugify(rawCategoryName) === SPECIAL_CATEGORY_SLUG) {
        return (0, exports.upsertSpecialCategory)();
    }
    const whereBase = { vendorId: vendor.id, isCustom: true };
    if (rawCategoryId) {
        const category = await db_1.default.category.findFirst({
            where: {
                ...whereBase,
                OR: [{ id: rawCategoryId }, { slug: rawCategoryId }],
            },
        });
        if (category)
            return category;
        throw new errorHandler_1.AppError(404, 'Category not found for this vendor');
    }
    if (rawCategoryName) {
        const category = await db_1.default.category.findFirst({
            where: {
                ...whereBase,
                name: rawCategoryName,
            },
        });
        if (category)
            return category;
        return db_1.default.category.create({
            data: {
                vendorId: vendor.id,
                storeType,
                name: rawCategoryName,
                slug: `vendor-${vendor.id}-${slugify(rawCategoryName) || Date.now()}`,
                icon: 'shape-outline',
                image: 'market.jpg',
                description: null,
                isCustom: true,
                isActive: true,
            },
        });
    }
    if (required) {
        throw new errorHandler_1.AppError(400, 'Category is required');
    }
    return undefined;
};
exports.resolveCategoryForVendor = resolveCategoryForVendor;
const createVendorCategory = async (userId, data) => {
    const access = await (0, exports.getVendorCategoryAccess)(userId);
    const baseSlug = slugify(data.name);
    const existing = await db_1.default.category.findFirst({
        where: { vendorId: access.vendorId, isCustom: true, name: String(data.name).trim() },
        select: { id: true },
    });
    if (existing) {
        throw new errorHandler_1.AppError(400, 'Category with this name already exists');
    }
    const category = await db_1.default.category.create({
        data: {
            vendorId: access.vendorId,
            storeType: access.storeType,
            name: String(data.name).trim(),
            slug: `vendor-${access.vendorId}-${baseSlug || Date.now()}`,
            icon: String(data.icon || 'shape-outline').trim(),
            image: String(data.image || 'market.jpg').trim(),
            description: String(data.description || '').trim() || null,
            isCustom: true,
            isActive: true,
        },
        include: {
            subCategories: {
                where: { isActive: true },
                orderBy: { name: 'asc' },
            },
        },
    });
    return mapCategoryRecord(category);
};
exports.createVendorCategory = createVendorCategory;
const updateVendorCategory = async (categoryId, userId, data) => {
    const access = await (0, exports.getVendorCategoryAccess)(userId);
    const existing = await db_1.default.category.findFirst({
        where: { id: categoryId, vendorId: access.vendorId, isCustom: true },
    });
    if (!existing) {
        throw new errorHandler_1.AppError(404, 'Category not found');
    }
    const nextName = typeof data.name === 'string' ? String(data.name).trim() : existing.name;
    const updated = await db_1.default.category.update({
        where: { id: categoryId },
        data: {
            ...(typeof data.name === 'string' ? { name: nextName } : {}),
            ...(typeof data.icon === 'string' ? { icon: String(data.icon).trim() } : {}),
            ...(typeof data.image === 'string' ? { image: String(data.image).trim() } : {}),
            ...(typeof data.description !== 'undefined' ? { description: String(data.description || '').trim() || null } : {}),
            ...(typeof data.isActive === 'boolean' ? { isActive: data.isActive } : {}),
        },
        include: {
            subCategories: {
                where: { isActive: true },
                orderBy: { name: 'asc' },
            },
        },
    });
    return mapCategoryRecord(updated);
};
exports.updateVendorCategory = updateVendorCategory;
const deleteVendorCategory = async (categoryId, userId) => {
    const access = await (0, exports.getVendorCategoryAccess)(userId);
    const existing = await db_1.default.category.findFirst({
        where: { id: categoryId, vendorId: access.vendorId, isCustom: true },
        include: { products: { select: { id: true } } },
    });
    if (!existing) {
        throw new errorHandler_1.AppError(404, 'Category not found');
    }
    if (existing.products.length > 0) {
        throw new errorHandler_1.AppError(400, 'Move or delete products in this category before deleting it');
    }
    const replacement = await db_1.default.category.findFirst({
        where: {
            vendorId: access.vendorId,
            isActive: true,
            id: { not: categoryId },
        },
        select: { id: true },
        orderBy: { name: 'asc' },
    });
    const vendor = await db_1.default.vendorProfile.findUnique({
        where: { id: access.vendorId },
        select: { categoryId: true },
    });
    if (String(vendor?.categoryId || '').trim() === String(categoryId)) {
        await db_1.default.vendorProfile.update({
            where: { id: access.vendorId },
            data: { categoryId: replacement?.id || null },
        });
    }
    await db_1.default.category.delete({ where: { id: categoryId } });
    return { id: categoryId, deleted: true };
};
exports.deleteVendorCategory = deleteVendorCategory;
