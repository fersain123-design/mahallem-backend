ALTER TABLE "BarcodeCache" RENAME TO "barcode_cache";
ALTER TABLE "BarcodeCategoryLearning" RENAME TO "barcode_category_learning";
ALTER TABLE "GlobalProduct" RENAME TO "global_products";

CREATE TABLE "product_group" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "brand" TEXT,
  "productType" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "product_group_brand_idx" ON "product_group"("brand");
CREATE INDEX "product_group_productType_idx" ON "product_group"("productType");

ALTER TABLE "global_products" ADD COLUMN "groupKey" TEXT REFERENCES "product_group"("key") ON DELETE SET NULL;
CREATE INDEX "global_products_groupKey_idx" ON "global_products"("groupKey");

CREATE TABLE "products_search_index" (
  "productId" TEXT NOT NULL PRIMARY KEY,
  "normalizedName" TEXT NOT NULL,
  "tokens" TEXT NOT NULL,
  "brand" TEXT,
  "category" TEXT,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "products_search_index_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "products_search_index_normalizedName_idx" ON "products_search_index"("normalizedName");
CREATE INDEX "products_search_index_brand_idx" ON "products_search_index"("brand");
CREATE INDEX "products_search_index_category_idx" ON "products_search_index"("category");

CREATE TABLE "barcode_analytics" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "eventKey" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "barcode" TEXT,
  "productName" TEXT,
  "category" TEXT,
  "count" INTEGER NOT NULL DEFAULT 1,
  "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "barcode_analytics_eventKey_key" ON "barcode_analytics"("eventKey");
CREATE INDEX "barcode_analytics_eventType_idx" ON "barcode_analytics"("eventType");
CREATE INDEX "barcode_analytics_barcode_idx" ON "barcode_analytics"("barcode");
CREATE INDEX "barcode_analytics_count_idx" ON "barcode_analytics"("count");
CREATE INDEX "barcode_analytics_lastSeenAt_idx" ON "barcode_analytics"("lastSeenAt");
