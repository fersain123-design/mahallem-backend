-- Add order cancellation fields (SQLite-friendly)
ALTER TABLE "Order" ADD COLUMN "cancelReason" TEXT;
ALTER TABLE "Order" ADD COLUMN "cancelOtherDescription" TEXT;
ALTER TABLE "Order" ADD COLUMN "cancelledAt" DATETIME;
ALTER TABLE "Order" ADD COLUMN "cancelledBy" TEXT;

CREATE INDEX IF NOT EXISTS "Order_cancelReason_idx" ON "Order"("cancelReason");
CREATE INDEX IF NOT EXISTS "Order_cancelledAt_idx" ON "Order"("cancelledAt");
