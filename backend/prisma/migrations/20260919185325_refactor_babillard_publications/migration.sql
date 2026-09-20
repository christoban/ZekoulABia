-- CreateEnum
CREATE TYPE "PublicationType" AS ENUM ('ANNONCE', 'RESULTATS');

-- CreateEnum
CREATE TYPE "PublicationCorpsFormat" AS ENUM ('MARKDOWN', 'HTML_SAFE');

-- CreateEnum
CREATE TYPE "PublicationCategorie" AS ENUM ('COMMUNIQUE', 'CIRCULAIRE', 'EXAMENS', 'EVENEMENT', 'VIE_SCOLAIRE', 'ADMINISTRATIF');

-- CreateEnum
CREATE TYPE "PublicationPriorite" AS ENUM ('NORMALE', 'IMPORTANTE', 'URGENTE');

-- CreateEnum
CREATE TYPE "PublicationStatut" AS ENUM ('BROUILLON', 'EN_ATTENTE', 'PROGRAMMEE', 'PUBLIEE', 'ARCHIVEE');

-- CreateEnum
CREATE TYPE "PublicationDureeVisibilite" AS ENUM ('PERMANENT', 'J3', 'J7', 'J15', 'J30', 'PERSONNALISEE');

-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN     "auteurRole" TEXT,
ADD COLUMN     "auteurTitre" TEXT,
ADD COLUMN     "categorie" "PublicationCategorie" NOT NULL DEFAULT 'COMMUNIQUE',
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "dureeVisibilite" "PublicationDureeVisibilite" NOT NULL DEFAULT 'PERMANENT',
ADD COLUMN     "format" "PublicationCorpsFormat" NOT NULL DEFAULT 'HTML_SAFE',
ADD COLUMN     "modifieLe" TIMESTAMP(3),
ADD COLUMN     "payload" JSONB,
ADD COLUMN     "piecesJointes" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "priorite" "PublicationPriorite" NOT NULL DEFAULT 'NORMALE',
ADD COLUMN     "programmeeLe" TIMESTAMP(3),
ADD COLUMN     "publieeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "referenceId" TEXT,
ADD COLUMN     "referenceType" TEXT,
ADD COLUMN     "statut" "PublicationStatut" NOT NULL DEFAULT 'PUBLIEE',
ADD COLUMN     "targetClasses" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "targetNiveaux" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "type" "PublicationType" NOT NULL DEFAULT 'ANNONCE',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "PublicationLecture" (
    "id" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "luLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicationLecture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BabillardAudit" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BabillardAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PublicationLecture_schoolId_userId_idx" ON "PublicationLecture"("schoolId", "userId");

-- CreateIndex
CREATE INDEX "PublicationLecture_publicationId_idx" ON "PublicationLecture"("publicationId");

-- CreateIndex
CREATE UNIQUE INDEX "PublicationLecture_publicationId_userId_key" ON "PublicationLecture"("publicationId", "userId");

-- CreateIndex
CREATE INDEX "BabillardAudit_schoolId_createdAt_idx" ON "BabillardAudit"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "BabillardAudit_publicationId_idx" ON "BabillardAudit"("publicationId");

-- CreateIndex
CREATE INDEX "Announcement_schoolId_statut_publieeLe_idx" ON "Announcement"("schoolId", "statut", "publieeLe" DESC);

-- CreateIndex
CREATE INDEX "Announcement_schoolId_deletedAt_idx" ON "Announcement"("schoolId", "deletedAt");

-- AddForeignKey
ALTER TABLE "PublicationLecture" ADD CONSTRAINT "PublicationLecture_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationLecture" ADD CONSTRAINT "PublicationLecture_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationLecture" ADD CONSTRAINT "PublicationLecture_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BabillardAudit" ADD CONSTRAINT "BabillardAudit_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BabillardAudit" ADD CONSTRAINT "BabillardAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BabillardAudit" ADD CONSTRAINT "BabillardAudit_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
