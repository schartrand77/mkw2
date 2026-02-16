ALTER TABLE "ModelComment"
ADD COLUMN "isHomeCurated" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "ModelComment_isHomeCurated_createdAt_idx"
ON "ModelComment"("isHomeCurated", "createdAt");
