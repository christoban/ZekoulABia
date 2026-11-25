-- Phase 1C : OTP de verification du numero du tuteur, stocke sur la relation parent-eleve.
ALTER TABLE "ParentStudent"
  ADD COLUMN "phoneOtpHash" TEXT,
  ADD COLUMN "phoneOtpExpiresAt" TIMESTAMP(3),
  ADD COLUMN "phoneOtpAttempts" INTEGER NOT NULL DEFAULT 0;
