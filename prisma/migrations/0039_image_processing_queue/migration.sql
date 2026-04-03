ALTER TABLE "Model"
  ADD COLUMN IF NOT EXISTS "coverImageStatus" TEXT NOT NULL DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS "coverImageSourcePath" TEXT,
  ADD COLUMN IF NOT EXISTS "coverImageError" TEXT;

ALTER TABLE "ModelImage"
  ADD COLUMN IF NOT EXISTS "sourcePath" TEXT,
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS "error" TEXT;

ALTER TABLE "Profile"
  ADD COLUMN IF NOT EXISTS "avatarImageStatus" TEXT NOT NULL DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS "avatarImageSourcePath" TEXT,
  ADD COLUMN IF NOT EXISTS "avatarImageError" TEXT;

ALTER TABLE "ModelComment"
  ADD COLUMN IF NOT EXISTS "imageStatus" TEXT NOT NULL DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS "imageSourcePath" TEXT,
  ADD COLUMN IF NOT EXISTS "imageError" TEXT;

UPDATE "Model" SET "coverImageStatus" = 'ready' WHERE "coverImageStatus" IS NULL;
UPDATE "ModelImage" SET "status" = 'ready' WHERE "status" IS NULL;
UPDATE "Profile" SET "avatarImageStatus" = 'ready' WHERE "avatarImageStatus" IS NULL;
UPDATE "ModelComment" SET "imageStatus" = 'ready' WHERE "imageStatus" IS NULL;
