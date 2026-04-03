ALTER TABLE "SiteConfig"
  ADD COLUMN IF NOT EXISTS "productsModelsLabel" TEXT,
  ADD COLUMN IF NOT EXISTS "productsMerchLabel" TEXT;

CREATE TABLE IF NOT EXISTS "MerchItem" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT NOT NULL DEFAULT 'Merch',
  "priceUsd" DOUBLE PRECISION,
  "imageUrl" TEXT,
  "externalUrl" TEXT,
  "ctaLabel" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MerchItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MerchItem_isActive_idx" ON "MerchItem"("isActive");
CREATE INDEX IF NOT EXISTS "MerchItem_category_idx" ON "MerchItem"("category");
CREATE INDEX IF NOT EXISTS "MerchItem_sortOrder_idx" ON "MerchItem"("sortOrder");
