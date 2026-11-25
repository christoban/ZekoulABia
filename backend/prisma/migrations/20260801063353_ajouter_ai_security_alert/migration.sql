-- CreateTable
CREATE TABLE "AISecurityAlert" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "schoolId" TEXT,
    "refuseCount" INTEGER NOT NULL,
    "notifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AISecurityAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AISecurityAlert_actorUserId_notifiedAt_idx" ON "AISecurityAlert"("actorUserId", "notifiedAt");
