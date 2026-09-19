-- CreateTable
CREATE TABLE "OfficialProgrammeProgression" (
    "id" TEXT NOT NULL,
    "templateCode" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "filiere" TEXT,
    "subjectName" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "chapitres" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfficialProgrammeProgression_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficialAcademicCalendar" (
    "id" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "establishmentType" TEXT NOT NULL DEFAULT 'MINESEC',
    "arreteReference" TEXT,
    "dateRentreeOfficielle" TIMESTAMP(3) NOT NULL,
    "dateClotureOfficielle" TIMESTAMP(3) NOT NULL,
    "trimestres" JSONB NOT NULL,
    "periodesVacances" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfficialAcademicCalendar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OfficialProgrammeProgression_templateCode_level_idx" ON "OfficialProgrammeProgression"("templateCode", "level");

-- CreateIndex
CREATE UNIQUE INDEX "OfficialProgrammeProgression_templateCode_level_subjectName_key" ON "OfficialProgrammeProgression"("templateCode", "level", "subjectName");

-- CreateIndex
CREATE INDEX "OfficialAcademicCalendar_academicYear_active_idx" ON "OfficialAcademicCalendar"("academicYear", "active");

-- CreateIndex
CREATE UNIQUE INDEX "OfficialAcademicCalendar_academicYear_establishmentType_key" ON "OfficialAcademicCalendar"("academicYear", "establishmentType");

-- AddForeignKey
ALTER TABLE "OfficialProgrammeProgression" ADD CONSTRAINT "OfficialProgrammeProgression_templateCode_fkey" FOREIGN KEY ("templateCode") REFERENCES "SchoolTemplate"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
