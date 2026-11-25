-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "restrictedToGroupId" TEXT;

-- AlterTable
ALTER TABLE "TimetableSlot" ADD COLUMN     "groupId" TEXT;

-- CreateTable
CREATE TABLE "StudentGroupSet" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentGroupSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentGroup" (
    "id" TEXT NOT NULL,
    "groupSetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subjectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentGroupMembership" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "groupSetId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentGroupMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassRoomAssignment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassRoomAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentGroupSet_schoolId_idx" ON "StudentGroupSet"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentGroupSet_schoolId_code_key" ON "StudentGroupSet"("schoolId", "code");

-- CreateIndex
CREATE INDEX "StudentGroup_subjectId_idx" ON "StudentGroup"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentGroup_groupSetId_name_key" ON "StudentGroup"("groupSetId", "name");

-- CreateIndex
CREATE INDEX "StudentGroupMembership_groupId_idx" ON "StudentGroupMembership"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentGroupMembership_studentProfileId_groupSetId_academic_key" ON "StudentGroupMembership"("studentProfileId", "groupSetId", "academicYearId");

-- CreateIndex
CREATE INDEX "ClassRoomAssignment_schoolId_idx" ON "ClassRoomAssignment"("schoolId");

-- CreateIndex
CREATE INDEX "ClassRoomAssignment_roomId_idx" ON "ClassRoomAssignment"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassRoomAssignment_classId_academicYearId_key" ON "ClassRoomAssignment"("classId", "academicYearId");

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_restrictedToGroupId_fkey" FOREIGN KEY ("restrictedToGroupId") REFERENCES "StudentGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGroupSet" ADD CONSTRAINT "StudentGroupSet_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGroup" ADD CONSTRAINT "StudentGroup_groupSetId_fkey" FOREIGN KEY ("groupSetId") REFERENCES "StudentGroupSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGroup" ADD CONSTRAINT "StudentGroup_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGroupMembership" ADD CONSTRAINT "StudentGroupMembership_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGroupMembership" ADD CONSTRAINT "StudentGroupMembership_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "StudentGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGroupMembership" ADD CONSTRAINT "StudentGroupMembership_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassRoomAssignment" ADD CONSTRAINT "ClassRoomAssignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassRoomAssignment" ADD CONSTRAINT "ClassRoomAssignment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassRoomAssignment" ADD CONSTRAINT "ClassRoomAssignment_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassRoomAssignment" ADD CONSTRAINT "ClassRoomAssignment_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "StudentGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
