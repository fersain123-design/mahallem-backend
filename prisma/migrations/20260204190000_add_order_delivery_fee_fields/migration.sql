-- Add delivery fee fields to Order
ALTER TABLE "Order" ADD COLUMN "deliveryFee" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "deliveryDistanceKm" REAL;
