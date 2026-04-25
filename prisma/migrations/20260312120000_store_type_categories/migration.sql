PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Category" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "vendorId" TEXT,
  "storeType" TEXT,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "icon" TEXT,
  "image" TEXT,
  "description" TEXT,
  "isCustom" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "Category_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "VendorProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_Category" ("id", "name", "slug", "description", "isActive")
SELECT "id", "name", "slug", "description", "isActive"
FROM "Category";

DROP TABLE "Category";
ALTER TABLE "new_Category" RENAME TO "Category";

CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
CREATE INDEX "Category_vendorId_idx" ON "Category"("vendorId");
CREATE INDEX "Category_storeType_idx" ON "Category"("storeType");
CREATE INDEX "Category_isActive_idx" ON "Category"("isActive");

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;