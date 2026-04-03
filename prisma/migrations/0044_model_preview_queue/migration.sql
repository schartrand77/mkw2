CREATE TABLE "ModelPreviewJob" (
  "id" TEXT NOT NULL,
  "modelId" TEXT NOT NULL,
  "partId" TEXT,
  "sourcePath" TEXT NOT NULL,
  "previewPath" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ModelPreviewJob_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ModelPreviewJob"
  ADD CONSTRAINT "ModelPreviewJob_modelId_fkey"
  FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ModelPreviewJob"
  ADD CONSTRAINT "ModelPreviewJob_partId_fkey"
  FOREIGN KEY ("partId") REFERENCES "ModelPart"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ModelPreviewJob_status_idx" ON "ModelPreviewJob"("status");
CREATE INDEX "ModelPreviewJob_createdAt_idx" ON "ModelPreviewJob"("createdAt");
CREATE INDEX "ModelPreviewJob_modelId_idx" ON "ModelPreviewJob"("modelId");
