-- DropForeignKey
ALTER TABLE "StudentProfile" DROP CONSTRAINT "StudentProfile_userId_fkey";

-- DropForeignKey
ALTER TABLE "TransferAuditEvent" DROP CONSTRAINT "TransferAuditEvent_actorSchoolId_fkey";

-- DropForeignKey
ALTER TABLE "TransferAuditEvent" DROP CONSTRAINT "TransferAuditEvent_actorUserId_fkey";

-- DropForeignKey
ALTER TABLE "TransferAuditEvent" DROP CONSTRAINT "TransferAuditEvent_sourceSchoolId_fkey";

-- DropForeignKey
ALTER TABLE "TransferAuditEvent" DROP CONSTRAINT "TransferAuditEvent_targetSchoolId_fkey";

-- DropForeignKey
ALTER TABLE "TransferAuditEvent" DROP CONSTRAINT "TransferAuditEvent_transferRequestId_fkey";

-- DropForeignKey
ALTER TABLE "TransferConsent" DROP CONSTRAINT "TransferConsent_transferRequestId_fkey";

-- DropForeignKey
ALTER TABLE "TransferDossierAccessLog" DROP CONSTRAINT "TransferDossierAccessLog_schoolId_fkey";

-- DropForeignKey
ALTER TABLE "TransferDossierAccessLog" DROP CONSTRAINT "TransferDossierAccessLog_snapshotId_fkey";

-- DropForeignKey
ALTER TABLE "TransferDossierAccessLog" DROP CONSTRAINT "TransferDossierAccessLog_userId_fkey";

-- DropForeignKey
ALTER TABLE "TransferDossierSnapshot" DROP CONSTRAINT "TransferDossierSnapshot_transferRequestId_fkey";

-- DropForeignKey
ALTER TABLE "TransferRequest" DROP CONSTRAINT "TransferRequest_identityId_fkey";

-- DropForeignKey
ALTER TABLE "TransferRequest" DROP CONSTRAINT "TransferRequest_rejectedBy_fkey";

-- DropForeignKey
ALTER TABLE "TransferRequest" DROP CONSTRAINT "TransferRequest_requestedByUserId_fkey";

-- DropForeignKey
ALTER TABLE "TransferRequest" DROP CONSTRAINT "TransferRequest_sourceSchoolId_fkey";

-- DropForeignKey
ALTER TABLE "TransferRequest" DROP CONSTRAINT "TransferRequest_sourceStudentProfileId_fkey";

-- DropForeignKey
ALTER TABLE "TransferRequest" DROP CONSTRAINT "TransferRequest_targetSchoolId_fkey";

-- DropForeignKey
ALTER TABLE "TransferRequest" DROP CONSTRAINT "TransferRequest_targetStudentProfileId_fkey";

-- DropIndex
DROP INDEX "TransferConsent_tokenExpiresAt_consumedAt_idx";

-- CreateTable
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL,
    "outboundMessagingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferRequest" ADD CONSTRAINT "TransferRequest_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "StudentIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferRequest" ADD CONSTRAINT "TransferRequest_sourceSchoolId_fkey" FOREIGN KEY ("sourceSchoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferRequest" ADD CONSTRAINT "TransferRequest_targetSchoolId_fkey" FOREIGN KEY ("targetSchoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferRequest" ADD CONSTRAINT "TransferRequest_sourceStudentProfileId_fkey" FOREIGN KEY ("sourceStudentProfileId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferRequest" ADD CONSTRAINT "TransferRequest_targetStudentProfileId_fkey" FOREIGN KEY ("targetStudentProfileId") REFERENCES "StudentProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferRequest" ADD CONSTRAINT "TransferRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferRequest" ADD CONSTRAINT "TransferRequest_rejectedBy_fkey" FOREIGN KEY ("rejectedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferConsent" ADD CONSTRAINT "TransferConsent_transferRequestId_fkey" FOREIGN KEY ("transferRequestId") REFERENCES "TransferRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferDossierSnapshot" ADD CONSTRAINT "TransferDossierSnapshot_transferRequestId_fkey" FOREIGN KEY ("transferRequestId") REFERENCES "TransferRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferAuditEvent" ADD CONSTRAINT "TransferAuditEvent_transferRequestId_fkey" FOREIGN KEY ("transferRequestId") REFERENCES "TransferRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferAuditEvent" ADD CONSTRAINT "TransferAuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferAuditEvent" ADD CONSTRAINT "TransferAuditEvent_actorSchoolId_fkey" FOREIGN KEY ("actorSchoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferAuditEvent" ADD CONSTRAINT "TransferAuditEvent_sourceSchoolId_fkey" FOREIGN KEY ("sourceSchoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferAuditEvent" ADD CONSTRAINT "TransferAuditEvent_targetSchoolId_fkey" FOREIGN KEY ("targetSchoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferDossierAccessLog" ADD CONSTRAINT "TransferDossierAccessLog_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "TransferDossierSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferDossierAccessLog" ADD CONSTRAINT "TransferDossierAccessLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferDossierAccessLog" ADD CONSTRAINT "TransferDossierAccessLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
