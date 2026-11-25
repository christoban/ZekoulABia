ALTER TABLE "SchoolConfig"
  ADD COLUMN "studentTransferEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "TransferConsent"
  ADD COLUMN "tokenHash" TEXT,
  ADD COLUMN "tokenExpiresAt" TIMESTAMP(3),
  ADD COLUMN "otpHash" TEXT,
  ADD COLUMN "otpAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "consumedAt" TIMESTAMP(3),
  ADD COLUMN "notificationKey" TEXT,
  ADD COLUMN "smsSentAt" TIMESTAMP(3),
  ADD COLUMN "smsProviderMessageId" TEXT;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "TransferConsent" WHERE "tokenHash" IS NULL OR "tokenExpiresAt" IS NULL OR "otpHash" IS NULL OR "notificationKey" IS NULL) THEN
    RAISE EXCEPTION 'TransferConsent existant incomplet : renseigner les secrets avant de rendre les colonnes obligatoires';
  END IF;
END $$;

ALTER TABLE "TransferConsent"
  ALTER COLUMN "tokenHash" SET NOT NULL,
  ALTER COLUMN "tokenExpiresAt" SET NOT NULL,
  ALTER COLUMN "otpHash" SET NOT NULL,
  ALTER COLUMN "notificationKey" SET NOT NULL;

CREATE UNIQUE INDEX "TransferConsent_tokenHash_key" ON "TransferConsent"("tokenHash");
CREATE UNIQUE INDEX "TransferConsent_notificationKey_key" ON "TransferConsent"("notificationKey");
CREATE INDEX "TransferConsent_tokenExpiresAt_consumedAt_idx" ON "TransferConsent"("tokenExpiresAt", "consumedAt");
