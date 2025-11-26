-- Add fields for sale price display metadata
ALTER TABLE "Model"
  ADD COLUMN "salePriceIsFrom" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "salePriceUnit" TEXT;
