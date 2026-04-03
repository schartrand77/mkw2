-- Guarded migration: allow re-run on databases where some steps already applied.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VerificationToken_user_fkey') THEN
    EXECUTE 'ALTER TABLE "VerificationToken" DROP CONSTRAINT "VerificationToken_user_fkey"';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ModelImage_modelId_sortOrder_idx') THEN
    EXECUTE 'DROP INDEX "ModelImage_modelId_sortOrder_idx"';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'PrintOrder_reprintOfId_idx') THEN
    EXECUTE 'DROP INDEX "PrintOrder_reprintOfId_idx"';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'PrintOrder_status_idx') THEN
    EXECUTE 'DROP INDEX "PrintOrder_status_idx"';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'PrintOrder_userId_idx') THEN
    EXECUTE 'DROP INDEX "PrintOrder_userId_idx"';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'PrintOrderItem_orderId_idx') THEN
    EXECUTE 'DROP INDEX "PrintOrderItem_orderId_idx"';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'PrintOrderRevision_orderId_idx') THEN
    EXECUTE 'DROP INDEX "PrintOrderRevision_orderId_idx"';
  END IF;
END $$;

ALTER TABLE "Achievement" ALTER COLUMN "createdAt" SET NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

ALTER TABLE "JobForm" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "Model" ADD COLUMN IF NOT EXISTS "defaultColors" JSONB;

ALTER TABLE "ModelComment" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "ModelImage" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

ALTER TABLE "ModelPreviewJob" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "PrintOrder" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "PushSubscription" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "RateLimit" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "SiteConfig"
  DROP COLUMN IF EXISTS "heroSubtitle",
  DROP COLUMN IF EXISTS "heroTitle",
  ALTER COLUMN "showApplePayBadge" DROP NOT NULL,
  ALTER COLUMN "showGooglePayBadge" DROP NOT NULL;

ALTER TABLE "Tag" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "UserAchievement" ALTER COLUMN "awardedAt" SET NOT NULL,
ALTER COLUMN "awardedAt" SET DATA TYPE TIMESTAMP(3);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FeaturedModel_model_fkey')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FeaturedModel_modelId_fkey') THEN
    EXECUTE 'ALTER TABLE "FeaturedModel" RENAME CONSTRAINT "FeaturedModel_model_fkey" TO "FeaturedModel_modelId_fkey"';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Like_model_fkey')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Like_modelId_fkey') THEN
    EXECUTE 'ALTER TABLE "Like" RENAME CONSTRAINT "Like_model_fkey" TO "Like_modelId_fkey"';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Like_user_fkey')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Like_userId_fkey') THEN
    EXECUTE 'ALTER TABLE "Like" RENAME CONSTRAINT "Like_user_fkey" TO "Like_userId_fkey"';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ModelPart_model_fkey')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ModelPart_modelId_fkey') THEN
    EXECUTE 'ALTER TABLE "ModelPart" RENAME CONSTRAINT "ModelPart_model_fkey" TO "ModelPart_modelId_fkey"';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ModelTag_model_fkey')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ModelTag_modelId_fkey') THEN
    EXECUTE 'ALTER TABLE "ModelTag" RENAME CONSTRAINT "ModelTag_model_fkey" TO "ModelTag_modelId_fkey"';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ModelTag_tag_fkey')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ModelTag_tagId_fkey') THEN
    EXECUTE 'ALTER TABLE "ModelTag" RENAME CONSTRAINT "ModelTag_tag_fkey" TO "ModelTag_tagId_fkey"';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VerificationToken_userId_fkey') THEN
    EXECUTE 'ALTER TABLE "VerificationToken" ADD CONSTRAINT "VerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE';
  END IF;
END $$;