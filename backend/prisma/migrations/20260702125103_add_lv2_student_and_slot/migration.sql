-- CreateEnum
CREATE TYPE "CareerEventType" AS ENUM ('PROMOTION', 'MUTATION', 'AVANCEMENT_ECHELON', 'SANCTION');

-- CreateEnum
CREATE TYPE "StaffAttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'RETARD');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('CONGE_ANNUEL', 'MALADIE', 'MATERNITE', 'AUTORISATION');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN     "lv2SubjectId" TEXT;

-- AlterTable
ALTER TABLE "TimetableSlot" ADD COLUMN     "isLV2Slot" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "EmployeeFile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "dateNaissance" TIMESTAMP(3),
    "diplomes" JSONB NOT NULL DEFAULT '[]',
    "numeroCNPS" TEXT,
    "typeContrat" TEXT,
    "dateEmbauche" TIMESTAMP(3),
    "echelonActuel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareerEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "type" "CareerEventType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "observation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareerEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffAttendance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "statut" "StaffAttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "type" "LeaveType" NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3) NOT NULL,
    "motif" TEXT,
    "statut" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "validatedBy" TEXT,
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveBalance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "annee" INTEGER NOT NULL,
    "soldeInitial" DOUBLE PRECISION NOT NULL DEFAULT 30,
    "soldeRestant" DOUBLE PRECISION NOT NULL DEFAULT 30,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissionOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "motif" TEXT NOT NULL,
    "lieu" TEXT NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3) NOT NULL,
    "signataire" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MissionOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeFile_userId_key" ON "EmployeeFile"("userId");

-- CreateIndex
CREATE INDEX "EmployeeFile_schoolId_idx" ON "EmployeeFile"("schoolId");

-- CreateIndex
CREATE INDEX "CareerEvent_userId_idx" ON "CareerEvent"("userId");

-- CreateIndex
CREATE INDEX "CareerEvent_schoolId_idx" ON "CareerEvent"("schoolId");

-- CreateIndex
CREATE INDEX "StaffAttendance_schoolId_idx" ON "StaffAttendance"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffAttendance_userId_date_key" ON "StaffAttendance"("userId", "date");

-- CreateIndex
CREATE INDEX "LeaveRequest_userId_idx" ON "LeaveRequest"("userId");

-- CreateIndex
CREATE INDEX "LeaveRequest_schoolId_idx" ON "LeaveRequest"("schoolId");

-- CreateIndex
CREATE INDEX "LeaveBalance_schoolId_idx" ON "LeaveBalance"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveBalance_userId_annee_key" ON "LeaveBalance"("userId", "annee");

-- CreateIndex
CREATE INDEX "MissionOrder_userId_idx" ON "MissionOrder"("userId");

-- CreateIndex
CREATE INDEX "MissionOrder_schoolId_idx" ON "MissionOrder"("schoolId");

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_lv2SubjectId_fkey" FOREIGN KEY ("lv2SubjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeFile" ADD CONSTRAINT "EmployeeFile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeFile" ADD CONSTRAINT "EmployeeFile_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerEvent" ADD CONSTRAINT "CareerEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerEvent" ADD CONSTRAINT "CareerEvent_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_validatedBy_fkey" FOREIGN KEY ("validatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionOrder" ADD CONSTRAINT "MissionOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionOrder" ADD CONSTRAINT "MissionOrder_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
