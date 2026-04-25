-- Add order type and make shipping address optional for pickup orders (SQLite-friendly)
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "shippingAddressId" TEXT,
    "sellerCampaignId" TEXT,
    "campaignDiscount" REAL NOT NULL DEFAULT 0,
    "campaignLabel" TEXT,
    "totalPrice" REAL NOT NULL,
    "deliveryFee" REAL NOT NULL DEFAULT 0,
    "deliveryTotal" REAL NOT NULL DEFAULT 0,
    "deliveryBreakdown" TEXT,
    "deliveryModeSnapshot" TEXT NOT NULL DEFAULT 'SELLER',
    "deliveryFeeSnapshot" REAL NOT NULL DEFAULT 0,
    "deliveryDistanceKm" REAL,
    "deliveryTimeSlot" TEXT,
    "orderType" TEXT NOT NULL DEFAULT 'DELIVERY',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "cancelReason" TEXT,
    "cancelOtherDescription" TEXT,
    "cancelledAt" DATETIME,
    "cancelledBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Order_shippingAddressId_fkey" FOREIGN KEY ("shippingAddressId") REFERENCES "CustomerAddress" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_sellerCampaignId_fkey" FOREIGN KEY ("sellerCampaignId") REFERENCES "SellerCampaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_Order" (
  "id",
  "customerId",
  "shippingAddressId",
  "sellerCampaignId",
  "campaignDiscount",
  "campaignLabel",
  "totalPrice",
  "deliveryFee",
  "deliveryTotal",
  "deliveryBreakdown",
  "deliveryModeSnapshot",
  "deliveryFeeSnapshot",
  "deliveryDistanceKm",
  "deliveryTimeSlot",
  "orderType",
  "status",
  "paymentStatus",
  "cancelReason",
  "cancelOtherDescription",
  "cancelledAt",
  "cancelledBy",
  "createdAt",
  "updatedAt"
)
SELECT
  "id",
  "customerId",
  "shippingAddressId",
  "sellerCampaignId",
  "campaignDiscount",
  "campaignLabel",
  "totalPrice",
  "deliveryFee",
  "deliveryTotal",
  "deliveryBreakdown",
  "deliveryModeSnapshot",
  "deliveryFeeSnapshot",
  "deliveryDistanceKm",
  "deliveryTimeSlot",
  'DELIVERY',
  "status",
  "paymentStatus",
  "cancelReason",
  "cancelOtherDescription",
  "cancelledAt",
  "cancelledBy",
  "createdAt",
  "updatedAt"
FROM "Order";

DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";

CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");
CREATE INDEX "Order_shippingAddressId_idx" ON "Order"("shippingAddressId");
CREATE INDEX "Order_sellerCampaignId_idx" ON "Order"("sellerCampaignId");
CREATE INDEX "Order_status_idx" ON "Order"("status");
CREATE INDEX "Order_paymentStatus_idx" ON "Order"("paymentStatus");
CREATE INDEX "Order_cancelReason_idx" ON "Order"("cancelReason");
CREATE INDEX "Order_cancelledAt_idx" ON "Order"("cancelledAt");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
