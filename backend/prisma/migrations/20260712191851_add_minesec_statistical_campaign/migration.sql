-- CreateEnum
CREATE TYPE "MappingCategory" AS ENUM ('A_AUTO', 'B_PARTIAL', 'C_MANUAL');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('DRAFT', 'PENDING_MANUAL_DATA', 'REVIEWED', 'SUBMITTED');

-- CreateTable
CREATE TABLE "StatisticalCampaignTemplate" (
    "id" TEXT NOT NULL,
    "ministry" TEXT NOT NULL,
    "year" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileFormat" TEXT NOT NULL DEFAULT 'XLS_LEGACY_BIFF8',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatisticalCampaignTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignFieldMapping" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "sheetName" TEXT NOT NULL,
    "fieldCode" TEXT NOT NULL,
    "fieldLabel" TEXT NOT NULL,
    "cellReference" TEXT NOT NULL,
    "dataType" TEXT NOT NULL DEFAULT 'NUMBER',
    "category" "MappingCategory" NOT NULL,
    "zekoulabiaSource" TEXT,

    CONSTRAINT "CampaignFieldMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatisticalSubmission" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedBy" TEXT NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "filePath" TEXT,
    "unresolvedFieldsReport" JSONB,

    CONSTRAINT "StatisticalSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolStatisticalSupplement" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "hasTitreFoncier" BOOLEAN,
    "siteProvisoire" BOOLEAN,
    "distanceEtablissementProchePublic" DOUBLE PRECISION,
    "superficieTerrainM2" DOUBLE PRECISION,
    "superficieExtensionM2" DOUBLE PRECISION,
    "natureVoiesAcces" TEXT,
    "hasInternat" BOOLEAN,
    "placesInternatFilles" INTEGER,
    "placesInternatGarcons" INTEGER,
    "historiqueTransformations" JSONB,
    "ecolesPrimairesProximite" JSONB,
    "posteComptable" TEXT,
    "infrastructuresDetail" JSONB,
    "historiqueBip" JSONB,
    "effectifsTechniquesDetail" JSONB,
    "ateliersDetail" JSONB,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL,
    "lastUpdatedBy" TEXT NOT NULL,

    CONSTRAINT "SchoolStatisticalSupplement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StatisticalCampaignTemplate_ministry_isActive_idx" ON "StatisticalCampaignTemplate"("ministry", "isActive");

-- CreateIndex
CREATE INDEX "CampaignFieldMapping_templateId_category_idx" ON "CampaignFieldMapping"("templateId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignFieldMapping_templateId_fieldCode_cellReference_key" ON "CampaignFieldMapping"("templateId", "fieldCode", "cellReference");

-- CreateIndex
CREATE INDEX "StatisticalSubmission_schoolId_generatedAt_idx" ON "StatisticalSubmission"("schoolId", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolStatisticalSupplement_schoolId_key" ON "SchoolStatisticalSupplement"("schoolId");

-- AddForeignKey
ALTER TABLE "CampaignFieldMapping" ADD CONSTRAINT "CampaignFieldMapping_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "StatisticalCampaignTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatisticalSubmission" ADD CONSTRAINT "StatisticalSubmission_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatisticalSubmission" ADD CONSTRAINT "StatisticalSubmission_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "StatisticalCampaignTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatisticalSubmission" ADD CONSTRAINT "StatisticalSubmission_generatedBy_fkey" FOREIGN KEY ("generatedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolStatisticalSupplement" ADD CONSTRAINT "SchoolStatisticalSupplement_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
