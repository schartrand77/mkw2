CREATE TABLE "PrintLabJob" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT,
    "paymentIntentId" TEXT,
    "sourceJobId" TEXT NOT NULL,
    "printLabJobId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_submission',
    "printerId" TEXT,
    "printerName" TEXT,
    "queueItemId" TEXT,
    "successfulGcodeId" TEXT,
    "modelId" TEXT NOT NULL,
    "modelName" TEXT,
    "modelUrl" TEXT,
    "downloadUrl" TEXT,
    "filePath" TEXT,
    "fileName" TEXT,
    "plateGcode" TEXT,
    "startAt" TIMESTAMP(3),
    "lastSubmittedAt" TIMESTAMP(3),
    "lastCallbackAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "submitAttempts" INTEGER NOT NULL DEFAULT 0,
    "callbackCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "metadata" JSONB,
    "lastCallbackPayload" JSONB,
    "history" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrintLabJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PrintLabJob_sourceJobId_key" ON "PrintLabJob"("sourceJobId");
CREATE UNIQUE INDEX "PrintLabJob_printLabJobId_key" ON "PrintLabJob"("printLabJobId");
CREATE UNIQUE INDEX "PrintLabJob_idempotencyKey_key" ON "PrintLabJob"("idempotencyKey");

CREATE INDEX "PrintLabJob_orderId_idx" ON "PrintLabJob"("orderId");
CREATE INDEX "PrintLabJob_orderItemId_idx" ON "PrintLabJob"("orderItemId");
CREATE INDEX "PrintLabJob_paymentIntentId_idx" ON "PrintLabJob"("paymentIntentId");
CREATE INDEX "PrintLabJob_status_idx" ON "PrintLabJob"("status");
CREATE INDEX "PrintLabJob_printerId_idx" ON "PrintLabJob"("printerId");
CREATE INDEX "PrintLabJob_createdAt_idx" ON "PrintLabJob"("createdAt");

ALTER TABLE "PrintLabJob"
ADD CONSTRAINT "PrintLabJob_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "PrintOrder"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PrintLabJob"
ADD CONSTRAINT "PrintLabJob_orderItemId_fkey"
FOREIGN KEY ("orderItemId") REFERENCES "PrintOrderItem"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
