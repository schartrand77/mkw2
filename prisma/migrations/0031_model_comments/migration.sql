-- Add table for per-model comments posted by users
CREATE TABLE "ModelComment" (
  "id" TEXT NOT NULL,
  "modelId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ModelComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ModelComment_modelId_idx" ON "ModelComment"("modelId");
CREATE INDEX "ModelComment_userId_idx" ON "ModelComment"("userId");

ALTER TABLE "ModelComment" ADD CONSTRAINT "ModelComment_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModelComment" ADD CONSTRAINT "ModelComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
