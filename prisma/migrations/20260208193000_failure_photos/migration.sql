CREATE TABLE "FailurePhoto" (
  "id" TEXT NOT NULL,
  "filePath" TEXT NOT NULL,
  "originalName" TEXT,
  "label" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION,
  "signals" JSONB,
  "note" TEXT,
  "sizeBytes" INTEGER,
  "width" INTEGER,
  "height" INTEGER,
  "orderId" TEXT,
  "printerId" TEXT,
  "modelId" TEXT,
  "uploadedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "FailurePhoto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FailurePhoto_label_idx" ON "FailurePhoto"("label");
CREATE INDEX "FailurePhoto_createdAt_idx" ON "FailurePhoto"("createdAt");
CREATE INDEX "FailurePhoto_orderId_idx" ON "FailurePhoto"("orderId");
CREATE INDEX "FailurePhoto_printerId_idx" ON "FailurePhoto"("printerId");
CREATE INDEX "FailurePhoto_modelId_idx" ON "FailurePhoto"("modelId");

ALTER TABLE "FailurePhoto"
ADD CONSTRAINT "FailurePhoto_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "PrintOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FailurePhoto"
ADD CONSTRAINT "FailurePhoto_printerId_fkey"
FOREIGN KEY ("printerId") REFERENCES "Printer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FailurePhoto"
ADD CONSTRAINT "FailurePhoto_modelId_fkey"
FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FailurePhoto"
ADD CONSTRAINT "FailurePhoto_uploadedById_fkey"
FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
