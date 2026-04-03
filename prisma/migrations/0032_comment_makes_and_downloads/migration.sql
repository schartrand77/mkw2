-- Track make comments and download receipts for verified badges
ALTER TABLE "ModelComment" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'comment';
ALTER TABLE "ModelComment" ADD COLUMN "imagePath" TEXT;
ALTER TABLE "ModelComment" ADD COLUMN "imageWidth" INTEGER;
ALTER TABLE "ModelComment" ADD COLUMN "imageHeight" INTEGER;

CREATE TABLE "ModelDownload" (
  "id" TEXT NOT NULL,
  "modelId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ModelDownload_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ModelDownload_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ModelDownload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ModelDownload_modelId_userId_key" ON "ModelDownload"("modelId", "userId");
CREATE INDEX "ModelDownload_userId_idx" ON "ModelDownload"("userId");
