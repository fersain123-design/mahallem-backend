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
    "businessType" TEXT NOT NULL DEFAULT 'manav',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VendorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_VendorProfile" ("address", "bankName", "createdAt", "iban", "id", "rejectionReason", "shopName", "status", "updatedAt", "userId") SELECT "address", "bankName", "createdAt", "iban", "id", "rejectionReason", "shopName", "status", "updatedAt", "userId" FROM "VendorProfile";
DROP TABLE "VendorProfile";
ALTER TABLE "new_VendorProfile" RENAME TO "VendorProfile";
CREATE UNIQUE INDEX "VendorProfile_userId_key" ON "VendorProfile"("userId");
CREATE INDEX "VendorProfile_userId_idx" ON "VendorProfile"("userId");
CREATE INDEX "VendorProfile_status_idx" ON "VendorProfile"("status");
CREATE INDEX "VendorProfile_businessType_idx" ON "VendorProfile"("businessType");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
