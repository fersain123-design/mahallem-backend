-- CreateTable Settings
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY CHECK ("id" = 1),
    "commissionRate" REAL NOT NULL DEFAULT 10,
    "platformFee" REAL NOT NULL DEFAULT 0,
    "minOrderAmount" REAL NOT NULL DEFAULT 0,
    "maxOrderAmount" REAL NOT NULL DEFAULT 10000,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
