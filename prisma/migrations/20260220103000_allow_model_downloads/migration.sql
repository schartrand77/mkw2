ALTER TABLE "SiteConfig"
  ADD COLUMN IF NOT EXISTS "allowModelDownloads" BOOLEAN DEFAULT true;

UPDATE "SiteConfig"
SET "allowModelDownloads" = true
WHERE "allowModelDownloads" IS NULL;
