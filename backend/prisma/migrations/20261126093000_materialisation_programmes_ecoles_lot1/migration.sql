-- AlterTable
ALTER TABLE "Programme" ADD COLUMN     "filiere" TEXT,
ADD COLUMN     "officialProgressionId" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'manuel',
ADD COLUMN     "sourceChecksum" TEXT;

-- AlterTable
ALTER TABLE "Chapitre" ADD COLUMN     "moduleOrdre" INTEGER,
ADD COLUMN     "moduleTitre" TEXT,
ADD COLUMN     "numeroAffiche" TEXT,
ADD COLUMN     "officialProgressionId" TEXT,
ADD COLUMN     "positionDansModule" INTEGER,
ADD COLUMN     "sourceKey" TEXT,
ADD COLUMN     "sourceUrl" TEXT,
ALTER COLUMN "volumeHeuresPrevu" DROP NOT NULL,
ALTER COLUMN "volumeHeuresPrevu" DROP DEFAULT;

-- CreateTable
CREATE TABLE "ChapitreAvancement" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "chapitreId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'FAIT',
    "cocheParId" TEXT NOT NULL,
    "cocheLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChapitreAvancement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgrammeModuleEtat" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "programmeId" TEXT NOT NULL,
    "moduleOrdre" INTEGER NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "modifieParId" TEXT NOT NULL,
    "modifieLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgrammeModuleEtat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChapitreAvancement_schoolId_classId_academicYearId_idx" ON "ChapitreAvancement"("schoolId", "classId", "academicYearId");

-- CreateIndex
CREATE INDEX "ChapitreAvancement_chapitreId_idx" ON "ChapitreAvancement"("chapitreId");

-- CreateIndex
CREATE UNIQUE INDEX "ChapitreAvancement_classId_chapitreId_key" ON "ChapitreAvancement"("classId", "chapitreId");

-- CreateIndex
CREATE INDEX "ProgrammeModuleEtat_schoolId_programmeId_idx" ON "ProgrammeModuleEtat"("schoolId", "programmeId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgrammeModuleEtat_programmeId_moduleOrdre_key" ON "ProgrammeModuleEtat"("programmeId", "moduleOrdre");

-- CreateIndex
CREATE INDEX "Programme_schoolId_academicYearId_classId_subjectId_idx" ON "Programme"("schoolId", "academicYearId", "classId", "subjectId");

-- CreateIndex
CREATE INDEX "Programme_officialProgressionId_idx" ON "Programme"("officialProgressionId");

-- CreateIndex
CREATE INDEX "Chapitre_programmeId_ordre_idx" ON "Chapitre"("programmeId", "ordre");

-- CreateIndex
CREATE INDEX "Chapitre_programmeId_moduleOrdre_idx" ON "Chapitre"("programmeId", "moduleOrdre");

-- AddForeignKey
ALTER TABLE "Programme" ADD CONSTRAINT "Programme_officialProgressionId_fkey" FOREIGN KEY ("officialProgressionId") REFERENCES "OfficialProgrammeProgression"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChapitreAvancement" ADD CONSTRAINT "ChapitreAvancement_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChapitreAvancement" ADD CONSTRAINT "ChapitreAvancement_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChapitreAvancement" ADD CONSTRAINT "ChapitreAvancement_chapitreId_fkey" FOREIGN KEY ("chapitreId") REFERENCES "Chapitre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChapitreAvancement" ADD CONSTRAINT "ChapitreAvancement_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChapitreAvancement" ADD CONSTRAINT "ChapitreAvancement_cocheParId_fkey" FOREIGN KEY ("cocheParId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgrammeModuleEtat" ADD CONSTRAINT "ProgrammeModuleEtat_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgrammeModuleEtat" ADD CONSTRAINT "ProgrammeModuleEtat_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgrammeModuleEtat" ADD CONSTRAINT "ProgrammeModuleEtat_modifieParId_fkey" FOREIGN KEY ("modifieParId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
