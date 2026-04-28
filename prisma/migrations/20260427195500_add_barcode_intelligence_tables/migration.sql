CREATE TABLE "BarcodeCache" (
  "barcode" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "brand" TEXT,
  "image" TEXT,
  "rawApiResponse" TEXT,
  "lastFetchedAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "BarcodeCache_lastFetchedAt_idx" ON "BarcodeCache"("lastFetchedAt");

CREATE TABLE "BarcodeCategoryLearning" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "barcode" TEXT NOT NULL,
  "selectedCategory" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "BarcodeCategoryLearning_barcode_selectedCategory_key"
  ON "BarcodeCategoryLearning"("barcode", "selectedCategory");
CREATE INDEX "BarcodeCategoryLearning_barcode_idx" ON "BarcodeCategoryLearning"("barcode");
CREATE INDEX "BarcodeCategoryLearning_selectedCategory_idx" ON "BarcodeCategoryLearning"("selectedCategory");

CREATE TABLE "GlobalProduct" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "barcode" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "brand" TEXT,
  "image" TEXT,
  "category" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "GlobalProduct_barcode_key" ON "GlobalProduct"("barcode");
CREATE INDEX "GlobalProduct_category_idx" ON "GlobalProduct"("category");
