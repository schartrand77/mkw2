-- Add machine/labor hourly rates and pricing profiles
ALTER TABLE "SiteConfig" ADD COLUMN IF NOT EXISTS "machineUsdPerHour" DOUBLE PRECISION;
ALTER TABLE "SiteConfig" ADD COLUMN IF NOT EXISTS "laborUsdPerHour" DOUBLE PRECISION;

CREATE TABLE IF NOT EXISTS "PricingProfile" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "data" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PricingProfile_pkey" PRIMARY KEY ("id")
);
