import { z } from 'zod';

// Auth Schemas
export const RegisterSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z
    .string()
    .optional()
    .refine(
      (value) => {
        if (value == null || String(value).trim() === '') return true;
        const digits = String(value).replace(/\D/g, '');
        return digits.length >= 10;
      },
      { message: 'Invalid phone number' }
    ),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['CUSTOMER', 'VENDOR', 'ADMIN']),
  businessType: z.string().optional(),
  tcKimlik: z
    .string()
    .optional()
    .refine(
      (value) => {
        if (value == null || String(value).trim() === '') return true;
        return String(value).replace(/\D/g, '').length === 11;
      },
      { message: 'TC Kimlik must be 11 digits' }
    ),
  // Vendor delivery coverage (optional for backward compatibility)
  // SELF: "Teslimatı ben karşılayacağım"
  // PLATFORM: "Teslimat platform tarafından karşılanacak"
  deliveryCoverage: z.enum(['SELF', 'PLATFORM']).optional(),
});

export const LoginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email or phone is required')
    .refine(
      (value) => {
        const v = String(value || '').trim();
        if (!v) return false;
        if (v.includes('@')) return z.string().email().safeParse(v).success;
        const digits = v.replace(/\D/g, '');
        return digits.length >= 10;
      },
      { message: 'Invalid email address or phone number' }
    ),
  password: z.string().min(1, 'Password is required'),
});

export const RequestLoginOtpSchema = z.object({
  phone: z
    .string()
    .min(1, 'Phone is required')
    .refine(
      (value) => {
        const digits = String(value || '').replace(/\D/g, '');
        return digits.length >= 10;
      },
      { message: 'Invalid phone number' }
    ),
});

export const VerifyLoginOtpSchema = z.object({
  phone: z
    .string()
    .min(1, 'Phone is required')
    .refine(
      (value) => {
        const digits = String(value || '').replace(/\D/g, '');
        return digits.length >= 10;
      },
      { message: 'Invalid phone number' }
    ),
  otpCode: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const VerifyOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
  otpCode: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
});

export const ResetPasswordSchema = z
  .object({
    email: z.string().email('Invalid email address'),
    resetToken: z.string().min(20, 'Invalid reset token'),
    newPassword: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(6, 'Password must be at least 6 characters'),
  })
  .superRefine((val, ctx) => {
    if (val.newPassword !== val.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmPassword'],
        message: 'Passwords do not match',
      });
    }
  });

// Customer Schemas
export const UpdateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
});

export const AddressSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  fullName: z.string().min(2, 'Full name is required'),
  phone: z.string().min(10, 'Valid phone number is required'),
  country: z.string().min(1, 'Country is required'),
  city: z.string().min(1, 'City is required'),
  district: z.string().min(1, 'District is required'),
  neighborhood: z.string().min(1, 'Neighborhood is required'),
  addressLine: z.string().min(5, 'Address line is required'),
  latitude: z.preprocess(
    (v) => (v === null || v === undefined || v === '' ? undefined : v),
    z.coerce.number().min(-90).max(90).optional()
  ),
  longitude: z.preprocess(
    (v) => (v === null || v === undefined || v === '' ? undefined : v),
    z.coerce.number().min(-180).max(180).optional()
  ),
});

export const AddToCartSchema = z.object({
  productId: z.string().cuid(),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
});

export const UpdateCartItemSchema = z.object({
  productId: z.string().cuid(),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
});

export const CreateOrderSchema = z.object({
  shippingAddressId: z.string().cuid().optional(),
  orderType: z.enum(['delivery', 'pickup']).optional().default('delivery'),
  paymentMethod: z.enum(['cash_on_delivery', 'test_card']).optional(),
  deliveryTimeSlot: z.string().min(3).max(80).optional(),
  note: z.string().trim().max(300).optional(),
  // When the cart contains multiple vendors, the client must specify which vendor's
  // items to checkout. This enables per-vendor courier/order flow.
  vendorId: z.string().cuid().optional(),
});

export const CreateProductReviewSchema = z.object({
  comment: z.string().trim().min(2, 'Comment is required').max(600, 'Comment is too long'),
  rating: z.number().int().min(1).max(5).optional(),
});

export const CreateSellerRatingSchema = z.object({
  vendorId: z.string().cuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

export const UpdateSellerRatingSchema = z.object({
  vendorId: z.string().cuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

export const GetOrderSellerRatingQuerySchema = z.object({
  vendorId: z.string().cuid().optional(),
});

export const ListSellerRatingsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

// Vendor Schemas
export const UpdateVendorProfileSchema = z.object({
  shopName: z.string().min(2).optional(),
  iban: z.string().min(15).optional(),
  bankName: z.string().min(1).optional(),
  address: z.string().optional(),
  country: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  district: z.string().min(1).optional(),
  neighborhood: z.string().min(1).optional(),
  addressLine: z.string().min(3).optional(),
  latitude: z.preprocess(
    (v) => (v === null || v === undefined || v === '' ? undefined : v),
    z.coerce.number().min(-90).max(90).optional()
  ),
  longitude: z.preprocess(
    (v) => (v === null || v === undefined || v === '' ? undefined : v),
    z.coerce.number().min(-180).max(180).optional()
  ),
  taxNumber: z.string().min(3).optional(),
  taxOffice: z.string().min(2).optional(),
  taxSheetUrl: z.string().min(1).optional(),
  residenceDocUrl: z.string().min(1).optional(),
  idPhotoFrontUrl: z.string().min(1).optional(),
  idPhotoBackUrl: z.string().min(1).optional(),
  tcKimlik: z.string().min(1).optional(),
  birthDate: z.string().min(1).optional(),

  // Storefront
  storeAbout: z.string().max(2000).nullable().optional(),
  openingTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  closingTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  storeCoverImageUrl: z.string().min(1).nullable().optional(),
  storeLogoImageUrl: z.string().min(1).nullable().optional(),
  storeOpenOverride: z.boolean().nullable().optional(),
  preparationMinutes: z.number().int().min(1).max(120).nullable().optional(),
  deliveryMinutes: z.number().int().min(1).max(35).nullable().optional(),
  deliveryMaxMinutes: z.number().int().min(1).max(240).nullable().optional(),
  minimumOrderAmount: z.number().min(0).nullable().optional(),
  deliveryMode: z.enum(['seller', 'platform']).optional(),
  flatDeliveryFee: z.preprocess(
    (v) => (v === null || v === undefined || v === '' ? undefined : v),
    z.coerce.number().min(0).optional()
  ),
  freeOverAmount: z.preprocess(
    (v) => (v === null || v === undefined || v === '' ? undefined : v),
    z.coerce.number().min(0).optional()
  ),
  isActive: z.boolean().optional(),
}).superRefine((val, ctx) => {
  if (val.flatDeliveryFee === 0 && val.freeOverAmount !== undefined && val.freeOverAmount !== null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['freeOverAmount'],
      message: 'Teslimat ücreti 0 TL ise ücretsiz teslimat limiti devre dışı olmalıdır',
    });
  }
});

export const UpdateVendorDeliverySettingsSchema = z.object({
  deliveryMode: z.enum(['seller', 'platform']).optional(),
  minimumOrderAmount: z.preprocess(
    (v) => (v === null || v === undefined || v === '' ? null : v),
    z.coerce.number().min(0).nullable().optional()
  ),
  flatDeliveryFee: z.preprocess(
    (v) => (v === null || v === undefined || v === '' ? null : v),
    z.coerce.number().min(0).nullable().optional()
  ),
  freeOverAmount: z.preprocess(
    (v) => (v === null || v === undefined || v === '' ? null : v),
    z.coerce.number().min(0).nullable().optional()
  ),
  isActive: z.boolean().optional(),
}).superRefine((val, ctx) => {
  if (val.flatDeliveryFee === 0 && val.freeOverAmount !== undefined && val.freeOverAmount !== null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['freeOverAmount'],
      message: 'Teslimat ücreti 0 TL ise ücretsiz teslimat limiti devre dışı olmalıdır',
    });
  }
});

export const RequestDeliveryCoverageChangeSchema = z.object({
  deliveryCoverage: z.enum(['SELF', 'PLATFORM']),
});

export const AdminNeighborhoodDeliverySettingSchema = z.object({
  neighborhood: z.string().trim().min(1),
  minimumOrderAmount: z.coerce.number().min(0),
  deliveryFee: z.coerce.number().min(0),
  freeOverAmount: z.preprocess(
    (v) => (v === null || v === undefined || v === '' ? null : v),
    z.coerce.number().min(0).nullable().optional()
  ),
  deliveryMinutes: z.coerce.number().int().min(1).max(240),
  isActive: z.boolean().optional(),
}).superRefine((val, ctx) => {
  if (val.deliveryFee === 0 && val.freeOverAmount !== undefined && val.freeOverAmount !== null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['freeOverAmount'],
      message: 'Teslimat ücreti 0 TL ise ücretsiz teslimat limiti devre dışı olmalıdır',
    });
  }
});

export const SellerCampaignSchema = z.object({
  minBasketAmount: z.number().finite().min(200),
  discountAmount: z.number().finite().min(20),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  usageLimit: z
    .preprocess((v) => (v === null || v === undefined || v === '' ? null : v), z.coerce.number().int().positive().nullable())
    .optional(),
});

export const AdminCampaignStatusSchema = z
  .object({
    status: z.enum(['PENDING', 'ACTIVE', 'REJECTED', 'EXPIRED', 'PASSIVE']),
    rejectReason: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.status !== 'REJECTED') return;
    const reason = String(val.rejectReason || '').trim();
    if (reason.length < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rejectReason'],
        message: 'Rejection reason is required',
      });
    }
  });

// Admin Schemas
export const CreateVendorViolationSchema = z.object({
  type: z.string().min(1, 'Violation type is required'),
  note: z.string().min(3, 'Violation note is required'),
});

export const UpdateBankAccountSchema = z.object({
  iban: z.string().min(15, 'Valid IBAN is required'),
  bankName: z.string().min(1, 'Bank name is required'),
});

const CreateProductImageJobSchema = z
  .object({
    kind: z.enum(['file', 'url']),
    url: z.string().min(1).optional(),
    filename: z.string().min(1).optional(),
    mimeType: z.string().min(1).optional(),
    contentBase64: z.string().min(1).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.kind === 'url' && !val.url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['url'],
        message: 'url is required for url kind',
      });
    }

    if (val.kind === 'file') {
      if (!val.filename) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['filename'],
          message: 'filename is required for file kind',
        });
      }
      if (!val.contentBase64) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['contentBase64'],
          message: 'contentBase64 is required for file kind',
        });
      }
    }
  });

export const CreateProductSchema = z.object({
  categoryId: z.string().min(1).optional(),
  categoryName: z.string().min(2).optional(),
  subCategoryId: z.string().min(1).optional(),
  subCategoryName: z.string().min(2).optional(),
  name: z.string().min(2, 'Product name is required'),
  slug: z.string().min(2).optional(),
  description: z.string().optional(),
  price: z.number().positive('Price must be positive'),
  stock: z.number().int().nonnegative('Stock cannot be negative'),
  unit: z.string().min(1, 'Unit is required'),
  barcode: z
    .string()
    .trim()
    .regex(/^\d{8,14}$/, 'Barkod 8 ile 14 hane arasinda numerik olmalidir')
    .optional(),
  imageUrl: z.string().url().optional(),
  images: z.array(z.string().min(1)).optional(),
  imageJobs: z.array(CreateProductImageJobSchema).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  submissionSource: z.enum(['STANDARD', 'ADVANCED']).optional(),
});

export const UpdateProductSchema = z.object({
  categoryId: z.string().min(1).optional(),
  categoryName: z.string().min(2).optional(),
  subCategoryId: z.string().min(1).optional(),
  subCategoryName: z.string().min(2).optional(),
  name: z.string().min(2).optional(),
  slug: z.string().min(2).optional(),
  description: z.string().optional(),
  price: z.number().positive().optional(),
  stock: z.number().int().nonnegative().optional(),
  unit: z.string().min(1).optional(),
  barcode: z
    .string()
    .trim()
    .regex(/^\d{8,14}$/, 'Barkod 8 ile 14 hane arasinda numerik olmalidir')
    .optional(),
  imageUrl: z.string().url().optional(),
  images: z.array(z.string().min(1)).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  submissionSource: z.enum(['STANDARD', 'ADVANCED']).optional(),
});

export const LookupBarcodeSchema = z.object({
  barcode: z
    .string()
    .trim()
    .regex(/^\d{8,14}$/, 'Barkod 8 ile 14 hane arasinda numerik olmalidir'),
});

export const CreateVendorCategorySchema = z.object({
  name: z.string().min(2, 'Category name is required'),
  icon: z.string().min(1, 'Icon is required'),
  image: z.string().min(1, 'Image is required'),
  description: z.string().trim().optional(),
});

export const UpdateVendorCategorySchema = z.object({
  name: z.string().min(2).optional(),
  icon: z.string().min(1).optional(),
  image: z.string().min(1).optional(),
  description: z.string().trim().optional(),
  isActive: z.boolean().optional(),
});

export const UpdateOrderStatusSchema = z.object({
  status: z.enum(['PENDING', 'PREPARING', 'ON_THE_WAY', 'DELIVERED', 'CANCELLED']),
  note: z.string().trim().optional(),
  reasonTitle: z.string().trim().optional(),
});

export const CreatePayoutRequestSchema = z.object({
  amount: z.number().finite().min(500, 'Minimum çekim tutarı 500 TL olmalıdır'),
});

export const CancelOrderSchema = z
  .object({
    reason: z.enum([
      'LATE_PREPARATION',
      'WRONG_PRODUCT_OR_ORDER',
      'PRICE_TOO_HIGH',
      'WRONG_ADDRESS',
      'CHANGED_MIND',
      'OTHER',
    ]),
    otherDescription: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.reason !== 'OTHER') return;
    const text = String(val.otherDescription || '').trim();
    if (text.length < 10) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['otherDescription'],
        message: 'Other description must be at least 10 characters',
      });
    }
  });

// Admin Schemas
export const ApproveVendorSchema = z.object({
  // Empty body - just needs auth
});

export const RejectVendorSchema = z.object({
  rejectionReason: z.string().min(5, 'Rejection reason is required'),
});

export const DeactivateVendorSchema = z.object({
  reason: z.string().min(5, 'Deactivation reason is required'),
});

export const ReviewVendorDocumentSchema = z
  .object({
    documentType: z.enum(['taxSheet', 'residenceDoc', 'idPhotoFront', 'idPhotoBack']),
    status: z.enum(['APPROVED', 'RESUBMIT_REQUIRED']),
    note: z.string().trim().max(500).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.status !== 'RESUBMIT_REQUIRED') {
      return;
    }

    if (String(value.note || '').trim().length < 5) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['note'],
        message: 'Resubmission note must be at least 5 characters',
      });
    }
  });

export const ToggleProductActiveSchema = z.object({
  // Empty body - just needs auth
});

export const RejectProductForPricingSchema = z.object({
  reasonTitle: z.string().trim().min(3).max(120).optional(),
  reasonMessage: z.string().trim().min(5, 'Reason is required').max(1000),
});

// Delivery Pricing (Admin)
export const DeliveryFeeBandSchema = z.object({
  minKm: z.number().finite().min(0),
  maxKm: z.number().finite().positive(),
  fee: z.number().finite().min(0),
});

export const UpdateDeliveryFeeBandsSchema = z.object({
  bands: z.array(DeliveryFeeBandSchema).min(1),
});

// Type exports for use in controllers
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type RequestLoginOtpInput = z.infer<typeof RequestLoginOtpSchema>;
export type VerifyLoginOtpInput = z.infer<typeof VerifyLoginOtpSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type VerifyOtpInput = z.infer<typeof VerifyOtpSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
export type AddressInput = z.infer<typeof AddressSchema>;
export type AddToCartInput = z.infer<typeof AddToCartSchema>;
export type UpdateCartItemInput = z.infer<typeof UpdateCartItemSchema>;
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
export type CreateProductReviewInput = z.infer<typeof CreateProductReviewSchema>;
export type CreateSellerRatingInput = z.infer<typeof CreateSellerRatingSchema>;
export type UpdateSellerRatingInput = z.infer<typeof UpdateSellerRatingSchema>;
export type GetOrderSellerRatingQueryInput = z.infer<typeof GetOrderSellerRatingQuerySchema>;
export type ListSellerRatingsQueryInput = z.infer<typeof ListSellerRatingsQuerySchema>;
export type UpdateVendorProfileInput = z.infer<typeof UpdateVendorProfileSchema>;
export type UpdateBankAccountInput = z.infer<typeof UpdateBankAccountSchema>;
export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
export type LookupBarcodeInput = z.infer<typeof LookupBarcodeSchema>;
export type UpdateOrderStatusInput = z.infer<typeof UpdateOrderStatusSchema>;
export type CreatePayoutRequestInput = z.infer<typeof CreatePayoutRequestSchema>;
export type CancelOrderInput = z.infer<typeof CancelOrderSchema>;
export type RequestDeliveryCoverageChangeInput = z.infer<typeof RequestDeliveryCoverageChangeSchema>;
export type AdminNeighborhoodDeliverySettingInput = z.infer<typeof AdminNeighborhoodDeliverySettingSchema>;
export type UpdateVendorDeliverySettingsInput = z.infer<typeof UpdateVendorDeliverySettingsSchema>;
export type SellerCampaignInput = z.infer<typeof SellerCampaignSchema>;
export type AdminCampaignStatusInput = z.infer<typeof AdminCampaignStatusSchema>;

export type DeliveryFeeBandInput = z.infer<typeof DeliveryFeeBandSchema>;
export type UpdateDeliveryFeeBandsInput = z.infer<typeof UpdateDeliveryFeeBandsSchema>;

export type CreateVendorViolationInput = z.infer<typeof CreateVendorViolationSchema>;

export type DeactivateVendorInput = z.infer<typeof DeactivateVendorSchema>;
export type ReviewVendorDocumentInput = z.infer<typeof ReviewVendorDocumentSchema>;
