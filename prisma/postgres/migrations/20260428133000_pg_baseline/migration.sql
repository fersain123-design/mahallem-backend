-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'VENDOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('EMAIL', 'GOOGLE', 'APPLE', 'FACEBOOK');

-- CreateEnum
CREATE TYPE "PasswordResetOtpStatus" AS ENUM ('PENDING', 'VERIFIED', 'CONSUMED', 'EXPIRED', 'LOCKED');

-- CreateEnum
CREATE TYPE "LoginOtpStatus" AS ENUM ('PENDING', 'CONSUMED', 'EXPIRED', 'LOCKED');

-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DocumentReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'RESUBMIT_REQUIRED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PREPARING', 'ON_THE_WAY', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderCancelReason" AS ENUM ('LATE_PREPARATION', 'WRONG_PRODUCT_OR_ORDER', 'PRICE_TOO_HIGH', 'WRONG_ADDRESS', 'CHANGED_MIND', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('IYZICO');

-- CreateEnum
CREATE TYPE "PaymentRecordStatus" AS ENUM ('CREATED', 'INITIALIZED', 'PENDING', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED', 'REVIEW');

-- CreateEnum
CREATE TYPE "PaymentGroup" AS ENUM ('PRODUCT', 'LISTING', 'SUBSCRIPTION');

-- CreateEnum
CREATE TYPE "SubmerchantStatus" AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE', 'FAILED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('REQUESTED', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH_ON_DELIVERY', 'TEST_CARD');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('DELIVERY', 'PICKUP');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ORDER_UPDATE', 'PAYOUT_UPDATE', 'ACCOUNT_UPDATE', 'SYSTEM_MESSAGE', 'PROMOTION_CREATED', 'PROMOTION_APPROVED', 'PROMOTION_REJECTED', 'CAMPAIGN_APPROVED');

-- CreateEnum
CREATE TYPE "PromotionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PromotionType" AS ENUM ('DAILY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "ProductApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SupportConversationStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "SupportWorkflowStatus" AS ENUM ('OPEN', 'WAITING_SELLER', 'WAITING_ADMIN', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "OrderActionHistoryType" AS ENUM ('SUPPORT_REQUESTED', 'MESSAGE_SENT', 'ORDER_CANCELLED', 'ESCALATED_TO_ADMIN', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SupportSenderRole" AS ENUM ('CUSTOMER', 'ADMIN');

-- CreateEnum
CREATE TYPE "VendorChatSenderRole" AS ENUM ('CUSTOMER', 'VENDOR');

-- CreateEnum
CREATE TYPE "IbanStatus" AS ENUM ('CHANGE_OPEN', 'WAITING_APPROVAL', 'COMPLETED');

-- CreateEnum
CREATE TYPE "DeliveryMode" AS ENUM ('SELLER', 'PLATFORM');

-- CreateEnum
CREATE TYPE "SellerCampaignStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED', 'EXPIRED', 'PASSIVE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "authProvider" "AuthProvider" NOT NULL DEFAULT 'EMAIL',
    "providerId" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "phone" TEXT,
    "phoneNormalized" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deactivatedAt" TIMESTAMP(3),
    "deactivationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetOtp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phoneSnapshot" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "status" "PasswordResetOtpStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "resendCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSentAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "resetSessionTokenHash" TEXT,
    "resetSessionExpiresAt" TIMESTAMP(3),
    "requestIp" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PasswordResetOtp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginOtp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phoneSnapshot" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "status" "LoginOtpStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSentAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "requestIp" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoginOtp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "SupportConversationStatus" NOT NULL DEFAULT 'OPEN',
    "workflowStatus" "SupportWorkflowStatus" NOT NULL DEFAULT 'OPEN',
    "subject" TEXT,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "routeTarget" TEXT NOT NULL DEFAULT 'ADMIN',
    "orderId" TEXT,
    "vendorProfileId" TEXT,
    "sourceVendorConversationId" TEXT,
    "closedAt" TIMESTAMP(3),
    "rating" INTEGER,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderRole" "SupportSenderRole" NOT NULL,
    "body" TEXT NOT NULL,
    "imageUrl" TEXT,
    "autoMessage" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shopName" TEXT NOT NULL,
    "iban" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "ibanStatus" "IbanStatus" NOT NULL DEFAULT 'CHANGE_OPEN',
    "ibanChangeRequestedAt" TIMESTAMP(3),
    "status" "VendorStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "address" TEXT,
    "country" TEXT,
    "city" TEXT,
    "district" TEXT,
    "neighborhood" TEXT,
    "addressLine" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "businessType" TEXT NOT NULL,
    "taxNumber" TEXT,
    "taxOffice" TEXT,
    "taxSheetUrl" TEXT,
    "taxSheetReviewStatus" "DocumentReviewStatus" NOT NULL DEFAULT 'PENDING',
    "taxSheetReviewNote" TEXT,
    "residenceDocUrl" TEXT,
    "residenceDocReviewStatus" "DocumentReviewStatus" NOT NULL DEFAULT 'PENDING',
    "residenceDocReviewNote" TEXT,
    "tcKimlik" TEXT,
    "birthDate" TEXT,
    "idPhotoFrontUrl" TEXT,
    "idPhotoFrontReviewStatus" "DocumentReviewStatus" NOT NULL DEFAULT 'PENDING',
    "idPhotoFrontReviewNote" TEXT,
    "idPhotoBackUrl" TEXT,
    "idPhotoBackReviewStatus" "DocumentReviewStatus" NOT NULL DEFAULT 'PENDING',
    "idPhotoBackReviewNote" TEXT,
    "taxSheetVerified" BOOLEAN NOT NULL DEFAULT false,
    "residenceVerified" BOOLEAN NOT NULL DEFAULT false,
    "addressVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationNotes" TEXT,
    "storeAbout" TEXT,
    "openingTime" TEXT,
    "closingTime" TEXT,
    "storeCoverImageUrl" TEXT,
    "storeLogoImageUrl" TEXT,
    "storeOpenOverride" BOOLEAN,
    "preparationMinutes" INTEGER,
    "deliveryMinMinutes" INTEGER,
    "deliveryMinutes" INTEGER,
    "deliveryMaxMinutes" INTEGER,
    "minimumOrderAmount" DOUBLE PRECISION,
    "deliveryCoverage" TEXT NOT NULL DEFAULT 'PLATFORM',
    "pendingDeliveryCoverage" TEXT,
    "deliveryCoverageChangeRequestedAt" TIMESTAMP(3),
    "deliveryMode" "DeliveryMode" NOT NULL DEFAULT 'SELLER',
    "categoryId" TEXT,
    "flatDeliveryFee" DOUBLE PRECISION,
    "freeOverAmount" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformNeighborhoodDeliverySetting" (
    "id" TEXT NOT NULL,
    "neighborhood" TEXT NOT NULL,
    "neighborhoodKey" TEXT NOT NULL,
    "minimumOrderAmount" DOUBLE PRECISION NOT NULL,
    "deliveryFee" DOUBLE PRECISION NOT NULL,
    "freeOverAmount" DOUBLE PRECISION,
    "deliveryMinutes" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformNeighborhoodDeliverySetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorStoreImage" (
    "id" TEXT NOT NULL,
    "vendorProfileId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorStoreImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorChatConversation" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "vendorProfileId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "workflowStatus" "SupportWorkflowStatus" NOT NULL DEFAULT 'OPEN',
    "orderId" TEXT,
    "isSupport" BOOLEAN NOT NULL DEFAULT false,
    "supportCategory" TEXT,
    "escalatedToAdmin" BOOLEAN NOT NULL DEFAULT false,
    "escalatedAt" TIMESTAMP(3),
    "adminSupportConversationId" TEXT,
    "closedAt" TIMESTAMP(3),
    "customerRating" INTEGER,
    "customerFeedback" TEXT,
    "customerLastReadAt" TIMESTAMP(3),
    "vendorLastReadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorChatConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorChatMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderRole" "VendorChatSenderRole" NOT NULL,
    "body" TEXT NOT NULL,
    "imageUrl" TEXT,
    "autoMessage" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorViolation" (
    "id" TEXT NOT NULL,
    "vendorProfileId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "type" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorViolation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerAddress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deactivatedAt" TIMESTAMP(3),
    "deactivationReason" TEXT,
    "neighborhood" TEXT NOT NULL,
    "addressLine" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT,
    "storeType" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon" TEXT,
    "image" TEXT,
    "description" TEXT,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SubCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "subCategoryId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "stock" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "barcode" TEXT,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "approvalStatus" "ProductApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerProduct" (
    "sellerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerProduct_pkey" PRIMARY KEY ("sellerId","productId")
);

-- CreateTable
CREATE TABLE "ProductReview" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "rating" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "vendorReply" TEXT,

    CONSTRAINT "ProductReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerRating" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cart" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "shippingAddressId" TEXT,
    "sellerCampaignId" TEXT,
    "campaignDiscount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "campaignLabel" TEXT,
    "appliedProductDiscountTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "appliedProductDiscountLabel" TEXT,
    "appliedProductDiscountType" TEXT,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "deliveryFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deliveryTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deliveryBreakdown" TEXT,
    "deliveryModeSnapshot" "DeliveryMode" NOT NULL DEFAULT 'SELLER',
    "deliveryFeeSnapshot" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deliveryDistanceKm" DOUBLE PRECISION,
    "deliveryTimeSlot" TEXT,
    "orderType" "OrderType" NOT NULL DEFAULT 'DELIVERY',
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH_ON_DELIVERY',
    "cancelReason" "OrderCancelReason",
    "cancelOtherDescription" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledBy" "UserRole",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderActionHistory" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "actionType" "OrderActionHistoryType" NOT NULL,
    "actorRole" "UserRole",
    "actorId" TEXT,
    "supportConversationId" TEXT,
    "vendorConversationId" TEXT,
    "note" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderActionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "commissionRateSnapshot" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "commissionAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vendorNetAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vendorId" TEXT,
    "provider" "PaymentProvider" NOT NULL,
    "conversationId" TEXT,
    "paymentGroup" "PaymentGroup" NOT NULL DEFAULT 'PRODUCT',
    "status" "PaymentRecordStatus" NOT NULL DEFAULT 'CREATED',
    "price" DOUBLE PRECISION NOT NULL,
    "paidPrice" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "token" TEXT,
    "providerPaymentId" TEXT,
    "fraudStatus" INTEGER,
    "rawInitResponse" JSONB,
    "rawRetrieveResponse" JSONB,
    "callbackVerifiedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentItem" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "submerchantId" TEXT,
    "subMerchantKey" TEXT,
    "subMerchantPrice" DOUBLE PRECISION NOT NULL,
    "itemPrice" DOUBLE PRECISION NOT NULL,
    "commissionAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "payoutAmount" DOUBLE PRECISION NOT NULL,
    "paymentTransactionId" TEXT,
    "rawProviderResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAttempt" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "requestType" TEXT NOT NULL,
    "requestPayload" JSONB,
    "responsePayload" JSONB,
    "providerConversationId" TEXT,
    "statusCode" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submerchant" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "subMerchantKey" TEXT,
    "merchantType" TEXT,
    "iban" TEXT NOT NULL,
    "identityNumber" TEXT,
    "taxNumber" TEXT,
    "contactName" TEXT,
    "status" "SubmerchantStatus" NOT NULL DEFAULT 'PENDING',
    "readinessReason" TEXT,
    "readinessCheckedAt" TIMESTAMP(3),
    "rawProviderResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Submerchant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentSettlement" (
    "id" TEXT NOT NULL,
    "paymentItemId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "payoutId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
    "providerSettlementId" TEXT,
    "settledAt" TIMESTAMP(3),
    "rawProviderResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "paymentItemId" TEXT,
    "orderId" TEXT NOT NULL,
    "providerRefundId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "status" "RefundStatus" NOT NULL DEFAULT 'REQUESTED',
    "rawProviderResponse" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentWebhookLog" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT,
    "provider" "PaymentProvider" NOT NULL,
    "eventType" TEXT,
    "signature" TEXT,
    "isValidSignature" BOOLEAN NOT NULL DEFAULT false,
    "callbackToken" TEXT,
    "conversationId" TEXT,
    "payload" JSONB,
    "providerResponse" JSONB,
    "processStatus" TEXT,
    "processError" TEXT,
    "isDuplicate" BOOLEAN NOT NULL DEFAULT false,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentWebhookLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "vendorProfileId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "grossAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "commissionAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutItem" (
    "id" TEXT NOT NULL,
    "payoutId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PayoutItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'SYSTEM_MESSAGE',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDeviceToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT,
    "deviceId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserDeviceToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL,
    "vendorProfileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "discountPercentage" DOUBLE PRECISION NOT NULL,
    "type" "PromotionType" NOT NULL DEFAULT 'DAILY',
    "status" "PromotionStatus" NOT NULL DEFAULT 'PENDING',
    "imageUrl" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "vendorProfileId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "discountType" TEXT NOT NULL,
    "discountAmount" DOUBLE PRECISION NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "selectedProducts" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerCampaign" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "minBasketAmount" DOUBLE PRECISION NOT NULL,
    "discountAmount" DOUBLE PRECISION NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "usageLimit" INTEGER,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "status" "SellerCampaignStatus" NOT NULL DEFAULT 'PENDING',
    "rejectReason" TEXT,
    "customerNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "platformFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minOrderAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxOrderAmount" DOUBLE PRECISION NOT NULL DEFAULT 10000,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "defaultStoreFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "platformDeliveryEnabled" BOOLEAN NOT NULL DEFAULT false,
    "deliveryFeeBands" TEXT NOT NULL DEFAULT '[{"minKm":0,"maxKm":1,"fee":0},{"minKm":2,"maxKm":3,"fee":0},{"minKm":3,"maxKm":4,"fee":0},{"minKm":4,"maxKm":5,"fee":0}]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_providerId_key" ON "User"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneNormalized_key" ON "User"("phoneNormalized");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_phoneNormalized_idx" ON "User"("phoneNormalized");

-- CreateIndex
CREATE INDEX "User_authProvider_idx" ON "User"("authProvider");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- CreateIndex
CREATE INDEX "PasswordResetOtp_userId_createdAt_idx" ON "PasswordResetOtp"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PasswordResetOtp_phoneSnapshot_createdAt_idx" ON "PasswordResetOtp"("phoneSnapshot", "createdAt");

-- CreateIndex
CREATE INDEX "PasswordResetOtp_status_expiresAt_idx" ON "PasswordResetOtp"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "PasswordResetOtp_expiresAt_idx" ON "PasswordResetOtp"("expiresAt");

-- CreateIndex
CREATE INDEX "PasswordResetOtp_verifiedAt_idx" ON "PasswordResetOtp"("verifiedAt");

-- CreateIndex
CREATE INDEX "PasswordResetOtp_consumedAt_idx" ON "PasswordResetOtp"("consumedAt");

-- CreateIndex
CREATE INDEX "PasswordResetOtp_resetSessionExpiresAt_idx" ON "PasswordResetOtp"("resetSessionExpiresAt");

-- CreateIndex
CREATE INDEX "LoginOtp_userId_createdAt_idx" ON "LoginOtp"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "LoginOtp_phoneSnapshot_createdAt_idx" ON "LoginOtp"("phoneSnapshot", "createdAt");

-- CreateIndex
CREATE INDEX "LoginOtp_status_expiresAt_idx" ON "LoginOtp"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "LoginOtp_expiresAt_idx" ON "LoginOtp"("expiresAt");

-- CreateIndex
CREATE INDEX "SupportConversation_userId_idx" ON "SupportConversation"("userId");

-- CreateIndex
CREATE INDEX "SupportConversation_status_idx" ON "SupportConversation"("status");

-- CreateIndex
CREATE INDEX "SupportConversation_workflowStatus_idx" ON "SupportConversation"("workflowStatus");

-- CreateIndex
CREATE INDEX "SupportConversation_orderId_idx" ON "SupportConversation"("orderId");

-- CreateIndex
CREATE INDEX "SupportMessage_conversationId_idx" ON "SupportMessage"("conversationId");

-- CreateIndex
CREATE INDEX "SupportMessage_createdAt_idx" ON "SupportMessage"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "VendorProfile_userId_key" ON "VendorProfile"("userId");

-- CreateIndex
CREATE INDEX "VendorProfile_userId_idx" ON "VendorProfile"("userId");

-- CreateIndex
CREATE INDEX "VendorProfile_status_idx" ON "VendorProfile"("status");

-- CreateIndex
CREATE INDEX "VendorProfile_businessType_idx" ON "VendorProfile"("businessType");

-- CreateIndex
CREATE INDEX "VendorProfile_preparationMinutes_idx" ON "VendorProfile"("preparationMinutes");

-- CreateIndex
CREATE INDEX "VendorProfile_deliveryMinMinutes_idx" ON "VendorProfile"("deliveryMinMinutes");

-- CreateIndex
CREATE INDEX "VendorProfile_deliveryMinutes_idx" ON "VendorProfile"("deliveryMinutes");

-- CreateIndex
CREATE INDEX "VendorProfile_deliveryMaxMinutes_idx" ON "VendorProfile"("deliveryMaxMinutes");

-- CreateIndex
CREATE INDEX "VendorProfile_deliveryCoverage_idx" ON "VendorProfile"("deliveryCoverage");

-- CreateIndex
CREATE INDEX "VendorProfile_deliveryMode_idx" ON "VendorProfile"("deliveryMode");

-- CreateIndex
CREATE INDEX "VendorProfile_isActive_idx" ON "VendorProfile"("isActive");

-- CreateIndex
CREATE INDEX "VendorProfile_pendingDeliveryCoverage_idx" ON "VendorProfile"("pendingDeliveryCoverage");

-- CreateIndex
CREATE INDEX "VendorProfile_categoryId_idx" ON "VendorProfile"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformNeighborhoodDeliverySetting_neighborhoodKey_key" ON "PlatformNeighborhoodDeliverySetting"("neighborhoodKey");

-- CreateIndex
CREATE INDEX "PlatformNeighborhoodDeliverySetting_neighborhood_idx" ON "PlatformNeighborhoodDeliverySetting"("neighborhood");

-- CreateIndex
CREATE INDEX "PlatformNeighborhoodDeliverySetting_isActive_idx" ON "PlatformNeighborhoodDeliverySetting"("isActive");

-- CreateIndex
CREATE INDEX "VendorStoreImage_vendorProfileId_idx" ON "VendorStoreImage"("vendorProfileId");

-- CreateIndex
CREATE INDEX "VendorStoreImage_createdAt_idx" ON "VendorStoreImage"("createdAt");

-- CreateIndex
CREATE INDEX "VendorChatConversation_customerId_idx" ON "VendorChatConversation"("customerId");

-- CreateIndex
CREATE INDEX "VendorChatConversation_vendorProfileId_idx" ON "VendorChatConversation"("vendorProfileId");

-- CreateIndex
CREATE INDEX "VendorChatConversation_orderId_idx" ON "VendorChatConversation"("orderId");

-- CreateIndex
CREATE INDEX "VendorChatConversation_isSupport_idx" ON "VendorChatConversation"("isSupport");

-- CreateIndex
CREATE INDEX "VendorChatConversation_workflowStatus_idx" ON "VendorChatConversation"("workflowStatus");

-- CreateIndex
CREATE INDEX "VendorChatConversation_updatedAt_idx" ON "VendorChatConversation"("updatedAt");

-- CreateIndex
CREATE INDEX "VendorChatMessage_conversationId_idx" ON "VendorChatMessage"("conversationId");

-- CreateIndex
CREATE INDEX "VendorChatMessage_createdAt_idx" ON "VendorChatMessage"("createdAt");

-- CreateIndex
CREATE INDEX "VendorViolation_vendorProfileId_idx" ON "VendorViolation"("vendorProfileId");

-- CreateIndex
CREATE INDEX "VendorViolation_createdAt_idx" ON "VendorViolation"("createdAt");

-- CreateIndex
CREATE INDEX "CustomerAddress_userId_idx" ON "CustomerAddress"("userId");

-- CreateIndex
CREATE INDEX "CustomerAddress_isDefault_idx" ON "CustomerAddress"("isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "Category_vendorId_idx" ON "Category"("vendorId");

-- CreateIndex
CREATE INDEX "Category_storeType_idx" ON "Category"("storeType");

-- CreateIndex
CREATE INDEX "Category_isActive_idx" ON "Category"("isActive");

-- CreateIndex
CREATE INDEX "SubCategory_categoryId_idx" ON "SubCategory"("categoryId");

-- CreateIndex
CREATE INDEX "SubCategory_isActive_idx" ON "SubCategory"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SubCategory_categoryId_slug_key" ON "SubCategory"("categoryId", "slug");

-- CreateIndex
CREATE INDEX "Product_vendorId_idx" ON "Product"("vendorId");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE INDEX "Product_subCategoryId_idx" ON "Product"("subCategoryId");

-- CreateIndex
CREATE INDEX "Product_isActive_idx" ON "Product"("isActive");

-- CreateIndex
CREATE INDEX "Product_approvalStatus_idx" ON "Product"("approvalStatus");

-- CreateIndex
CREATE INDEX "Product_slug_idx" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "Product_barcode_idx" ON "Product"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "Product_vendorId_slug_key" ON "Product"("vendorId", "slug");

-- CreateIndex
CREATE INDEX "SellerProduct_productId_idx" ON "SellerProduct"("productId");

-- CreateIndex
CREATE INDEX "ProductReview_productId_idx" ON "ProductReview"("productId");

-- CreateIndex
CREATE INDEX "ProductReview_customerId_idx" ON "ProductReview"("customerId");

-- CreateIndex
CREATE INDEX "ProductReview_createdAt_idx" ON "ProductReview"("createdAt");

-- CreateIndex
CREATE INDEX "SellerRating_vendorId_idx" ON "SellerRating"("vendorId");

-- CreateIndex
CREATE INDEX "SellerRating_customerId_idx" ON "SellerRating"("customerId");

-- CreateIndex
CREATE INDEX "SellerRating_createdAt_idx" ON "SellerRating"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SellerRating_orderId_vendorId_key" ON "SellerRating"("orderId", "vendorId");

-- CreateIndex
CREATE INDEX "ProductImage_productId_idx" ON "ProductImage"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_userId_key" ON "Cart"("userId");

-- CreateIndex
CREATE INDEX "Cart_userId_idx" ON "Cart"("userId");

-- CreateIndex
CREATE INDEX "CartItem_cartId_idx" ON "CartItem"("cartId");

-- CreateIndex
CREATE INDEX "CartItem_productId_idx" ON "CartItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_cartId_productId_key" ON "CartItem"("cartId", "productId");

-- CreateIndex
CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");

-- CreateIndex
CREATE INDEX "Order_shippingAddressId_idx" ON "Order"("shippingAddressId");

-- CreateIndex
CREATE INDEX "Order_sellerCampaignId_idx" ON "Order"("sellerCampaignId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_paymentStatus_idx" ON "Order"("paymentStatus");

-- CreateIndex
CREATE INDEX "Order_cancelReason_idx" ON "Order"("cancelReason");

-- CreateIndex
CREATE INDEX "Order_cancelledAt_idx" ON "Order"("cancelledAt");

-- CreateIndex
CREATE INDEX "OrderActionHistory_orderId_idx" ON "OrderActionHistory"("orderId");

-- CreateIndex
CREATE INDEX "OrderActionHistory_createdAt_idx" ON "OrderActionHistory"("createdAt");

-- CreateIndex
CREATE INDEX "OrderActionHistory_actionType_idx" ON "OrderActionHistory"("actionType");

-- CreateIndex
CREATE INDEX "OrderActionHistory_supportConversationId_idx" ON "OrderActionHistory"("supportConversationId");

-- CreateIndex
CREATE INDEX "OrderActionHistory_vendorConversationId_idx" ON "OrderActionHistory"("vendorConversationId");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- CreateIndex
CREATE INDEX "OrderItem_vendorId_idx" ON "OrderItem"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_conversationId_key" ON "Payment"("conversationId");

-- CreateIndex
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");

-- CreateIndex
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");

-- CreateIndex
CREATE INDEX "Payment_vendorId_idx" ON "Payment"("vendorId");

-- CreateIndex
CREATE INDEX "Payment_provider_idx" ON "Payment"("provider");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_token_idx" ON "Payment"("token");

-- CreateIndex
CREATE INDEX "Payment_providerPaymentId_idx" ON "Payment"("providerPaymentId");

-- CreateIndex
CREATE INDEX "PaymentItem_paymentId_idx" ON "PaymentItem"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentItem_orderItemId_idx" ON "PaymentItem"("orderItemId");

-- CreateIndex
CREATE INDEX "PaymentItem_vendorId_idx" ON "PaymentItem"("vendorId");

-- CreateIndex
CREATE INDEX "PaymentItem_submerchantId_idx" ON "PaymentItem"("submerchantId");

-- CreateIndex
CREATE INDEX "PaymentItem_paymentTransactionId_idx" ON "PaymentItem"("paymentTransactionId");

-- CreateIndex
CREATE INDEX "PaymentAttempt_paymentId_idx" ON "PaymentAttempt"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentAttempt_idempotencyKey_idx" ON "PaymentAttempt"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PaymentAttempt_providerConversationId_idx" ON "PaymentAttempt"("providerConversationId");

-- CreateIndex
CREATE UNIQUE INDEX "Submerchant_subMerchantKey_key" ON "Submerchant"("subMerchantKey");

-- CreateIndex
CREATE INDEX "Submerchant_vendorId_idx" ON "Submerchant"("vendorId");

-- CreateIndex
CREATE INDEX "Submerchant_provider_idx" ON "Submerchant"("provider");

-- CreateIndex
CREATE INDEX "Submerchant_status_idx" ON "Submerchant"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Submerchant_vendorId_provider_key" ON "Submerchant"("vendorId", "provider");

-- CreateIndex
CREATE INDEX "PaymentSettlement_paymentItemId_idx" ON "PaymentSettlement"("paymentItemId");

-- CreateIndex
CREATE INDEX "PaymentSettlement_vendorId_idx" ON "PaymentSettlement"("vendorId");

-- CreateIndex
CREATE INDEX "PaymentSettlement_payoutId_idx" ON "PaymentSettlement"("payoutId");

-- CreateIndex
CREATE INDEX "PaymentSettlement_status_idx" ON "PaymentSettlement"("status");

-- CreateIndex
CREATE INDEX "Refund_paymentId_idx" ON "Refund"("paymentId");

-- CreateIndex
CREATE INDEX "Refund_paymentItemId_idx" ON "Refund"("paymentItemId");

-- CreateIndex
CREATE INDEX "Refund_orderId_idx" ON "Refund"("orderId");

-- CreateIndex
CREATE INDEX "Refund_status_idx" ON "Refund"("status");

-- CreateIndex
CREATE INDEX "PaymentWebhookLog_paymentId_idx" ON "PaymentWebhookLog"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentWebhookLog_provider_idx" ON "PaymentWebhookLog"("provider");

-- CreateIndex
CREATE INDEX "PaymentWebhookLog_eventType_idx" ON "PaymentWebhookLog"("eventType");

-- CreateIndex
CREATE INDEX "PaymentWebhookLog_conversationId_idx" ON "PaymentWebhookLog"("conversationId");

-- CreateIndex
CREATE INDEX "PaymentWebhookLog_callbackToken_idx" ON "PaymentWebhookLog"("callbackToken");

-- CreateIndex
CREATE INDEX "PaymentWebhookLog_receivedAt_idx" ON "PaymentWebhookLog"("receivedAt");

-- CreateIndex
CREATE INDEX "Payout_vendorProfileId_idx" ON "Payout"("vendorProfileId");

-- CreateIndex
CREATE INDEX "Payout_status_idx" ON "Payout"("status");

-- CreateIndex
CREATE INDEX "PayoutItem_payoutId_idx" ON "PayoutItem"("payoutId");

-- CreateIndex
CREATE INDEX "PayoutItem_orderId_idx" ON "PayoutItem"("orderId");

-- CreateIndex
CREATE INDEX "PayoutItem_orderItemId_idx" ON "PayoutItem"("orderItemId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_isRead_idx" ON "Notification"("isRead");

-- CreateIndex
CREATE UNIQUE INDEX "UserDeviceToken_token_key" ON "UserDeviceToken"("token");

-- CreateIndex
CREATE INDEX "UserDeviceToken_userId_isActive_idx" ON "UserDeviceToken"("userId", "isActive");

-- CreateIndex
CREATE INDEX "UserDeviceToken_lastSeenAt_idx" ON "UserDeviceToken"("lastSeenAt");

-- CreateIndex
CREATE INDEX "Promotion_vendorProfileId_idx" ON "Promotion"("vendorProfileId");

-- CreateIndex
CREATE INDEX "Promotion_status_idx" ON "Promotion"("status");

-- CreateIndex
CREATE INDEX "Promotion_type_idx" ON "Promotion"("type");

-- CreateIndex
CREATE INDEX "Promotion_validFrom_idx" ON "Promotion"("validFrom");

-- CreateIndex
CREATE INDEX "Promotion_validUntil_idx" ON "Promotion"("validUntil");

-- CreateIndex
CREATE INDEX "Campaign_vendorProfileId_idx" ON "Campaign"("vendorProfileId");

-- CreateIndex
CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");

-- CreateIndex
CREATE INDEX "Campaign_startDate_idx" ON "Campaign"("startDate");

-- CreateIndex
CREATE INDEX "Campaign_endDate_idx" ON "Campaign"("endDate");

-- CreateIndex
CREATE INDEX "SellerCampaign_sellerId_idx" ON "SellerCampaign"("sellerId");

-- CreateIndex
CREATE INDEX "SellerCampaign_status_idx" ON "SellerCampaign"("status");

-- CreateIndex
CREATE INDEX "SellerCampaign_startDate_idx" ON "SellerCampaign"("startDate");

-- CreateIndex
CREATE INDEX "SellerCampaign_endDate_idx" ON "SellerCampaign"("endDate");

-- AddForeignKey
ALTER TABLE "PasswordResetOtp" ADD CONSTRAINT "PasswordResetOtp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoginOtp" ADD CONSTRAINT "LoginOtp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportConversation" ADD CONSTRAINT "SupportConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "SupportConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorProfile" ADD CONSTRAINT "VendorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorProfile" ADD CONSTRAINT "VendorProfile_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorStoreImage" ADD CONSTRAINT "VendorStoreImage_vendorProfileId_fkey" FOREIGN KEY ("vendorProfileId") REFERENCES "VendorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorChatConversation" ADD CONSTRAINT "VendorChatConversation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorChatConversation" ADD CONSTRAINT "VendorChatConversation_vendorProfileId_fkey" FOREIGN KEY ("vendorProfileId") REFERENCES "VendorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorChatMessage" ADD CONSTRAINT "VendorChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "VendorChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorViolation" ADD CONSTRAINT "VendorViolation_vendorProfileId_fkey" FOREIGN KEY ("vendorProfileId") REFERENCES "VendorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorViolation" ADD CONSTRAINT "VendorViolation_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "VendorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubCategory" ADD CONSTRAINT "SubCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "VendorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_subCategoryId_fkey" FOREIGN KEY ("subCategoryId") REFERENCES "SubCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerProduct" ADD CONSTRAINT "SellerProduct_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "VendorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerProduct" ADD CONSTRAINT "SellerProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerRating" ADD CONSTRAINT "SellerRating_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerRating" ADD CONSTRAINT "SellerRating_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerRating" ADD CONSTRAINT "SellerRating_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "VendorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_shippingAddressId_fkey" FOREIGN KEY ("shippingAddressId") REFERENCES "CustomerAddress"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_sellerCampaignId_fkey" FOREIGN KEY ("sellerCampaignId") REFERENCES "SellerCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderActionHistory" ADD CONSTRAINT "OrderActionHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "VendorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "VendorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentItem" ADD CONSTRAINT "PaymentItem_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentItem" ADD CONSTRAINT "PaymentItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentItem" ADD CONSTRAINT "PaymentItem_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "VendorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentItem" ADD CONSTRAINT "PaymentItem_submerchantId_fkey" FOREIGN KEY ("submerchantId") REFERENCES "Submerchant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submerchant" ADD CONSTRAINT "Submerchant_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "VendorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSettlement" ADD CONSTRAINT "PaymentSettlement_paymentItemId_fkey" FOREIGN KEY ("paymentItemId") REFERENCES "PaymentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSettlement" ADD CONSTRAINT "PaymentSettlement_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "VendorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSettlement" ADD CONSTRAINT "PaymentSettlement_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "Payout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentItemId_fkey" FOREIGN KEY ("paymentItemId") REFERENCES "PaymentItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentWebhookLog" ADD CONSTRAINT "PaymentWebhookLog_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_vendorProfileId_fkey" FOREIGN KEY ("vendorProfileId") REFERENCES "VendorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutItem" ADD CONSTRAINT "PayoutItem_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "Payout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutItem" ADD CONSTRAINT "PayoutItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutItem" ADD CONSTRAINT "PayoutItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDeviceToken" ADD CONSTRAINT "UserDeviceToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_vendorProfileId_fkey" FOREIGN KEY ("vendorProfileId") REFERENCES "VendorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_vendorProfileId_fkey" FOREIGN KEY ("vendorProfileId") REFERENCES "VendorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerCampaign" ADD CONSTRAINT "SellerCampaign_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "VendorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

