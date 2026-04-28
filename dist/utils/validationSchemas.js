"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateDeliveryFeeBandsSchema = exports.DeliveryFeeBandSchema = exports.RejectProductForPricingSchema = exports.ToggleProductActiveSchema = exports.ReviewVendorDocumentSchema = exports.DeactivateVendorSchema = exports.RejectVendorSchema = exports.ApproveVendorSchema = exports.CancelOrderSchema = exports.CreatePayoutRequestSchema = exports.UpdateOrderStatusSchema = exports.UpdateVendorCategorySchema = exports.CreateVendorCategorySchema = exports.LookupBarcodeSchema = exports.UpdateProductSchema = exports.CreateProductSchema = exports.UpdateBankAccountSchema = exports.CreateVendorViolationSchema = exports.AdminCampaignStatusSchema = exports.SellerCampaignSchema = exports.AdminNeighborhoodDeliverySettingSchema = exports.RequestDeliveryCoverageChangeSchema = exports.UpdateVendorDeliverySettingsSchema = exports.UpdateVendorProfileSchema = exports.ListSellerRatingsQuerySchema = exports.GetOrderSellerRatingQuerySchema = exports.UpdateSellerRatingSchema = exports.CreateSellerRatingSchema = exports.CreateProductReviewSchema = exports.CreateOrderSchema = exports.UpdateCartItemSchema = exports.AddToCartSchema = exports.AddressSchema = exports.UpdateProfileSchema = exports.ResetPasswordSchema = exports.VerifyOtpSchema = exports.ForgotPasswordSchema = exports.VerifyLoginOtpSchema = exports.RequestLoginOtpSchema = exports.LoginSchema = exports.RegisterSchema = void 0;
const zod_1 = require("zod");
const barcode_1 = require("./barcode");
// Auth Schemas
exports.RegisterSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Name must be at least 2 characters'),
    email: zod_1.z.string().email('Invalid email address'),
    phone: zod_1.z
        .string()
        .optional()
        .refine((value) => {
        if (value == null || String(value).trim() === '')
            return true;
        const digits = String(value).replace(/\D/g, '');
        return digits.length >= 10;
    }, { message: 'Invalid phone number' }),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
    role: zod_1.z.enum(['CUSTOMER', 'VENDOR', 'ADMIN']),
    businessType: zod_1.z.string().optional(),
    tcKimlik: zod_1.z
        .string()
        .optional()
        .refine((value) => {
        if (value == null || String(value).trim() === '')
            return true;
        return String(value).replace(/\D/g, '').length === 11;
    }, { message: 'TC Kimlik must be 11 digits' }),
    // Vendor delivery coverage (optional for backward compatibility)
    // SELF: "Teslimatı ben karşılayacağım"
    // PLATFORM: "Teslimat platform tarafından karşılanacak"
    deliveryCoverage: zod_1.z.enum(['SELF', 'PLATFORM']).optional(),
});
exports.LoginSchema = zod_1.z.object({
    email: zod_1.z
        .string()
        .min(1, 'Email or phone is required')
        .refine((value) => {
        const v = String(value || '').trim();
        if (!v)
            return false;
        if (v.includes('@'))
            return zod_1.z.string().email().safeParse(v).success;
        const digits = v.replace(/\D/g, '');
        return digits.length >= 10;
    }, { message: 'Invalid email address or phone number' }),
    password: zod_1.z.string().min(1, 'Password is required'),
});
exports.RequestLoginOtpSchema = zod_1.z.object({
    phone: zod_1.z
        .string()
        .min(1, 'Phone is required')
        .refine((value) => {
        const digits = String(value || '').replace(/\D/g, '');
        return digits.length >= 10;
    }, { message: 'Invalid phone number' }),
});
exports.VerifyLoginOtpSchema = zod_1.z.object({
    phone: zod_1.z
        .string()
        .min(1, 'Phone is required')
        .refine((value) => {
        const digits = String(value || '').replace(/\D/g, '');
        return digits.length >= 10;
    }, { message: 'Invalid phone number' }),
    otpCode: zod_1.z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
});
exports.ForgotPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
});
exports.VerifyOtpSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    otpCode: zod_1.z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
});
exports.ResetPasswordSchema = zod_1.z
    .object({
    email: zod_1.z.string().email('Invalid email address'),
    resetToken: zod_1.z.string().min(20, 'Invalid reset token'),
    newPassword: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
})
    .superRefine((val, ctx) => {
    if (val.newPassword !== val.confirmPassword) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ['confirmPassword'],
            message: 'Passwords do not match',
        });
    }
});
// Customer Schemas
exports.UpdateProfileSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).optional(),
    phone: zod_1.z.string().optional(),
});
exports.AddressSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, 'Title is required'),
    fullName: zod_1.z.string().min(2, 'Full name is required'),
    phone: zod_1.z.string().min(10, 'Valid phone number is required'),
    country: zod_1.z.string().min(1, 'Country is required'),
    city: zod_1.z.string().min(1, 'City is required'),
    district: zod_1.z.string().min(1, 'District is required'),
    neighborhood: zod_1.z.string().min(1, 'Neighborhood is required'),
    addressLine: zod_1.z.string().min(5, 'Address line is required'),
    latitude: zod_1.z.preprocess((v) => (v === null || v === undefined || v === '' ? undefined : v), zod_1.z.coerce.number().min(-90).max(90).optional()),
    longitude: zod_1.z.preprocess((v) => (v === null || v === undefined || v === '' ? undefined : v), zod_1.z.coerce.number().min(-180).max(180).optional()),
});
exports.AddToCartSchema = zod_1.z.object({
    productId: zod_1.z.string().cuid(),
    quantity: zod_1.z.number().int().min(1, 'Quantity must be at least 1'),
});
exports.UpdateCartItemSchema = zod_1.z.object({
    productId: zod_1.z.string().cuid(),
    quantity: zod_1.z.number().int().min(1, 'Quantity must be at least 1'),
});
exports.CreateOrderSchema = zod_1.z.object({
    shippingAddressId: zod_1.z.string().cuid().optional(),
    orderType: zod_1.z.enum(['delivery', 'pickup']).optional().default('delivery'),
    paymentMethod: zod_1.z.enum(['cash_on_delivery', 'test_card']).optional(),
    deliveryTimeSlot: zod_1.z.string().min(3).max(80).optional(),
    note: zod_1.z.string().trim().max(300).optional(),
    // When the cart contains multiple vendors, the client must specify which vendor's
    // items to checkout. This enables per-vendor courier/order flow.
    vendorId: zod_1.z.string().cuid().optional(),
});
exports.CreateProductReviewSchema = zod_1.z.object({
    comment: zod_1.z.string().trim().min(2, 'Comment is required').max(600, 'Comment is too long'),
    rating: zod_1.z.number().int().min(1).max(5).optional(),
});
exports.CreateSellerRatingSchema = zod_1.z.object({
    vendorId: zod_1.z.string().cuid(),
    rating: zod_1.z.number().int().min(1).max(5),
    comment: zod_1.z.string().trim().max(1000).optional(),
});
exports.UpdateSellerRatingSchema = zod_1.z.object({
    vendorId: zod_1.z.string().cuid(),
    rating: zod_1.z.number().int().min(1).max(5),
    comment: zod_1.z.string().trim().max(1000).optional(),
});
exports.GetOrderSellerRatingQuerySchema = zod_1.z.object({
    vendorId: zod_1.z.string().cuid().optional(),
});
exports.ListSellerRatingsQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).optional().default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).optional().default(20),
});
// Vendor Schemas
exports.UpdateVendorProfileSchema = zod_1.z.object({
    shopName: zod_1.z.string().min(2).optional(),
    iban: zod_1.z.string().min(15).optional(),
    bankName: zod_1.z.string().min(1).optional(),
    address: zod_1.z.string().optional(),
    country: zod_1.z.string().min(1).optional(),
    city: zod_1.z.string().min(1).optional(),
    district: zod_1.z.string().min(1).optional(),
    neighborhood: zod_1.z.string().min(1).optional(),
    addressLine: zod_1.z.string().min(3).optional(),
    latitude: zod_1.z.preprocess((v) => (v === null || v === undefined || v === '' ? undefined : v), zod_1.z.coerce.number().min(-90).max(90).optional()),
    longitude: zod_1.z.preprocess((v) => (v === null || v === undefined || v === '' ? undefined : v), zod_1.z.coerce.number().min(-180).max(180).optional()),
    taxNumber: zod_1.z.string().min(3).optional(),
    taxOffice: zod_1.z.string().min(2).optional(),
    taxSheetUrl: zod_1.z.string().min(1).optional(),
    residenceDocUrl: zod_1.z.string().min(1).optional(),
    idPhotoFrontUrl: zod_1.z.string().min(1).optional(),
    idPhotoBackUrl: zod_1.z.string().min(1).optional(),
    tcKimlik: zod_1.z.string().min(1).optional(),
    birthDate: zod_1.z.string().min(1).optional(),
    // Storefront
    storeAbout: zod_1.z.string().max(2000).nullable().optional(),
    openingTime: zod_1.z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
    closingTime: zod_1.z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
    storeCoverImageUrl: zod_1.z.string().min(1).nullable().optional(),
    storeLogoImageUrl: zod_1.z.string().min(1).nullable().optional(),
    storeOpenOverride: zod_1.z.boolean().nullable().optional(),
    preparationMinutes: zod_1.z.number().int().min(1).max(120).nullable().optional(),
    deliveryMinutes: zod_1.z.number().int().min(1).max(35).nullable().optional(),
    deliveryMaxMinutes: zod_1.z.number().int().min(1).max(240).nullable().optional(),
    minimumOrderAmount: zod_1.z.number().min(0).nullable().optional(),
    deliveryMode: zod_1.z.enum(['seller', 'platform']).optional(),
    flatDeliveryFee: zod_1.z.preprocess((v) => (v === null || v === undefined || v === '' ? undefined : v), zod_1.z.coerce.number().min(0).optional()),
    freeOverAmount: zod_1.z.preprocess((v) => (v === null || v === undefined || v === '' ? undefined : v), zod_1.z.coerce.number().min(0).optional()),
    isActive: zod_1.z.boolean().optional(),
}).superRefine((val, ctx) => {
    if (val.flatDeliveryFee === 0 && val.freeOverAmount !== undefined && val.freeOverAmount !== null) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ['freeOverAmount'],
            message: 'Teslimat ücreti 0 TL ise ücretsiz teslimat limiti devre dışı olmalıdır',
        });
    }
});
exports.UpdateVendorDeliverySettingsSchema = zod_1.z.object({
    deliveryMode: zod_1.z.enum(['seller', 'platform']).optional(),
    minimumOrderAmount: zod_1.z.preprocess((v) => (v === null || v === undefined || v === '' ? null : v), zod_1.z.coerce.number().min(0).nullable().optional()),
    flatDeliveryFee: zod_1.z.preprocess((v) => (v === null || v === undefined || v === '' ? null : v), zod_1.z.coerce.number().min(0).nullable().optional()),
    freeOverAmount: zod_1.z.preprocess((v) => (v === null || v === undefined || v === '' ? null : v), zod_1.z.coerce.number().min(0).nullable().optional()),
    isActive: zod_1.z.boolean().optional(),
}).superRefine((val, ctx) => {
    if (val.flatDeliveryFee === 0 && val.freeOverAmount !== undefined && val.freeOverAmount !== null) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ['freeOverAmount'],
            message: 'Teslimat ücreti 0 TL ise ücretsiz teslimat limiti devre dışı olmalıdır',
        });
    }
});
exports.RequestDeliveryCoverageChangeSchema = zod_1.z.object({
    deliveryCoverage: zod_1.z.enum(['SELF', 'PLATFORM']),
});
exports.AdminNeighborhoodDeliverySettingSchema = zod_1.z.object({
    neighborhood: zod_1.z.string().trim().min(1),
    minimumOrderAmount: zod_1.z.coerce.number().min(0),
    deliveryFee: zod_1.z.coerce.number().min(0),
    freeOverAmount: zod_1.z.preprocess((v) => (v === null || v === undefined || v === '' ? null : v), zod_1.z.coerce.number().min(0).nullable().optional()),
    deliveryMinutes: zod_1.z.coerce.number().int().min(1).max(240),
    isActive: zod_1.z.boolean().optional(),
}).superRefine((val, ctx) => {
    if (val.deliveryFee === 0 && val.freeOverAmount !== undefined && val.freeOverAmount !== null) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ['freeOverAmount'],
            message: 'Teslimat ücreti 0 TL ise ücretsiz teslimat limiti devre dışı olmalıdır',
        });
    }
});
exports.SellerCampaignSchema = zod_1.z.object({
    minBasketAmount: zod_1.z.number().finite().min(200),
    discountAmount: zod_1.z.number().finite().min(20),
    startDate: zod_1.z.string().min(1),
    endDate: zod_1.z.string().min(1),
    usageLimit: zod_1.z
        .preprocess((v) => (v === null || v === undefined || v === '' ? null : v), zod_1.z.coerce.number().int().positive().nullable())
        .optional(),
});
exports.AdminCampaignStatusSchema = zod_1.z
    .object({
    status: zod_1.z.enum(['PENDING', 'ACTIVE', 'REJECTED', 'EXPIRED', 'PASSIVE']),
    rejectReason: zod_1.z.string().optional(),
})
    .superRefine((val, ctx) => {
    if (val.status !== 'REJECTED')
        return;
    const reason = String(val.rejectReason || '').trim();
    if (reason.length < 3) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ['rejectReason'],
            message: 'Rejection reason is required',
        });
    }
});
// Admin Schemas
exports.CreateVendorViolationSchema = zod_1.z.object({
    type: zod_1.z.string().min(1, 'Violation type is required'),
    note: zod_1.z.string().min(3, 'Violation note is required'),
});
exports.UpdateBankAccountSchema = zod_1.z.object({
    iban: zod_1.z.string().min(15, 'Valid IBAN is required'),
    bankName: zod_1.z.string().min(1, 'Bank name is required'),
});
const CreateProductImageJobSchema = zod_1.z
    .object({
    kind: zod_1.z.enum(['file', 'url']),
    url: zod_1.z.string().min(1).optional(),
    filename: zod_1.z.string().min(1).optional(),
    mimeType: zod_1.z.string().min(1).optional(),
    contentBase64: zod_1.z.string().min(1).optional(),
})
    .superRefine((val, ctx) => {
    if (val.kind === 'url' && !val.url) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ['url'],
            message: 'url is required for url kind',
        });
    }
    if (val.kind === 'file') {
        if (!val.filename) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                path: ['filename'],
                message: 'filename is required for file kind',
            });
        }
        if (!val.contentBase64) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                path: ['contentBase64'],
                message: 'contentBase64 is required for file kind',
            });
        }
    }
});
const OptionalBarcodeSchema = zod_1.z.preprocess((value) => {
    const normalized = (0, barcode_1.normalizeBarcodeInput)(value);
    return normalized ? normalized : undefined;
}, zod_1.z
    .string()
    .refine((value) => (0, barcode_1.validateBarcode)(value).isValid, barcode_1.BARCODE_INVALID_MESSAGE)
    .optional());
const RequiredBarcodeSchema = zod_1.z.preprocess((value) => (0, barcode_1.normalizeBarcodeInput)(value), zod_1.z.string().refine((value) => (0, barcode_1.validateBarcode)(value).isValid, barcode_1.BARCODE_INVALID_MESSAGE));
exports.CreateProductSchema = zod_1.z.object({
    categoryId: zod_1.z.string().min(1).optional(),
    categoryName: zod_1.z.string().min(2).optional(),
    subCategoryId: zod_1.z.string().min(1).optional(),
    subCategoryName: zod_1.z.string().min(2).optional(),
    name: zod_1.z.string().min(2, 'Product name is required'),
    slug: zod_1.z.string().min(2).optional(),
    description: zod_1.z.string().optional(),
    price: zod_1.z.number().positive('Price must be positive'),
    stock: zod_1.z.number().int().nonnegative('Stock cannot be negative'),
    unit: zod_1.z.string().min(1, 'Unit is required'),
    barcode: OptionalBarcodeSchema,
    imageUrl: zod_1.z.string().url().optional(),
    images: zod_1.z.array(zod_1.z.string().min(1)).optional(),
    imageJobs: zod_1.z.array(CreateProductImageJobSchema).optional(),
    status: zod_1.z.enum(['active', 'inactive']).optional(),
    submissionSource: zod_1.z.enum(['STANDARD', 'ADVANCED']).optional(),
});
exports.UpdateProductSchema = zod_1.z.object({
    categoryId: zod_1.z.string().min(1).optional(),
    categoryName: zod_1.z.string().min(2).optional(),
    subCategoryId: zod_1.z.string().min(1).optional(),
    subCategoryName: zod_1.z.string().min(2).optional(),
    name: zod_1.z.string().min(2).optional(),
    slug: zod_1.z.string().min(2).optional(),
    description: zod_1.z.string().optional(),
    price: zod_1.z.number().positive().optional(),
    stock: zod_1.z.number().int().nonnegative().optional(),
    unit: zod_1.z.string().min(1).optional(),
    barcode: OptionalBarcodeSchema,
    imageUrl: zod_1.z.string().url().optional(),
    images: zod_1.z.array(zod_1.z.string().min(1)).optional(),
    status: zod_1.z.enum(['active', 'inactive']).optional(),
    submissionSource: zod_1.z.enum(['STANDARD', 'ADVANCED']).optional(),
});
exports.LookupBarcodeSchema = zod_1.z.object({
    barcode: RequiredBarcodeSchema,
});
exports.CreateVendorCategorySchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Category name is required'),
    icon: zod_1.z.string().min(1, 'Icon is required'),
    image: zod_1.z.string().min(1, 'Image is required'),
    description: zod_1.z.string().trim().optional(),
});
exports.UpdateVendorCategorySchema = zod_1.z.object({
    name: zod_1.z.string().min(2).optional(),
    icon: zod_1.z.string().min(1).optional(),
    image: zod_1.z.string().min(1).optional(),
    description: zod_1.z.string().trim().optional(),
    isActive: zod_1.z.boolean().optional(),
});
exports.UpdateOrderStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['PENDING', 'PREPARING', 'ON_THE_WAY', 'DELIVERED', 'CANCELLED']),
    note: zod_1.z.string().trim().optional(),
    reasonTitle: zod_1.z.string().trim().optional(),
});
exports.CreatePayoutRequestSchema = zod_1.z.object({
    amount: zod_1.z.number().finite().min(500, 'Minimum çekim tutarı 500 TL olmalıdır'),
});
exports.CancelOrderSchema = zod_1.z
    .object({
    reason: zod_1.z.enum([
        'LATE_PREPARATION',
        'WRONG_PRODUCT_OR_ORDER',
        'PRICE_TOO_HIGH',
        'WRONG_ADDRESS',
        'CHANGED_MIND',
        'OTHER',
    ]),
    otherDescription: zod_1.z.string().optional(),
})
    .superRefine((val, ctx) => {
    if (val.reason !== 'OTHER')
        return;
    const text = String(val.otherDescription || '').trim();
    if (text.length < 10) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ['otherDescription'],
            message: 'Other description must be at least 10 characters',
        });
    }
});
// Admin Schemas
exports.ApproveVendorSchema = zod_1.z.object({
// Empty body - just needs auth
});
exports.RejectVendorSchema = zod_1.z.object({
    rejectionReason: zod_1.z.string().min(5, 'Rejection reason is required'),
});
exports.DeactivateVendorSchema = zod_1.z.object({
    reason: zod_1.z.string().min(5, 'Deactivation reason is required'),
});
exports.ReviewVendorDocumentSchema = zod_1.z
    .object({
    documentType: zod_1.z.enum(['taxSheet', 'residenceDoc', 'idPhotoFront', 'idPhotoBack']),
    status: zod_1.z.enum(['APPROVED', 'RESUBMIT_REQUIRED']),
    note: zod_1.z.string().trim().max(500).optional(),
})
    .superRefine((value, ctx) => {
    if (value.status !== 'RESUBMIT_REQUIRED') {
        return;
    }
    if (String(value.note || '').trim().length < 5) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ['note'],
            message: 'Resubmission note must be at least 5 characters',
        });
    }
});
exports.ToggleProductActiveSchema = zod_1.z.object({
// Empty body - just needs auth
});
exports.RejectProductForPricingSchema = zod_1.z.object({
    reasonTitle: zod_1.z.string().trim().min(3).max(120).optional(),
    reasonMessage: zod_1.z.string().trim().min(5, 'Reason is required').max(1000),
});
// Delivery Pricing (Admin)
exports.DeliveryFeeBandSchema = zod_1.z.object({
    minKm: zod_1.z.number().finite().min(0),
    maxKm: zod_1.z.number().finite().positive(),
    fee: zod_1.z.number().finite().min(0),
});
exports.UpdateDeliveryFeeBandsSchema = zod_1.z.object({
    bands: zod_1.z.array(exports.DeliveryFeeBandSchema).min(1),
});
