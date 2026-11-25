-- CreateTable
CREATE TABLE "MinedubSchoolSupplement" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "zoneImplantation" TEXT,
    "ordreEnseignement" TEXT,
    "elevesVulnerablesDetail" JSONB,
    "infrastructuresDetail" JSONB,
    "commoditesDetail" JSONB,
    "manuelsDetail" JSONB,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL,
    "lastUpdatedBy" TEXT NOT NULL,

    CONSTRAINT "MinedubSchoolSupplement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MinedubStatisticalReport" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedBy" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "champsNonResolus" JSONB,

    CONSTRAINT "MinedubStatisticalReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MinedubSchoolSupplement_schoolId_key" ON "MinedubSchoolSupplement"("schoolId");

-- CreateIndex
CREATE INDEX "MinedubStatisticalReport_schoolId_generatedAt_idx" ON "MinedubStatisticalReport"("schoolId", "generatedAt");

-- AddForeignKey
ALTER TABLE "MinedubSchoolSupplement" ADD CONSTRAINT "MinedubSchoolSupplement_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinedubStatisticalReport" ADD CONSTRAINT "MinedubStatisticalReport_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinedubStatisticalReport" ADD CONSTRAINT "MinedubStatisticalReport_generatedBy_fkey" FOREIGN KEY ("generatedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
