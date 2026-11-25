-- Phase 1C : verification du telephone du tuteur sur la relation parent-eleve.
ALTER TABLE "ParentStudent"
  ADD COLUMN "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3);

DO $$
BEGIN
  IF EXISTS (
    SELECT "studentProfileId"
    FROM "ParentStudent"
    WHERE "contactPrincipal" = true
    GROUP BY "studentProfileId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'ParentStudent contient plusieurs tuteurs principaux pour un meme eleve';
  END IF;
END $$;

CREATE UNIQUE INDEX "ParentStudent_studentProfileId_contactPrincipal_key"
  ON "ParentStudent"("studentProfileId")
  WHERE "contactPrincipal" = true;

ALTER TABLE "ParentStudent"
  ADD CONSTRAINT "ParentStudent_phoneVerifiedAt_consistency_check"
  CHECK (
    ("phoneVerified" = false AND "phoneVerifiedAt" IS NULL)
    OR ("phoneVerified" = true AND "phoneVerifiedAt" IS NOT NULL)
  );
