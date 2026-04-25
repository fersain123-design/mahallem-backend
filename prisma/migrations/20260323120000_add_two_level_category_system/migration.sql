PRAGMA foreign_keys=OFF;

ALTER TABLE "VendorProfile" ADD COLUMN "categoryId" TEXT;
ALTER TABLE "Product" ADD COLUMN "subCategoryId" TEXT;

CREATE TABLE "SubCategory" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "SubCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "SellerProduct" (
  "sellerId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "price" REAL NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "SellerProduct_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "VendorProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SellerProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  PRIMARY KEY ("sellerId", "productId")
);

CREATE UNIQUE INDEX "SubCategory_categoryId_slug_key" ON "SubCategory"("categoryId", "slug");
CREATE INDEX "SubCategory_categoryId_idx" ON "SubCategory"("categoryId");
CREATE INDEX "SubCategory_isActive_idx" ON "SubCategory"("isActive");
CREATE INDEX "SellerProduct_productId_idx" ON "SellerProduct"("productId");
CREATE INDEX "VendorProfile_categoryId_idx" ON "VendorProfile"("categoryId");
CREATE INDEX "Product_subCategoryId_idx" ON "Product"("subCategoryId");

INSERT OR IGNORE INTO "Category" ("id", "name", "slug", "isCustom", "isActive") VALUES
  (lower(hex(randomblob(16))), 'Kasap', 'kasap', false, true),
  (lower(hex(randomblob(16))), 'Manav', 'manav', false, true),
  (lower(hex(randomblob(16))), 'Market', 'market', false, true),
  (lower(hex(randomblob(16))), 'Firin', 'firin', false, true),
  (lower(hex(randomblob(16))), 'Kafe', 'kafe', false, true),
  (lower(hex(randomblob(16))), 'Restoran', 'restoran', false, true),
  (lower(hex(randomblob(16))), 'Eczane', 'eczane', false, true),
  (lower(hex(randomblob(16))), 'Temizlik ve Kozmetik', 'temizlik-kozmetik', false, true),
  (lower(hex(randomblob(16))), 'Balikci', 'balikci', false, true);

INSERT OR IGNORE INTO "SubCategory" ("id", "name", "slug", "categoryId", "isActive")
SELECT lower(hex(randomblob(16))), 'Kiyma', 'kiyma', c.id, true FROM "Category" c WHERE c.slug = 'kasap';
INSERT OR IGNORE INTO "SubCategory" ("id", "name", "slug", "categoryId", "isActive")
SELECT lower(hex(randomblob(16))), 'Kusbasi', 'kusbasi', c.id, true FROM "Category" c WHERE c.slug = 'kasap';
INSERT OR IGNORE INTO "SubCategory" ("id", "name", "slug", "categoryId", "isActive")
SELECT lower(hex(randomblob(16))), 'Steak', 'steak', c.id, true FROM "Category" c WHERE c.slug = 'kasap';
INSERT OR IGNORE INTO "SubCategory" ("id", "name", "slug", "categoryId", "isActive")
SELECT lower(hex(randomblob(16))), 'Tavuk', 'tavuk', c.id, true FROM "Category" c WHERE c.slug = 'kasap';
INSERT OR IGNORE INTO "SubCategory" ("id", "name", "slug", "categoryId", "isActive")
SELECT lower(hex(randomblob(16))), 'Sucuk ve Sarkuteri', 'sucuk-sarkuteri', c.id, true FROM "Category" c WHERE c.slug = 'kasap';
INSERT OR IGNORE INTO "SubCategory" ("id", "name", "slug", "categoryId", "isActive")
SELECT lower(hex(randomblob(16))), 'Sakatat', 'sakatat', c.id, true FROM "Category" c WHERE c.slug = 'kasap';

INSERT OR IGNORE INTO "SubCategory" ("id", "name", "slug", "categoryId", "isActive")
SELECT lower(hex(randomblob(16))), 'Meyve', 'meyve', c.id, true FROM "Category" c WHERE c.slug = 'manav';
INSERT OR IGNORE INTO "SubCategory" ("id", "name", "slug", "categoryId", "isActive")
SELECT lower(hex(randomblob(16))), 'Sebze', 'sebze', c.id, true FROM "Category" c WHERE c.slug = 'manav';
INSERT OR IGNORE INTO "SubCategory" ("id", "name", "slug", "categoryId", "isActive")
SELECT lower(hex(randomblob(16))), 'Yesillik', 'yesillik', c.id, true FROM "Category" c WHERE c.slug = 'manav';

INSERT OR IGNORE INTO "SubCategory" ("id", "name", "slug", "categoryId", "isActive")
SELECT lower(hex(randomblob(16))), 'Icecek', 'icecek', c.id, true FROM "Category" c WHERE c.slug = 'market';
INSERT OR IGNORE INTO "SubCategory" ("id", "name", "slug", "categoryId", "isActive")
SELECT lower(hex(randomblob(16))), 'Atistirmalik', 'atistirmalik', c.id, true FROM "Category" c WHERE c.slug = 'market';
INSERT OR IGNORE INTO "SubCategory" ("id", "name", "slug", "categoryId", "isActive")
SELECT lower(hex(randomblob(16))), 'Temel Gida', 'temel-gida', c.id, true FROM "Category" c WHERE c.slug = 'market';
INSERT OR IGNORE INTO "SubCategory" ("id", "name", "slug", "categoryId", "isActive")
SELECT lower(hex(randomblob(16))), 'Sut Urunleri', 'sut-urunleri', c.id, true FROM "Category" c WHERE c.slug = 'market';

INSERT OR IGNORE INTO "SubCategory" ("id", "name", "slug", "categoryId", "isActive")
SELECT lower(hex(randomblob(16))), 'Diger', 'diger', c.id, true FROM "Category" c;

UPDATE "VendorProfile"
SET "categoryId" = (
  SELECT c.id
  FROM "Category" c
  WHERE c.slug = CASE
    WHEN lower(ifnull("VendorProfile"."businessType", '')) LIKE '%kasap%' THEN 'kasap'
    WHEN lower(ifnull("VendorProfile"."businessType", '')) LIKE '%balik%' THEN 'balikci'
    WHEN lower(ifnull("VendorProfile"."businessType", '')) LIKE '%manav%' THEN 'manav'
    WHEN lower(ifnull("VendorProfile"."businessType", '')) LIKE '%market%' THEN 'market'
    WHEN lower(ifnull("VendorProfile"."businessType", '')) LIKE '%firin%' THEN 'firin'
    WHEN lower(ifnull("VendorProfile"."businessType", '')) LIKE '%kafe%' THEN 'kafe'
    WHEN lower(ifnull("VendorProfile"."businessType", '')) LIKE '%restoran%' THEN 'restoran'
    WHEN lower(ifnull("VendorProfile"."businessType", '')) LIKE '%eczane%' THEN 'eczane'
    WHEN lower(ifnull("VendorProfile"."businessType", '')) LIKE '%temizlik%' THEN 'temizlik-kozmetik'
    WHEN lower(ifnull("VendorProfile"."businessType", '')) LIKE '%kozmetik%' THEN 'temizlik-kozmetik'
    ELSE 'market'
  END
  LIMIT 1
)
WHERE "categoryId" IS NULL;

UPDATE "Product"
SET "subCategoryId" = (
  SELECT sc.id
  FROM "SubCategory" sc
  WHERE sc."categoryId" = "Product"."categoryId"
    AND sc.slug = 'diger'
  LIMIT 1
)
WHERE "subCategoryId" IS NULL;

INSERT OR REPLACE INTO "SellerProduct" ("sellerId", "productId", "price", "createdAt", "updatedAt")
SELECT p."vendorId", p."id", p."price", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Product" p
WHERE p."vendorId" IS NOT NULL;

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
