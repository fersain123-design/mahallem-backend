-- Add vendor delivery minute columns required by production API queries.
ALTER TABLE "VendorProfile" ADD COLUMN "deliveryMinMinutes" INTEGER;
ALTER TABLE "VendorProfile" ADD COLUMN "deliveryMaxMinutes" INTEGER;

CREATE INDEX "VendorProfile_deliveryMinMinutes_idx" ON "VendorProfile"("deliveryMinMinutes");
CREATE INDEX "VendorProfile_deliveryMaxMinutes_idx" ON "VendorProfile"("deliveryMaxMinutes");
