-- Phase 2A : Référentiel national (OfficialProgrammeProgression)
-- Clé unique incluant filiere non-nulle, suivi de provenance/checksum et protection des éditions manuelles.

-- 1. Retirer l'ancienne contrainte unique (sans filiere)
DROP INDEX "OfficialProgrammeProgression_templateCode_level_subjectName_key";

-- 2. Normaliser les filières NULL existantes en chaîne vide avant passage en NOT NULL
UPDATE "OfficialProgrammeProgression"
SET "filiere" = ''
WHERE "filiere" IS NULL;

-- 3. Mettre à jour filiere et ajouter source, manuallyEdited, importChecksum
ALTER TABLE "OfficialProgrammeProgression"
  ALTER COLUMN "filiere" SET NOT NULL,
  ALTER COLUMN "filiere" SET DEFAULT '',
  ADD COLUMN "source" TEXT,
  ADD COLUMN "manuallyEdited" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "importChecksum" TEXT;

-- 4. Marquer toutes les lignes préexistantes comme éditées manuellement
UPDATE "OfficialProgrammeProgression"
SET "manuallyEdited" = true;

-- 5. Créer la nouvelle contrainte unique incluant filiere
CREATE UNIQUE INDEX "OfficialProgrammeProgression_templateCode_level_filiere_sub_key"
ON "OfficialProgrammeProgression"("templateCode", "level", "filiere", "subjectName");

