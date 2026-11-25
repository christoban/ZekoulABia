-- Étape 5 : Kit d'identité officielle d'établissement + code court de vérification publique
-- Migration strictement additive (aucun DROP ni suppression de données).

CREATE TABLE "SchoolIdentityKit" (
  "id"                         TEXT NOT NULL,
  "schoolId"                   TEXT NOT NULL,
  "regionalDelegationFr"       TEXT,
  "regionalDelegationEn"       TEXT,
  "departmentalDelegationFr"   TEXT,
  "departmentalDelegationEn"   TEXT,
  "mottoFr"                    TEXT,
  "mottoEn"                    TEXT,
  "poBox"                      TEXT,
  "city"                       TEXT,
  "phone"                      TEXT,
  "foundingYear"               INTEGER,
  "authorizationNumber"        TEXT,
  "accentColor"                TEXT,
  "logoAssetKey"               TEXT,
  "coatOfArmsAssetKey"         TEXT,
  "stampAssetKey"              TEXT,
  "principalSignatureAssetKey" TEXT,
  "censorSignatureAssetKey"    TEXT,
  "useCoatOfArms"              BOOLEAN NOT NULL DEFAULT false,
  "updatedById"                TEXT,
  "createdAt"                  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                  TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SchoolIdentityKit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SchoolIdentityKit_schoolId_key" ON "SchoolIdentityKit"("schoolId");

ALTER TABLE "SchoolIdentityKit"
ADD CONSTRAINT "SchoolIdentityKit_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReportCard" ADD COLUMN IF NOT EXISTS "shortVerifyCode" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "ReportCard_shortVerifyCode_key" ON "ReportCard"("shortVerifyCode");

ALTER TABLE "BulletinRevocationArchive" ADD COLUMN IF NOT EXISTS "shortVerifyCode" TEXT;
CREATE INDEX IF NOT EXISTS "BulletinRevocationArchive_verifyToken_idx" ON "BulletinRevocationArchive"("verifyToken");
CREATE INDEX IF NOT EXISTS "BulletinRevocationArchive_shortVerifyCode_idx" ON "BulletinRevocationArchive"("shortVerifyCode");

