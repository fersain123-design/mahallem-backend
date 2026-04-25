-- Add login OTP table for backend OTP login flow (SQLite-friendly)

CREATE TABLE "LoginOtp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "phoneSnapshot" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "expiresAt" DATETIME NOT NULL,
    "lastSentAt" DATETIME NOT NULL,
    "consumedAt" DATETIME,
    "requestIp" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LoginOtp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "LoginOtp_userId_createdAt_idx" ON "LoginOtp"("userId", "createdAt");
CREATE INDEX "LoginOtp_phoneSnapshot_createdAt_idx" ON "LoginOtp"("phoneSnapshot", "createdAt");
CREATE INDEX "LoginOtp_status_expiresAt_idx" ON "LoginOtp"("status", "expiresAt");
CREATE INDEX "LoginOtp_expiresAt_idx" ON "LoginOtp"("expiresAt");
