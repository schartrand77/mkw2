ALTER TABLE "MerchItem"
  ADD COLUMN IF NOT EXISTS "availability" TEXT NOT NULL DEFAULT 'in_stock';

CREATE TABLE IF NOT EXISTS "MerchNotifyRequest" (
  "id" TEXT NOT NULL,
  "merchItemId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "notifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MerchNotifyRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MerchNotifyRequest_merchItemId_fkey" FOREIGN KEY ("merchItemId") REFERENCES "MerchItem"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "MerchNotifyRequest_merchItemId_email_key" ON "MerchNotifyRequest"("merchItemId", "email");
CREATE INDEX IF NOT EXISTS "MerchNotifyRequest_merchItemId_notifiedAt_idx" ON "MerchNotifyRequest"("merchItemId", "notifiedAt");
CREATE INDEX IF NOT EXISTS "MerchNotifyRequest_createdAt_idx" ON "MerchNotifyRequest"("createdAt");
