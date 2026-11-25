-- CreateEnum
CREATE TYPE "APEETransactionType" AS ENUM ('COLLECTE', 'DEPENSE');

-- CreateTable
CREATE TABLE "APEETransaction" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "type" "APEETransactionType" NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "categorie" TEXT,
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "justificatifUrl" TEXT,
    "valide" BOOLEAN NOT NULL DEFAULT false,
    "valideParId" TEXT,
    "valideAt" TIMESTAMP(3),
    "creeParId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "APEETransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "APEETransaction_schoolId_type_idx" ON "APEETransaction"("schoolId", "type");

-- CreateIndex
CREATE INDEX "APEETransaction_schoolId_valide_idx" ON "APEETransaction"("schoolId", "valide");

-- AddForeignKey
ALTER TABLE "APEETransaction" ADD CONSTRAINT "APEETransaction_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "APEETransaction" ADD CONSTRAINT "APEETransaction_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "APEETransaction" ADD CONSTRAINT "APEETransaction_valideParId_fkey" FOREIGN KEY ("valideParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
