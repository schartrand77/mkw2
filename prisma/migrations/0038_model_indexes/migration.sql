CREATE INDEX IF NOT EXISTS "Model_visibility_idx" ON "Model"("visibility");
CREATE INDEX IF NOT EXISTS "Model_createdAt_idx" ON "Model"("createdAt");
CREATE INDEX IF NOT EXISTS "Model_likes_idx" ON "Model"("likes");
CREATE INDEX IF NOT EXISTS "Model_downloads_idx" ON "Model"("downloads");
CREATE INDEX IF NOT EXISTS "Model_material_idx" ON "Model"("material");
CREATE INDEX IF NOT EXISTS "Tag_slug_idx" ON "Tag"("slug");
CREATE INDEX IF NOT EXISTS "ModelTag_tagId_idx" ON "ModelTag"("tagId");
