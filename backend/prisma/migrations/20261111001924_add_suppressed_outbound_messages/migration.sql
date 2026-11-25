-- CreateTable
CREATE TABLE "SuppressedOutboundMessage" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "recipientMasked" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuppressedOutboundMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SuppressedOutboundMessage_createdAt_idx" ON "SuppressedOutboundMessage"("createdAt");
