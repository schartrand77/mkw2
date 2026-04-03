ALTER TABLE "Model"
ADD COLUMN IF NOT EXISTS "disableCustomerDiscounts" BOOLEAN DEFAULT false;
