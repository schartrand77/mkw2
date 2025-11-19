ALTER TABLE "SiteConfig"
  ALTER COLUMN "manualLaborHours" SET DEFAULT 0;

UPDATE "SiteConfig"
SET "manualLaborHours" = 0
WHERE "manualLaborHours" IS NULL OR "manualLaborHours" = 1;
