CREATE UNIQUE INDEX "Product_vendorId_barcode_key" ON "Product"("vendorId", "barcode") WHERE "barcode" IS NOT NULL AND "barcode" <> '';
