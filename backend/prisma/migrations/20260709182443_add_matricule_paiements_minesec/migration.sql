-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'TRANSFERRED_OUT', 'TRANSFERRED_IN');

-- CreateEnum
CREATE TYPE "TypeFraisMinesec" AS ENUM ('SCOLARITE_PREMIER_CYCLE', 'SCOLARITE_SECOND_CYCLE', 'EXAMEN_BEPC', 'EXAMEN_PROBATOIRE', 'EXAMEN_BAC', 'EXAMEN_GCE_OL', 'EXAMEN_GCE_AL');

-- CreateEnum
CREATE TYPE "OperateurMinesec" AS ENUM ('MTN_MOMO', 'ORANGE_MONEY', 'CAMPOST', 'EXPRESS_UNION', 'AFRILAND');

-- CreateEnum
CREATE TYPE "PaiementMinesecStatus" AS ENUM ('IMPAYE', 'PAYE', 'VERIFIE', 'LITIGE');

-- CreateEnum
CREATE TYPE "DataSource" AS ENUM ('MANUAL', 'EXCEL_IMPORT', 'SCRAPE_AUTO', 'SYNC_NIGHTLY');

-- CreateEnum
CREATE TYPE "PaiementEtabStatus" AS ENUM ('IMPAYE', 'EN_ATTENTE', 'PAYE', 'LITIGE');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "MatriculeSource" AS ENUM ('MANUAL', 'EXCEL_IMPORT', 'SCRAPE_AUTO', 'SYNC_NIGHTLY');

-- AlterTable: add matricule fields to StudentProfile
ALTER TABLE "StudentProfile" ADD COLUMN "matriculeVerifieAt" TIMESTAMP(3);
ALTER TABLE "StudentProfile" ADD COLUMN "matriculeSource" "MatriculeSource" NOT NULL DEFAULT 'MANUAL';

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "anneeScolaire" TEXT NOT NULL,
    "classe" TEXT NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "transferOrigin" TEXT,
    "transferDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaiementMinesec" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "anneeScolaire" TEXT NOT NULL,
    "typeFrais" "TypeFraisMinesec" NOT NULL,
    "montantAttendu" DOUBLE PRECISION NOT NULL,
    "montantPaye" DOUBLE PRECISION,
    "operateur" "OperateurMinesec",
    "numeroRecu" TEXT,
    "recuVerifie" BOOLEAN NOT NULL DEFAULT false,
    "recuVerifieAt" TIMESTAMP(3),
    "status" "PaiementMinesecStatus" NOT NULL DEFAULT 'IMPAYE',
    "dateEcheance" TIMESTAMP(3),
    "datePaiement" TIMESTAMP(3),
    "dataSource" "DataSource" NOT NULL DEFAULT 'MANUAL',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaiementMinesec_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaiementEtablissement" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "anneeScolaire" TEXT NOT NULL,
    "typeFrais" TEXT NOT NULL,
    "montantAttendu" DOUBLE PRECISION NOT NULL,
    "montantPaye" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "PaiementEtabStatus" NOT NULL DEFAULT 'IMPAYE',
    "campPayTransactionId" TEXT,
    "campPayReference" TEXT,
    "campPayOperateur" TEXT,
    "campPayWebhookData" JSONB,
    "recu" TEXT,
    "datePaiement" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaiementEtablissement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatriculeImportJob" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "matchedRows" INTEGER NOT NULL DEFAULT 0,
    "unmatchedRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "resultDetails" JSONB,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatriculeImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TarifMinesecReference" (
    "id" TEXT NOT NULL,
    "typeFrais" "TypeFraisMinesec" NOT NULL,
    "anneeScolaire" TEXT NOT NULL,
    "niveau" TEXT,
    "montantFCFA" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TarifMinesecReference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_studentId_schoolId_anneeScolaire_key" ON "Enrollment"("studentId", "schoolId", "anneeScolaire");

-- CreateIndex
CREATE INDEX "Enrollment_schoolId_anneeScolaire_idx" ON "Enrollment"("schoolId", "anneeScolaire");

-- CreateIndex
CREATE INDEX "Enrollment_status_idx" ON "Enrollment"("status");

-- CreateIndex
CREATE INDEX "PaiementMinesec_studentId_anneeScolaire_idx" ON "PaiementMinesec"("studentId", "anneeScolaire");

-- CreateIndex
CREATE INDEX "PaiementMinesec_schoolId_status_idx" ON "PaiementMinesec"("schoolId", "status");

-- CreateIndex
CREATE INDEX "PaiementMinesec_typeFrais_status_idx" ON "PaiementMinesec"("typeFrais", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PaiementEtablissement_campPayTransactionId_key" ON "PaiementEtablissement"("campPayTransactionId");

-- CreateIndex
CREATE INDEX "PaiementEtablissement_studentId_anneeScolaire_idx" ON "PaiementEtablissement"("studentId", "anneeScolaire");

-- CreateIndex
CREATE INDEX "PaiementEtablissement_schoolId_typeFrais_status_idx" ON "PaiementEtablissement"("schoolId", "typeFrais", "status");

-- CreateIndex
CREATE INDEX "PaiementEtablissement_campPayTransactionId_idx" ON "PaiementEtablissement"("campPayTransactionId");

-- CreateIndex
CREATE INDEX "MatriculeImportJob_schoolId_idx" ON "MatriculeImportJob"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "TarifMinesecReference_typeFrais_anneeScolaire_niveau_key" ON "TarifMinesecReference"("typeFrais", "anneeScolaire", "niveau");

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaiementMinesec" ADD CONSTRAINT "PaiementMinesec_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaiementMinesec" ADD CONSTRAINT "PaiementMinesec_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaiementEtablissement" ADD CONSTRAINT "PaiementEtablissement_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaiementEtablissement" ADD CONSTRAINT "PaiementEtablissement_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
