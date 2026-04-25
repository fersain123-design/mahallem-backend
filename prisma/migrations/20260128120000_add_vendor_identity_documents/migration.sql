-- AlterTable
ALTER TABLE "VendorProfile" ADD COLUMN "residenceDocUrl" TEXT;
ALTER TABLE "VendorProfile" ADD COLUMN "tcKimlik" TEXT;
ALTER TABLE "VendorProfile" ADD COLUMN "birthDate" TEXT;
ALTER TABLE "VendorProfile" ADD COLUMN "idPhotoFrontUrl" TEXT;
ALTER TABLE "VendorProfile" ADD COLUMN "idPhotoBackUrl" TEXT;

-- Verification flags
ALTER TABLE "VendorProfile" ADD COLUMN "taxSheetVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "VendorProfile" ADD COLUMN "residenceVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "VendorProfile" ADD COLUMN "addressVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "VendorProfile" ADD COLUMN "verificationNotes" TEXT;
