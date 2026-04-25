-- Store-based delivery MVP fields
ALTER TABLE "VendorProfile" ADD COLUMN "deliveryMode" TEXT NOT NULL DEFAULT 'SELLER';
ALTER TABLE "VendorProfile" ADD COLUMN "flatDeliveryFee" REAL;
ALTER TABLE "VendorProfile" ADD COLUMN "freeOverAmount" REAL;
ALTER TABLE "VendorProfile" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Settings" ADD COLUMN "defaultStoreFee" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Settings" ADD COLUMN "platformDeliveryEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Order" ADD COLUMN "deliveryTotal" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "deliveryBreakdown" TEXT;
ALTER TABLE "Order" ADD COLUMN "deliveryModeSnapshot" TEXT NOT NULL DEFAULT 'SELLER';
ALTER TABLE "Order" ADD COLUMN "deliveryFeeSnapshot" REAL NOT NULL DEFAULT 0;

CREATE INDEX "VendorProfile_deliveryMode_idx" ON "VendorProfile"("deliveryMode");
CREATE INDEX "VendorProfile_isActive_idx" ON "VendorProfile"("isActive");
