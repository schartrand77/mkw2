ALTER TABLE "ProductTemplate"
  ADD COLUMN IF NOT EXISTS "stockworksVariantMap" JSONB;
