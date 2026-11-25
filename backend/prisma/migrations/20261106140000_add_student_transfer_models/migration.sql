CREATE TYPE "TransferRequestStatus" AS ENUM (
  'PENDING_GUARDIAN',
  'PENDING_SOURCE',
  'REFUSED_BY_GUARDIAN',
  'REFUSED_BY_SOURCE',
  'EXPIRED',
  'REVOKED',
  'APPROVED',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE "TransferConsenterType" AS ENUM ('GUARDIAN', 'ADULT_STUDENT');
CREATE TYPE "TransferConsentDecision" AS ENUM ('PENDING', 'ACCEPTED', 'REFUSED', 'REVOKED');
CREATE TYPE "TransferConsentChannel" AS ENUM ('LINK_OTP', 'ASSISTED_BY_STAFF');

CREATE TABLE "TransferRequest" (
  "id" TEXT NOT NULL,
  "identityId" TEXT NOT NULL,
  "sourceSchoolId" TEXT NOT NULL,
  "targetSchoolId" TEXT NOT NULL,
  "sourceStudentProfileId" TEXT NOT NULL,
  "targetStudentProfileId" TEXT,
  "requestedByUserId" TEXT NOT NULL,
  "academicYearTarget" TEXT NOT NULL,
  "status" "TransferRequestStatus" NOT NULL DEFAULT 'PENDING_GUARDIAN',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "guardianDecisionAt" TIMESTAMP(3),
  "sourceDecisionAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "parentExpiresAt" TIMESTAMP(3) NOT NULL,
  "sourceAutoApprovalAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "rejectedBy" TEXT,
  CONSTRAINT "TransferRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TransferRequest_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "StudentIdentity"("id"),
  CONSTRAINT "TransferRequest_sourceSchoolId_fkey" FOREIGN KEY ("sourceSchoolId") REFERENCES "School"("id"),
  CONSTRAINT "TransferRequest_targetSchoolId_fkey" FOREIGN KEY ("targetSchoolId") REFERENCES "School"("id"),
  CONSTRAINT "TransferRequest_sourceStudentProfileId_fkey" FOREIGN KEY ("sourceStudentProfileId") REFERENCES "StudentProfile"("id"),
  CONSTRAINT "TransferRequest_targetStudentProfileId_fkey" FOREIGN KEY ("targetStudentProfileId") REFERENCES "StudentProfile"("id"),
  CONSTRAINT "TransferRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id"),
  CONSTRAINT "TransferRequest_rejectedBy_fkey" FOREIGN KEY ("rejectedBy") REFERENCES "User"("id")
);

CREATE INDEX "TransferRequest_sourceSchoolId_status_idx" ON "TransferRequest"("sourceSchoolId", "status");
CREATE INDEX "TransferRequest_targetSchoolId_status_idx" ON "TransferRequest"("targetSchoolId", "status");
CREATE INDEX "TransferRequest_identityId_status_idx" ON "TransferRequest"("identityId", "status");
CREATE INDEX "TransferRequest_parentExpiresAt_status_idx" ON "TransferRequest"("parentExpiresAt", "status");
CREATE UNIQUE INDEX "TransferRequest_identityId_active_key"
  ON "TransferRequest"("identityId")
  WHERE "status" NOT IN ('REFUSED_BY_GUARDIAN', 'REFUSED_BY_SOURCE', 'EXPIRED', 'REVOKED', 'COMPLETED', 'CANCELLED');

CREATE TABLE "TransferConsent" (
  "id" TEXT NOT NULL,
  "transferRequestId" TEXT NOT NULL,
  "consenterType" "TransferConsenterType" NOT NULL,
  "consenterRef" TEXT NOT NULL,
  "decision" "TransferConsentDecision" NOT NULL DEFAULT 'PENDING',
  "channel" "TransferConsentChannel" NOT NULL,
  "decidedAt" TIMESTAMP(3),
  "consentTextVersion" TEXT NOT NULL,
  "scopeAccepted" BOOLEAN NOT NULL,
  "ipAddress" TEXT,
  CONSTRAINT "TransferConsent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TransferConsent_transferRequestId_fkey" FOREIGN KEY ("transferRequestId") REFERENCES "TransferRequest"("id") ON DELETE CASCADE
);

CREATE INDEX "TransferConsent_transferRequestId_decision_idx" ON "TransferConsent"("transferRequestId", "decision");

CREATE TABLE "TransferDossierSnapshot" (
  "id" TEXT NOT NULL,
  "transferRequestId" TEXT NOT NULL,
  "payloadEncrypted" TEXT NOT NULL,
  "schemaVersion" TEXT NOT NULL,
  "categories" TEXT[] NOT NULL,
  "checksum" TEXT NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleteAfter" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TransferDossierSnapshot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TransferDossierSnapshot_transferRequestId_key" UNIQUE ("transferRequestId"),
  CONSTRAINT "TransferDossierSnapshot_transferRequestId_fkey" FOREIGN KEY ("transferRequestId") REFERENCES "TransferRequest"("id") ON DELETE CASCADE
);

CREATE INDEX "TransferDossierSnapshot_deleteAfter_idx" ON "TransferDossierSnapshot"("deleteAfter");

CREATE TABLE "TransferAuditEvent" (
  "id" TEXT NOT NULL,
  "transferRequestId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "actorUserId" TEXT,
  "actorSchoolId" TEXT NOT NULL,
  "sourceSchoolId" TEXT NOT NULL,
  "targetSchoolId" TEXT NOT NULL,
  "stateBefore" TEXT NOT NULL,
  "stateAfter" TEXT NOT NULL,
  "metadata" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TransferAuditEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TransferAuditEvent_transferRequestId_fkey" FOREIGN KEY ("transferRequestId") REFERENCES "TransferRequest"("id"),
  CONSTRAINT "TransferAuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id"),
  CONSTRAINT "TransferAuditEvent_actorSchoolId_fkey" FOREIGN KEY ("actorSchoolId") REFERENCES "School"("id"),
  CONSTRAINT "TransferAuditEvent_sourceSchoolId_fkey" FOREIGN KEY ("sourceSchoolId") REFERENCES "School"("id"),
  CONSTRAINT "TransferAuditEvent_targetSchoolId_fkey" FOREIGN KEY ("targetSchoolId") REFERENCES "School"("id")
);

CREATE INDEX "TransferAuditEvent_transferRequestId_createdAt_idx" ON "TransferAuditEvent"("transferRequestId", "createdAt");
CREATE INDEX "TransferAuditEvent_actorSchoolId_createdAt_idx" ON "TransferAuditEvent"("actorSchoolId", "createdAt");

CREATE OR REPLACE FUNCTION prevent_transfer_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'TransferAuditEvent est append-only';
END;
$$;

CREATE TRIGGER "TransferAuditEvent_append_only"
BEFORE UPDATE OR DELETE ON "TransferAuditEvent"
FOR EACH ROW EXECUTE FUNCTION prevent_transfer_audit_mutation();

CREATE TABLE "TransferDossierAccessLog" (
  "id" TEXT NOT NULL,
  "snapshotId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "accessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TransferDossierAccessLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TransferDossierAccessLog_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "TransferDossierSnapshot"("id") ON DELETE CASCADE,
  CONSTRAINT "TransferDossierAccessLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id"),
  CONSTRAINT "TransferDossierAccessLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id")
);

CREATE INDEX "TransferDossierAccessLog_snapshotId_accessedAt_idx" ON "TransferDossierAccessLog"("snapshotId", "accessedAt");
CREATE INDEX "TransferDossierAccessLog_schoolId_userId_accessedAt_idx" ON "TransferDossierAccessLog"("schoolId", "userId", "accessedAt");
