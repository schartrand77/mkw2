ALTER TABLE "SiteConfig"
ADD COLUMN IF NOT EXISTS "printerProfileKey" TEXT,
ADD COLUMN IF NOT EXISTS "printerProfileOverrides" JSONB;

ALTER TABLE "Model"
RENAME COLUMN "priceOverrideUsd" TO "salePriceUsd";
