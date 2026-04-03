CREATE TABLE "ProductTemplate" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "baseModelId" TEXT,
  "materialOptions" JSONB,
  "colorOptions" JSONB,
  "sizeOptions" JSONB,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProductTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductTemplate_isActive_idx" ON "ProductTemplate"("isActive");
CREATE INDEX "ProductTemplate_createdAt_idx" ON "ProductTemplate"("createdAt");

ALTER TABLE "ProductTemplate"
ADD CONSTRAINT "ProductTemplate_baseModelId_fkey"
FOREIGN KEY ("baseModelId") REFERENCES "Model"("id") ON DELETE SET NULL ON UPDATE CASCADE;
