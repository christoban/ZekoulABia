-- AlterTable
ALTER TABLE "MasterUser" ADD COLUMN "isOwner" BOOLEAN NOT NULL DEFAULT false;

-- Marquer le(s) compte(s) super_admin existant(s) comme propriétaire initial
UPDATE "MasterUser" SET "isOwner" = true WHERE "isSuperAdmin" = true;

-- AlterTable
ALTER TABLE "School" ADD COLUMN "createdByMasterId" TEXT;

-- CreateIndex
CREATE INDEX "School_createdByMasterId_idx" ON "School"("createdByMasterId");

-- AddForeignKey
ALTER TABLE "School" ADD CONSTRAINT "School_createdByMasterId_fkey" FOREIGN KEY ("createdByMasterId") REFERENCES "MasterUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Rétro-remplir createdByMasterId depuis la première invitation SchoolInvite associée
UPDATE "School" s
SET "createdByMasterId" = inv."invitedByMasterId"
FROM "SchoolInvite" inv
WHERE inv."schoolId" = s."id"
  AND inv."invitedByMasterId" IS NOT NULL
  AND s."createdByMasterId" IS NULL;

