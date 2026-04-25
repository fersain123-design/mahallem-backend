-- Add vendor storefront fields
ALTER TABLE "VendorProfile" ADD COLUMN "storeAbout" TEXT;
ALTER TABLE "VendorProfile" ADD COLUMN "openingTime" TEXT;
ALTER TABLE "VendorProfile" ADD COLUMN "closingTime" TEXT;
ALTER TABLE "VendorProfile" ADD COLUMN "storeCoverImageUrl" TEXT;

-- Create vendor store image gallery
CREATE TABLE "VendorStoreImage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "vendorProfileId" TEXT NOT NULL,
  "imageUrl" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VendorStoreImage_vendorProfileId_fkey" FOREIGN KEY ("vendorProfileId") REFERENCES "VendorProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "VendorStoreImage_vendorProfileId_idx" ON "VendorStoreImage"("vendorProfileId");
CREATE INDEX "VendorStoreImage_createdAt_idx" ON "VendorStoreImage"("createdAt");

-- Create customer<->vendor chat tables
CREATE TABLE "VendorChatConversation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "customerId" TEXT NOT NULL,
  "vendorProfileId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "VendorChatConversation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "VendorChatConversation_vendorProfileId_fkey" FOREIGN KEY ("vendorProfileId") REFERENCES "VendorProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "VendorChatConversation_customerId_vendorProfileId_key" ON "VendorChatConversation"("customerId", "vendorProfileId");
CREATE INDEX "VendorChatConversation_customerId_idx" ON "VendorChatConversation"("customerId");
CREATE INDEX "VendorChatConversation_vendorProfileId_idx" ON "VendorChatConversation"("vendorProfileId");
CREATE INDEX "VendorChatConversation_updatedAt_idx" ON "VendorChatConversation"("updatedAt");

CREATE TABLE "VendorChatMessage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "conversationId" TEXT NOT NULL,
  "senderRole" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VendorChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "VendorChatConversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "VendorChatMessage_conversationId_idx" ON "VendorChatMessage"("conversationId");
CREATE INDEX "VendorChatMessage_createdAt_idx" ON "VendorChatMessage"("createdAt");
