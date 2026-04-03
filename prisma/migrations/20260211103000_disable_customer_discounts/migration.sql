ALTER TABLE "SiteConfig"
ADD COLUMN IF NOT EXISTS "disableCustomerDiscounts" BOOLEAN DEFAULT false;
