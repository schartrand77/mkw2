-- Printer integration fields
ALTER TABLE "Printer" ADD COLUMN IF NOT EXISTS "provider" TEXT NOT NULL DEFAULT 'local';
ALTER TABLE "Printer" ADD COLUMN IF NOT EXISTS "externalId" TEXT;
ALTER TABLE "Printer" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
ALTER TABLE "Printer" ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3);

ALTER TABLE "PrintOrder" ADD COLUMN IF NOT EXISTS "printerId" TEXT;
ALTER TABLE "PrintOrder" ADD COLUMN IF NOT EXISTS "printerAssignedAt" TIMESTAMP(3);
ALTER TABLE "PrintOrder" ADD COLUMN IF NOT EXISTS "printerAssignedBy" TEXT;
ALTER TABLE "PrintOrder" ADD COLUMN IF NOT EXISTS "failedAt" TIMESTAMP(3);
ALTER TABLE "PrintOrder" ADD COLUMN IF NOT EXISTS "failureNote" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'PrintOrder_printerId_fkey'
  ) THEN
    ALTER TABLE "PrintOrder"
      ADD CONSTRAINT "PrintOrder_printerId_fkey"
      FOREIGN KEY ("printerId") REFERENCES "Printer"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
