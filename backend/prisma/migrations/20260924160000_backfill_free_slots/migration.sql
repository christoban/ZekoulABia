UPDATE "TimetableSlot"
SET "kind" = 'FREE'
WHERE "kind" = 'CLASS'
  AND "subjectId" IS NULL
  AND "teacherId" IS NULL
  AND "roomId" IS NULL;
