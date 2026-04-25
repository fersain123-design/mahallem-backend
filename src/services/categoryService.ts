import prisma from '../config/db';
import { AppError } from '../middleware/errorHandler';
import { normalizeStoreType } from '../config/storeCategories';
import { ensureVendorPrimaryCategory } from './subcategoryService';

const SPECIAL_CATEGORY_NAME = 'Ozel Urunler';
const SPECIAL_CATEGORY_SLUG = 'ozel-urunler';

const slugify = (input: string) =>
  String(input || '')
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

const mapCategoryRecord = (category: any) => ({
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
        .filter((sub: any) => Boolean(sub?.isActive))
        .map((sub: any) => ({ id: sub.id, name: sub.name, slug: sub.slug }))
    : [],
});

export const upsertSpecialCategory = async () => {
  return prisma.category.upsert({
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

export const getVendorCategoryAccess = async (userId: string) => {
  const vendor = await prisma.vendorProfile.findUnique({
    where: { userId },
    select: { id: true, businessType: true },
  });

  if (!vendor) {
    throw new AppError(404, 'Vendor profile not found');
  }

  const storeType = normalizeStoreType(vendor.businessType);

  return {
    vendorId: vendor.id,
    rawStoreType: vendor.businessType,
    storeType,
    isVendorManaged: true,
  };
};

export const listCategoriesForVendor = async (userId: string) => {
  const access = await getVendorCategoryAccess(userId);

  await ensureVendorPrimaryCategory({
    id: access.vendorId,
    businessType: access.rawStoreType,
  });

  const categories = await prisma.category.findMany({
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

export const resolveCategoryForVendor = async (vendor: { id: string; businessType: string }, data: any, required: boolean) => {
  const storeType = normalizeStoreType(vendor.businessType);
  const rawCategoryId = String(data.categoryId || '').trim();
  const rawCategoryName = String(data.categoryName || '').trim();

  if (rawCategoryId === SPECIAL_CATEGORY_SLUG || slugify(rawCategoryName) === SPECIAL_CATEGORY_SLUG) {
    return upsertSpecialCategory();
  }

  const whereBase = { vendorId: vendor.id, isCustom: true };

  if (rawCategoryId) {
    const category = await prisma.category.findFirst({
      where: {
        ...whereBase,
        OR: [{ id: rawCategoryId }, { slug: rawCategoryId }],
      },
    });
    if (category) return category;
    throw new AppError(404, 'Category not found for this vendor');
  }

  if (rawCategoryName) {
    const category = await prisma.category.findFirst({
      where: {
        ...whereBase,
        name: rawCategoryName,
      },
    });
    if (category) return category;

    return prisma.category.create({
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
    throw new AppError(400, 'Category is required');
  }

  return undefined;
};

export const createVendorCategory = async (userId: string, data: any) => {
  const access = await getVendorCategoryAccess(userId);

  const baseSlug = slugify(data.name);
  const existing = await prisma.category.findFirst({
    where: { vendorId: access.vendorId, isCustom: true, name: String(data.name).trim() },
    select: { id: true },
  });
  if (existing) {
    throw new AppError(400, 'Category with this name already exists');
  }

  const category = await prisma.category.create({
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

export const updateVendorCategory = async (categoryId: string, userId: string, data: any) => {
  const access = await getVendorCategoryAccess(userId);

  const existing = await prisma.category.findFirst({
    where: { id: categoryId, vendorId: access.vendorId, isCustom: true },
  });
  if (!existing) {
    throw new AppError(404, 'Category not found');
  }

  const nextName = typeof data.name === 'string' ? String(data.name).trim() : existing.name;
  const updated = await prisma.category.update({
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

export const deleteVendorCategory = async (categoryId: string, userId: string) => {
  const access = await getVendorCategoryAccess(userId);

  const existing = await prisma.category.findFirst({
    where: { id: categoryId, vendorId: access.vendorId, isCustom: true },
    include: { products: { select: { id: true } } },
  });
  if (!existing) {
    throw new AppError(404, 'Category not found');
  }
  if (existing.products.length > 0) {
    throw new AppError(400, 'Move or delete products in this category before deleting it');
  }

  const replacement = await prisma.category.findFirst({
    where: {
      vendorId: access.vendorId,
      isActive: true,
      id: { not: categoryId },
    },
    select: { id: true },
    orderBy: { name: 'asc' },
  });

  const vendor = await (prisma as any).vendorProfile.findUnique({
    where: { id: access.vendorId },
    select: { categoryId: true },
  });

  if (String(vendor?.categoryId || '').trim() === String(categoryId)) {
    await (prisma as any).vendorProfile.update({
      where: { id: access.vendorId },
      data: { categoryId: replacement?.id || null },
    });
  }

  await prisma.category.delete({ where: { id: categoryId } });
  return { id: categoryId, deleted: true };
};