CREATE TABLE IF NOT EXISTS "Printer" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'available',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "dailyCapacityHours" DOUBLE PRECISION NOT NULL DEFAULT 8,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Printer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Printer_status_idx" ON "Printer"("status");
CREATE INDEX IF NOT EXISTS "Printer_active_idx" ON "Printer"("active");
