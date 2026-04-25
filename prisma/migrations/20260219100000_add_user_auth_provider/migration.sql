-- AlterTable
ALTER TABLE "User" ADD COLUMN "authProvider" TEXT NOT NULL DEFAULT 'EMAIL';
ALTER TABLE "User" ADD COLUMN "providerId" TEXT;

-- Indexes
CREATE INDEX IF NOT EXISTS "User_authProvider_idx" ON "User"("authProvider");
CREATE UNIQUE INDEX IF NOT EXISTS "User_providerId_key" ON "User"("providerId");
