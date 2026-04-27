-- Add missing Product barcode column for live database compatibility.
ALTER TABLE "Product" ADD COLUMN "barcode" TEXT;

CREATE INDEX "Product_barcode_idx" ON "Product"("barcode");
