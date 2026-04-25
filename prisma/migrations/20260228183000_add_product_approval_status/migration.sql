ALTER TABLE "Product" ADD COLUMN "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING';

UPDATE "Product"
SET "approvalStatus" = CASE
  WHEN "isActive" = 1 THEN 'APPROVED'
  ELSE 'PENDING'
END;
