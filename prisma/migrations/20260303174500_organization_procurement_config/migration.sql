ALTER TABLE "Organization"
ADD COLUMN IF NOT EXISTS "procurementConfig" JSONB;
