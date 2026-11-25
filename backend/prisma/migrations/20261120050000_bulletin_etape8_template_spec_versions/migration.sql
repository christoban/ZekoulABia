-- Étape 8.1 : Persistance en base des versions de specs de bulletins (brouillons et versions publiées immuables)
CREATE TABLE "BulletinTemplateSpecRecord" (
    "id" TEXT NOT NULL,
    "specId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "familyKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "specJson" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BulletinTemplateSpecRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BulletinTemplateSpecRecord_specId_version_key"
ON "BulletinTemplateSpecRecord"("specId", "version");

CREATE INDEX "BulletinTemplateSpecRecord_specId_status_idx"
ON "BulletinTemplateSpecRecord"("specId", "status");

