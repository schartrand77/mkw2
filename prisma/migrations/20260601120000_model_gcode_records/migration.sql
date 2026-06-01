-- Store PrintLab successful G-code captures against MakerWorks catalog models.
CREATE TABLE "ModelGcode" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "printLabRecordId" TEXT NOT NULL,
    "printLabJobId" TEXT,
    "printerId" TEXT,
    "printerName" TEXT,
    "modelName" TEXT,
    "modelKey" TEXT,
    "fileName" TEXT,
    "filePath" TEXT,
    "plateGcode" TEXT,
    "plateIndex" TEXT,
    "subtaskName" TEXT,
    "useAms" BOOLEAN,
    "amsMapping" JSONB,
    "materialUsage" JSONB,
    "completedAt" TIMESTAMP(3),
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "payload" JSONB,

    CONSTRAINT "ModelGcode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ModelGcode_modelId_printLabRecordId_key" ON "ModelGcode"("modelId", "printLabRecordId");
CREATE INDEX "ModelGcode_modelId_completedAt_idx" ON "ModelGcode"("modelId", "completedAt");
CREATE INDEX "ModelGcode_printLabRecordId_idx" ON "ModelGcode"("printLabRecordId");

ALTER TABLE "ModelGcode" ADD CONSTRAINT "ModelGcode_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE CASCADE ON UPDATE CASCADE;
