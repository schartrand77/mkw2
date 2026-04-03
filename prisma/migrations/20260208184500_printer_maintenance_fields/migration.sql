ALTER TABLE "Printer" ADD COLUMN "lastMaintenanceAt" TIMESTAMP(3);
ALTER TABLE "Printer" ADD COLUMN "maintenanceIntervalHours" DOUBLE PRECISION;
ALTER TABLE "Printer" ADD COLUMN "maintenanceNotes" TEXT;
