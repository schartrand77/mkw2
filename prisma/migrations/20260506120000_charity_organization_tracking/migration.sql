-- Track charity/community organization classifications and contributed production work.
ALTER TABLE "Organization"
  ADD COLUMN "category" TEXT NOT NULL DEFAULT 'customer',
  ADD COLUMN "charitableRegistrationNumber" TEXT,
  ADD COLUMN "communityNotes" TEXT;

ALTER TABLE "PrintOrder"
  ADD COLUMN "contributionType" TEXT NOT NULL DEFAULT 'paid',
  ADD COLUMN "donatedAmountCents" INTEGER,
  ADD COLUMN "materialCostCents" INTEGER,
  ADD COLUMN "machineTimeMinutes" INTEGER,
  ADD COLUMN "receiptStatus" TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN "contributionNotes" TEXT;

CREATE INDEX "Organization_category_idx" ON "Organization"("category");
CREATE INDEX "PrintOrder_contributionType_idx" ON "PrintOrder"("contributionType");
CREATE INDEX "PrintOrder_receiptStatus_idx" ON "PrintOrder"("receiptStatus");
