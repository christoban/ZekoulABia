-- AlterTable
ALTER TABLE "SchoolStatisticalSupplement" ADD COLUMN     "manuelsDetail" JSONB,
ADD COLUMN     "themesTransversauxDetail" JSONB;

-- CreateTable
CREATE TABLE "SchoolTemplateVersion" (
    "id" TEXT NOT NULL,
    "templateCode" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "config" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolTemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SchoolTemplateVersion_templateCode_version_key" ON "SchoolTemplateVersion"("templateCode", "version");

-- AddForeignKey
ALTER TABLE "SchoolTemplateVersion" ADD CONSTRAINT "SchoolTemplateVersion_templateCode_fkey" FOREIGN KEY ("templateCode") REFERENCES "SchoolTemplate"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
