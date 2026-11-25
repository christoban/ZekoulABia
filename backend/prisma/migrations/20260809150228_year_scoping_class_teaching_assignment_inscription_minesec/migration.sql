/*
  Year-scoping — Class et TeachingAssignment portent désormais explicitement leur année
  scolaire. Base vide au moment de cette migration (aucune école pilote) : academicYearId est
  ajouté directement en NOT NULL, sans étape de backfill.

  Enrollment renommé en InscriptionMinesec (via ALTER ... RENAME, pas de perte de données même si
  la base avait déjà des lignes) : ce modèle reste un registre périphérique MINESEC
  (examens/paiements), pas la source de vérité classe/élève — voir commentaire sur le modèle dans
  schema.prisma. Renommage pur, aucun champ modifié.
*/

-- CreateEnum
CREATE TYPE "ClassStatus" AS ENUM ('DRAFT', 'ACTIVE');

-- Rename: EnrollmentStatus -> InscriptionMinesecStatus
ALTER TYPE "EnrollmentStatus" RENAME TO "InscriptionMinesecStatus";

-- Rename: Enrollment -> InscriptionMinesec (table + contraintes + index, FKs entrantes intactes)
ALTER TABLE "Enrollment" RENAME TO "InscriptionMinesec";
ALTER TABLE "InscriptionMinesec" RENAME CONSTRAINT "Enrollment_pkey" TO "InscriptionMinesec_pkey";
ALTER TABLE "InscriptionMinesec" RENAME CONSTRAINT "Enrollment_studentId_fkey" TO "InscriptionMinesec_studentId_fkey";
ALTER TABLE "InscriptionMinesec" RENAME CONSTRAINT "Enrollment_schoolId_fkey" TO "InscriptionMinesec_schoolId_fkey";
ALTER INDEX "Enrollment_studentId_schoolId_anneeScolaire_key" RENAME TO "InscriptionMinesec_studentId_schoolId_anneeScolaire_key";
ALTER INDEX "Enrollment_schoolId_anneeScolaire_idx" RENAME TO "InscriptionMinesec_schoolId_anneeScolaire_idx";
ALTER INDEX "Enrollment_status_idx" RENAME TO "InscriptionMinesec_status_idx";

-- AlterTable
ALTER TABLE "Class" ADD COLUMN     "academicYearId" TEXT NOT NULL,
ADD COLUMN     "status" "ClassStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "TeachingAssignment" ADD COLUMN     "academicYearId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Class_academicYearId_idx" ON "Class"("academicYearId");

-- CreateIndex
CREATE INDEX "Class_schoolId_academicYearId_idx" ON "Class"("schoolId", "academicYearId");

-- CreateIndex
CREATE INDEX "TeachingAssignment_academicYearId_idx" ON "TeachingAssignment"("academicYearId");

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
