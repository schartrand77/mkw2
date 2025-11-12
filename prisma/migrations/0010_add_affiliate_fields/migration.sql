-- Add affiliate metadata fields for models
ALTER TABLE "Model"
ADD COLUMN "affiliateTitle" TEXT,
ADD COLUMN "affiliateUrl" TEXT;
