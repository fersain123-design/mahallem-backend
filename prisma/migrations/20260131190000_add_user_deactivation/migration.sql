-- AlterTable
ALTER TABLE "User" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "deactivatedAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "deactivationReason" TEXT;

-- Indexes
CREATE INDEX IF NOT EXISTS "User_isActive_idx" ON "User"("isActive");
