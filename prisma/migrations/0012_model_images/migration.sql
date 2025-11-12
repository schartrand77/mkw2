-- Gallery images for models
CREATE TABLE "ModelImage" (
  "id" TEXT PRIMARY KEY,
  "modelId" TEXT NOT NULL,
  "filePath" TEXT NOT NULL,
  "caption" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ModelImage_modelId_fkey"
    FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ModelImage_modelId_sortOrder_idx" ON "ModelImage"("modelId", "sortOrder");
