ALTER TABLE "Model"
ADD COLUMN IF NOT EXISTS "effectivePriceUsd" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "effectivePriceUpdatedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Model_effectivePriceUsd_idx" ON "Model"("effectivePriceUsd");

UPDATE "Model"
SET "effectivePriceUsd" = COALESCE("salePriceUsd", "priceUsd"),
    "effectivePriceUpdatedAt" = NOW()
WHERE "effectivePriceUsd" IS NULL;
