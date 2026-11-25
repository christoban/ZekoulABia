-- CreateTable
CREATE TABLE "HelpArticle" (
    "id" TEXT NOT NULL,
    "screenKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "relatedSelectors" JSONB,
    "role" TEXT[],
    "locale" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HelpArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantHelpQueryLog" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "screenKey" TEXT,
    "question" TEXT NOT NULL,
    "responseType" TEXT NOT NULL,
    "articleFound" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantHelpQueryLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HelpArticle_screenKey_locale_idx" ON "HelpArticle"("screenKey", "locale");

-- CreateIndex
CREATE INDEX "AssistantHelpQueryLog_schoolId_idx" ON "AssistantHelpQueryLog"("schoolId");

-- CreateIndex
CREATE INDEX "AssistantHelpQueryLog_screenKey_idx" ON "AssistantHelpQueryLog"("screenKey");

-- CreateIndex
CREATE INDEX "AssistantHelpQueryLog_createdAt_idx" ON "AssistantHelpQueryLog"("createdAt");
