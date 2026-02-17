ALTER TABLE "ProductTemplate"
  ADD COLUMN IF NOT EXISTS "stockworksCategory" TEXT DEFAULT 'models',
  ADD COLUMN IF NOT EXISTS "stockworksSku" TEXT,
  ADD COLUMN IF NOT EXISTS "stockworksDesigner" TEXT,
  ADD COLUMN IF NOT EXISTS "stockworksMarketplace" TEXT,
  ADD COLUMN IF NOT EXISTS "stockworksFileLocation" TEXT,
  ADD COLUMN IF NOT EXISTS "stockworksVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "stockworksUnitPriceUsd" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "stockworksStatus" TEXT DEFAULT 'Active',
  ADD COLUMN IF NOT EXISTS "stockworksNotes" TEXT;
