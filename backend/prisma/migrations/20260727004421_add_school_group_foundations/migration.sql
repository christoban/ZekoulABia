-- AlterTable
ALTER TABLE "School" ADD COLUMN     "groupId" TEXT;

-- CreateTable
CREATE TABLE "SchoolGroupOwner" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecret" TEXT,
    "mfaTempSecret" TEXT,
    "mfaRecoveryCodeHashes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mfaRecoveryCodeGeneratedAt" TIMESTAMP(3),
    "loginEmailOtpHash" TEXT,
    "loginEmailOtpExpiresAt" TIMESTAMP(3),
    "loginEmailOtpAttempts" INTEGER NOT NULL DEFAULT 0,
    "loginEmailOtpSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolGroupOwner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "planTier" TEXT NOT NULL DEFAULT 'ETABLISSEMENT_PLUS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SchoolGroupOwner_email_key" ON "SchoolGroupOwner"("email");

-- CreateIndex
CREATE INDEX "SchoolGroupOwner_loginEmailOtpExpiresAt_idx" ON "SchoolGroupOwner"("loginEmailOtpExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolGroup_ownerId_key" ON "SchoolGroup"("ownerId");

-- AddForeignKey
ALTER TABLE "SchoolGroup" ADD CONSTRAINT "SchoolGroup_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "SchoolGroupOwner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "School" ADD CONSTRAINT "School_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "SchoolGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
