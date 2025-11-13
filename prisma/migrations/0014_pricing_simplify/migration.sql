ALTER TABLE "SiteConfig"
  DROP COLUMN IF EXISTS "costPerCm3",
  DROP COLUMN IF EXISTS "fixedFeeUsd",
  DROP COLUMN IF EXISTS "materialPlaMultiplier",
  DROP COLUMN IF EXISTS "materialAbsMultiplier",
  DROP COLUMN IF EXISTS "materialPetgMultiplier",
  DROP COLUMN IF EXISTS "materialResinMultiplier";

ALTER TABLE "SiteConfig"
  ADD COLUMN IF NOT EXISTS "plaPricePerKgUsd" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "petgPricePerKgUsd" DOUBLE PRECISION;
