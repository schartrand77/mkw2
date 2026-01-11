CREATE TABLE IF NOT EXISTS "ModelRevision" (
  "id" TEXT NOT NULL,
  "modelId" TEXT NOT NULL,
  "userId" TEXT,
  "label" TEXT,
  "note" TEXT,
  "filePath" TEXT NOT NULL,
  "viewerFilePath" TEXT,
  "fileType" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ModelRevision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ModelRevisionPart" (
  "id" TEXT NOT NULL,
  "revisionId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "index" INTEGER NOT NULL DEFAULT 0,
  "filePath" TEXT NOT NULL,
  "previewFilePath" TEXT,
  "volumeMm3" DOUBLE PRECISION,
  "sizeXmm" DOUBLE PRECISION,
  "sizeYmm" DOUBLE PRECISION,
  "sizeZmm" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ModelRevisionPart_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ModelRevision_modelId_idx" ON "ModelRevision"("modelId");
CREATE INDEX IF NOT EXISTS "ModelRevision_createdAt_idx" ON "ModelRevision"("createdAt");
CREATE INDEX IF NOT EXISTS "ModelRevisionPart_revisionId_idx" ON "ModelRevisionPart"("revisionId");

ALTER TABLE "ModelRevision"
  ADD CONSTRAINT "ModelRevision_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ModelRevision"
  ADD CONSTRAINT "ModelRevision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ModelRevisionPart"
  ADD CONSTRAINT "ModelRevisionPart_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "ModelRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
