-- Add seller campaign model and order campaign linkage fields (SQLite-friendly)
CREATE TABLE "SellerCampaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sellerId" TEXT NOT NULL,
    "minBasketAmount" REAL NOT NULL,
    "discountAmount" REAL NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "usageLimit" INTEGER,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rejectReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SellerCampaign_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "VendorProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "Order" ADD COLUMN "sellerCampaignId" TEXT;
ALTER TABLE "Order" ADD COLUMN "campaignDiscount" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "campaignLabel" TEXT;

CREATE INDEX "SellerCampaign_sellerId_idx" ON "SellerCampaign"("sellerId");
CREATE INDEX "SellerCampaign_status_idx" ON "SellerCampaign"("status");
CREATE INDEX "SellerCampaign_startDate_idx" ON "SellerCampaign"("startDate");
CREATE INDEX "SellerCampaign_endDate_idx" ON "SellerCampaign"("endDate");

CREATE INDEX "Order_sellerCampaignId_idx" ON "Order"("sellerCampaignId");
