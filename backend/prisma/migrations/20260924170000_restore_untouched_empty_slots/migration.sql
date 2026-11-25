UPDATE "TimetableSlot"
SET "kind" = 'CLASS'
WHERE "kind" = 'FREE'
  AND "managedBySolver" = false
  AND "subjectId" IS NULL
  AND "teacherId" IS NULL
  AND "roomId" IS NULL;
