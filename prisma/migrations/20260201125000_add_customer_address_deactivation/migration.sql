-- AlterTable
ALTER TABLE "CustomerAddress" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "CustomerAddress" ADD COLUMN "deactivatedAt" DATETIME;
ALTER TABLE "CustomerAddress" ADD COLUMN "deactivationReason" TEXT;
