ALTER TABLE "MerchItem"
  ADD COLUMN IF NOT EXISTS "sizeOptions" JSONB,
  ADD COLUMN IF NOT EXISTS "colorOptions" JSONB,
  ADD COLUMN IF NOT EXISTS "stockworksCategory" TEXT DEFAULT 'merch',
  ADD COLUMN IF NOT EXISTS "stockworksStatus" TEXT DEFAULT 'Active',
  ADD COLUMN IF NOT EXISTS "stockworksNotes" TEXT,
  ADD COLUMN IF NOT EXISTS "stockworksVariantMap" JSONB;

