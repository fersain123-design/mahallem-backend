ALTER TABLE "Order" ADD COLUMN "appliedProductDiscountTotal" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "appliedProductDiscountLabel" TEXT;
ALTER TABLE "Order" ADD COLUMN "appliedProductDiscountType" TEXT;