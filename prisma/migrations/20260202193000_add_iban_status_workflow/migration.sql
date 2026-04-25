-- Add IBAN workflow status fields

ALTER TABLE "VendorProfile" ADD COLUMN "ibanStatus" TEXT NOT NULL DEFAULT 'CHANGE_OPEN';
ALTER TABLE "VendorProfile" ADD COLUMN "ibanChangeRequestedAt" DATETIME;

-- Existing vendors that already have an IBAN are treated as completed.
UPDATE "VendorProfile"
SET "ibanStatus" = 'COMPLETED'
WHERE TRIM(COALESCE("iban", '')) <> '';
