-- Add vendor delivery coverage option fields (SQLite-friendly)
ALTER TABLE "VendorProfile" ADD COLUMN "deliveryCoverage" TEXT NOT NULL DEFAULT 'PLATFORM';
ALTER TABLE "VendorProfile" ADD COLUMN "pendingDeliveryCoverage" TEXT;
ALTER TABLE "VendorProfile" ADD COLUMN "deliveryCoverageChangeRequestedAt" DATETIME;
