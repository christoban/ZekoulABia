-- Reduce GradeValidationStatus enum to DRAFT | LOCKED
-- Since no production data uses SUBMITTED, VALIDATED, REJECTED (empty DB), 
-- we can directly recreate the enum

-- Create new enum with only the two values
CREATE TYPE "GradeValidationStatus_new" AS ENUM ('DRAFT', 'LOCKED');

-- Drop the default that references the old enum
ALTER TABLE "Grade" ALTER COLUMN "validationStatus" DROP DEFAULT;

-- Convert the column to use the new enum
ALTER TABLE "Grade" 
  ALTER COLUMN "validationStatus" TYPE "GradeValidationStatus_new" 
  USING "validationStatus"::text::"GradeValidationStatus_new";

-- Add new default
ALTER TABLE "Grade" ALTER COLUMN "validationStatus" SET DEFAULT 'DRAFT';

-- Drop the old enum
DROP TYPE "GradeValidationStatus";

-- Rename new enum to original name
ALTER TYPE "GradeValidationStatus_new" RENAME TO "GradeValidationStatus";