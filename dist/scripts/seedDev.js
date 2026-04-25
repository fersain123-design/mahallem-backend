"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("../config/env");
const db_1 = __importDefault(require("../config/db"));
const authService_1 = require("../services/authService");
const subcategoryService_1 = require("../services/subcategoryService");
const seedUsers = [
    {
        name: 'Admin',
        email: 'admin@demo.com',
        password: 'Admin123!',
        role: 'ADMIN',
    },
    {
        name: 'Satıcı Demo',
        email: 'vendor@demo.com',
        password: 'Vendor123!',
        role: 'VENDOR',
    },
    {
        name: 'Müşteri Demo',
        email: 'customer@demo.com',
        password: 'Customer123!',
        role: 'CUSTOMER',
    },
];
async function main() {
    console.log('Seeding development data...');
    for (const user of seedUsers) {
        const existing = await db_1.default.user.findUnique({ where: { email: user.email } });
        if (existing) {
            console.log(`- user exists: ${user.email}`);
            continue;
        }
        await (0, authService_1.registerUser)({
            name: user.name,
            email: user.email,
            password: user.password,
            role: user.role,
        });
        console.log(`- created user: ${user.email} (${user.role})`);
    }
    await (0, subcategoryService_1.ensureBaseCategorySystem)();
    console.log('- base categories and subcategories ensured');
    const marketCategory = await db_1.default.category.findFirst({ where: { slug: 'market' } });
    const marketDefaultSubCategory = await db_1.default.subCategory.findFirst({
        where: {
            categoryId: marketCategory?.id,
            isActive: true,
        },
        orderBy: { name: 'asc' },
    });
    if (!marketCategory || !marketDefaultSubCategory) {
        throw new Error('Market category or active subcategory not found');
    }
    const vendorUser = await db_1.default.user.findUnique({
        where: { email: 'vendor@demo.com' },
        include: { vendorProfile: true },
    });
    if (!vendorUser?.vendorProfile) {
        throw new Error('Vendor profile not found for vendor@demo.com');
    }
    await db_1.default.vendorProfile.update({
        where: { id: vendorUser.vendorProfile.id },
        data: {
            status: 'APPROVED',
            categoryId: marketCategory.id,
            shopName: vendorUser.vendorProfile.shopName || 'Demo Manav',
            iban: vendorUser.vendorProfile.iban || 'TR000000000000000000000000',
            bankName: vendorUser.vendorProfile.bankName || 'Demo Bank',
            address: vendorUser.vendorProfile.address || 'İstanbul',
        },
    });
    console.log('- vendor approved');
    const existingProduct = await db_1.default.product.findFirst({
        where: { vendorId: vendorUser.vendorProfile.id },
    });
    const product = existingProduct ||
        (await db_1.default.product.create({
            data: {
                vendorId: vendorUser.vendorProfile.id,
                categoryId: marketCategory.id,
                subCategoryId: marketDefaultSubCategory.id,
                name: 'Elma',
                slug: 'elma',
                description: 'Kırmızı elma',
                price: 25,
                stock: 100,
                unit: 'kg',
                imageUrl: 'https://via.placeholder.com/400x300?text=Elma',
                isActive: true,
            },
        }));
    await db_1.default.sellerProduct.upsert({
        where: {
            sellerId_productId: {
                sellerId: vendorUser.vendorProfile.id,
                productId: product.id,
            },
        },
        update: {
            price: Number(product.price || 0),
        },
        create: {
            sellerId: vendorUser.vendorProfile.id,
            productId: product.id,
            price: Number(product.price || 0),
        },
    });
    if (!existingProduct)
        console.log('- created demo product');
    const customerUser = await db_1.default.user.findUnique({ where: { email: 'customer@demo.com' } });
    if (!customerUser)
        throw new Error('Customer not found');
    const address = (await db_1.default.customerAddress.findFirst({
        where: { userId: customerUser.id, isDefault: true },
    })) ||
        (await db_1.default.customerAddress.create({
            data: {
                userId: customerUser.id,
                title: 'Ev',
                fullName: 'Müşteri Demo',
                phone: '5555555555',
                country: 'Türkiye',
                city: 'İstanbul',
                district: 'Kadıköy',
                neighborhood: 'Merkez',
                addressLine: 'Demo Mah. Demo Sk. No: 1',
                isDefault: true,
            },
        }));
    const existingOrder = await db_1.default.order.findFirst({ where: { customerId: customerUser.id } });
    if (!existingOrder) {
        const settings = await db_1.default.settings.upsert({
            where: { id: 1 },
            create: { id: 1 },
            update: {},
        });
        const commissionRate = Number(settings?.commissionRate ?? 0);
        const rate = Number.isFinite(commissionRate) ? Math.min(Math.max(commissionRate, 0), 100) : 0;
        const gross = Number(product.price || 0);
        const commissionAmount = Number((gross * (rate / 100)).toFixed(2));
        const vendorNetAmount = Number((gross - commissionAmount).toFixed(2));
        const order = await db_1.default.order.create({
            data: {
                customerId: customerUser.id,
                shippingAddressId: address.id,
                totalPrice: product.price,
                status: 'PENDING',
                paymentStatus: 'PAID',
                items: {
                    create: [
                        {
                            productId: product.id,
                            vendorId: vendorUser.vendorProfile.id,
                            quantity: 1,
                            unitPrice: product.price,
                            subtotal: product.price,
                            commissionRateSnapshot: rate,
                            commissionAmount,
                            vendorNetAmount,
                        },
                    ],
                },
            },
        });
        console.log(`- created demo order: ${order.id}`);
    }
    // Ensure at least one payout exists so admin/seller payout screens can be tested.
    const existingPayout = await db_1.default.payout.findFirst({
        where: { vendorProfileId: vendorUser.vendorProfile.id },
    });
    if (!existingPayout) {
        const settings = await db_1.default.settings.upsert({
            where: { id: 1 },
            create: { id: 1 },
            update: {},
        });
        const orderWithItems = await db_1.default.order.findFirst({
            where: { customerId: customerUser.id },
            include: { items: true },
            orderBy: { createdAt: 'desc' },
        });
        const firstItem = orderWithItems?.items?.find((it) => it.vendorId === vendorUser.vendorProfile.id);
        if (orderWithItems && firstItem) {
            const periodEnd = new Date();
            const periodStart = new Date(periodEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
            const gross = Number(firstItem.subtotal || 0);
            const commissionRate = Number(settings?.commissionRate ?? 0);
            const rate = Number.isFinite(commissionRate) ? Math.min(Math.max(commissionRate, 0), 100) : 0;
            const amount = gross * (1 - rate / 100);
            const payout = await db_1.default.payout.create({
                data: {
                    vendorProfileId: vendorUser.vendorProfile.id,
                    periodStart,
                    periodEnd,
                    grossAmount: gross,
                    commissionAmount: Number((gross - amount).toFixed(2)),
                    amount,
                    status: 'PENDING',
                    items: {
                        create: [
                            {
                                orderId: orderWithItems.id,
                                orderItemId: firstItem.id,
                                amount,
                            },
                        ],
                    },
                },
            });
            console.log(`- created demo payout: ${payout.id}`);
        }
        else {
            console.log('- skipped payout seed (no order items found)');
        }
    }
    else {
        console.log('- payout exists');
    }
    console.log('Seed complete. Demo accounts:');
    console.log('- admin@demo.com / Admin123!');
    console.log('- vendor@demo.com / Vendor123!');
    console.log('- customer@demo.com / Customer123!');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await db_1.default.$disconnect();
});
