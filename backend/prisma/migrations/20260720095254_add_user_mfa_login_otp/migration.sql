-- AlterTable
ALTER TABLE "User" ADD COLUMN     "loginEmailOtpAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "loginEmailOtpExpiresAt" TIMESTAMP(3),
ADD COLUMN     "loginEmailOtpHash" TEXT,
ADD COLUMN     "loginEmailOtpSentAt" TIMESTAMP(3),
ADD COLUMN     "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mfaRecoveryCodeGeneratedAt" TIMESTAMP(3),
ADD COLUMN     "mfaRecoveryCodeHashes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "mfaSecret" TEXT,
ADD COLUMN     "mfaTempSecret" TEXT;

-- CreateIndex
CREATE INDEX "User_loginEmailOtpExpiresAt_idx" ON "User"("loginEmailOtpExpiresAt");
