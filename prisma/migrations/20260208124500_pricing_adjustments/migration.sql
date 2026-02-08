ALTER TABLE "SiteConfig"
ADD COLUMN "demandSurgeMultiplier" DOUBLE PRECISION,
ADD COLUMN "rushMultiplier" DOUBLE PRECISION,
ADD COLUMN "batchDiscountTiers" JSONB;
