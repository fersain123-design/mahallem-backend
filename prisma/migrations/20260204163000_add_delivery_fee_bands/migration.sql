-- Add delivery fee bands setting (stored as JSON string)
ALTER TABLE "Settings"
ADD COLUMN     "deliveryFeeBands" TEXT NOT NULL DEFAULT '[{"minKm":0,"maxKm":1,"fee":0},{"minKm":2,"maxKm":3,"fee":0},{"minKm":3,"maxKm":4,"fee":0},{"minKm":4,"maxKm":5,"fee":0}]';
