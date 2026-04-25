-- Add seller ratings per delivered order/vendor pair (SQLite-friendly)
CREATE TABLE "SellerRating" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SellerRating_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SellerRating_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SellerRating_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "VendorProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SellerRating_orderId_vendorId_key" ON "SellerRating"("orderId", "vendorId");
CREATE INDEX "SellerRating_vendorId_idx" ON "SellerRating"("vendorId");
CREATE INDEX "SellerRating_customerId_idx" ON "SellerRating"("customerId");
CREATE INDEX "SellerRating_createdAt_idx" ON "SellerRating"("createdAt");
