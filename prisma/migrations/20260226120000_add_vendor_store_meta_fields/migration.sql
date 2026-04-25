ALTER TABLE "VendorProfile" ADD COLUMN "storeLogoImageUrl" TEXT;
ALTER TABLE "VendorProfile" ADD COLUMN "deliveryMinutes" INTEGER;
ALTER TABLE "VendorProfile" ADD COLUMN "minimumOrderAmount" REAL;

CREATE INDEX "VendorProfile_deliveryMinutes_idx" ON "VendorProfile"("deliveryMinutes");
