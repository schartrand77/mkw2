CREATE TABLE "CustomerPreset" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CustomerPreset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomerPreset_userId_idx" ON "CustomerPreset"("userId");
CREATE INDEX "CustomerPreset_createdAt_idx" ON "CustomerPreset"("createdAt");

ALTER TABLE "CustomerPreset"
ADD CONSTRAINT "CustomerPreset_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SiteConfig" ADD COLUMN "minimumOrderSubtotalUsd" DOUBLE PRECISION;
ALTER TABLE "SiteConfig" ADD COLUMN "minimumOrderNotes" TEXT;
