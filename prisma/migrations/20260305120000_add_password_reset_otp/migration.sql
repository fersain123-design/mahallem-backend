-- Add phoneNormalized and password reset OTP flow tables (SQLite-friendly)

ALTER TABLE "User" ADD COLUMN "phoneNormalized" TEXT;

CREATE UNIQUE INDEX "User_phoneNormalized_key" ON "User"("phoneNormalized");
CREATE INDEX "User_phoneNormalized_idx" ON "User"("phoneNormalized");

CREATE TABLE "PasswordResetOtp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "phoneSnapshot" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "resendCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME NOT NULL,
    "lastSentAt" DATETIME NOT NULL,
    "verifiedAt" DATETIME,
    "consumedAt" DATETIME,
    "resetSessionTokenHash" TEXT,
    "resetSessionExpiresAt" DATETIME,
    "requestIp" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PasswordResetOtp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "PasswordResetOtp_userId_createdAt_idx" ON "PasswordResetOtp"("userId", "createdAt");
CREATE INDEX "PasswordResetOtp_phoneSnapshot_createdAt_idx" ON "PasswordResetOtp"("phoneSnapshot", "createdAt");
CREATE INDEX "PasswordResetOtp_status_expiresAt_idx" ON "PasswordResetOtp"("status", "expiresAt");
CREATE INDEX "PasswordResetOtp_expiresAt_idx" ON "PasswordResetOtp"("expiresAt");
CREATE INDEX "PasswordResetOtp_verifiedAt_idx" ON "PasswordResetOtp"("verifiedAt");
CREATE INDEX "PasswordResetOtp_consumedAt_idx" ON "PasswordResetOtp"("consumedAt");
CREATE INDEX "PasswordResetOtp_resetSessionExpiresAt_idx" ON "PasswordResetOtp"("resetSessionExpiresAt");
