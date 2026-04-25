-- AlterTable
ALTER TABLE "CustomerAddress" ADD COLUMN "latitude" REAL;
ALTER TABLE "CustomerAddress" ADD COLUMN "longitude" REAL;

-- CreateTable
CREATE TABLE "VendorViolation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vendorProfileId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "type" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VendorViolation_vendorProfileId_fkey" FOREIGN KEY ("vendorProfileId") REFERENCES "VendorProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VendorViolation_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vendorProfileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "discountPercentage" REAL NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'DAILY',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "imageUrl" TEXT,
    "validFrom" DATETIME NOT NULL,
    "validUntil" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Promotion_vendorProfileId_fkey" FOREIGN KEY ("vendorProfileId") REFERENCES "VendorProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vendorProfileId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "discountType" TEXT NOT NULL,
    "discountAmount" REAL NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "selectedProducts" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Campaign_vendorProfileId_fkey" FOREIGN KEY ("vendorProfileId") REFERENCES "VendorProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_VendorProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "shopName" TEXT NOT NULL,
    "iban" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "address" TEXT,
    "country" TEXT,
    "city" TEXT,
    "district" TEXT,
    "neighborhood" TEXT,
    "addressLine" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "businessType" TEXT NOT NULL,
    "taxNumber" TEXT,
    "taxOffice" TEXT,
    "taxSheetUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VendorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_VendorProfile" ("address", "bankName", "businessType", "createdAt", "iban", "id", "rejectionReason", "shopName", "status", "taxNumber", "taxOffice", "taxSheetUrl", "updatedAt", "userId") SELECT "address", "bankName", "businessType", "createdAt", "iban", "id", "rejectionReason", "shopName", "status", "taxNumber", "taxOffice", "taxSheetUrl", "updatedAt", "userId" FROM "VendorProfile";
DROP TABLE "VendorProfile";
ALTER TABLE "new_VendorProfile" RENAME TO "VendorProfile";
CREATE UNIQUE INDEX "VendorProfile_userId_key" ON "VendorProfile"("userId");
CREATE INDEX "VendorProfile_userId_idx" ON "VendorProfile"("userId");
CREATE INDEX "VendorProfile_status_idx" ON "VendorProfile"("status");
CREATE INDEX "VendorProfile_businessType_idx" ON "VendorProfile"("businessType");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "VendorViolation_vendorProfileId_idx" ON "VendorViolation"("vendorProfileId");

-- CreateIndex
CREATE INDEX "VendorViolation_createdAt_idx" ON "VendorViolation"("createdAt");

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
