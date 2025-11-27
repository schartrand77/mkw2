-- Create tables to store customer-facing order data and revision uploads
CREATE TABLE "PrintOrder" (
  "id" TEXT NOT NULL,
  "orderNumber" SERIAL NOT NULL,
  "userId" TEXT,
  "customerEmail" TEXT,
  "customerName" TEXT,
  "status" TEXT NOT NULL DEFAULT 'awaiting_review',
  "paymentMethod" TEXT NOT NULL DEFAULT 'card',
  "shippingMethod" TEXT NOT NULL DEFAULT 'pickup',
  "shippingAddress" JSONB,
  "subtotalCents" INTEGER NOT NULL,
  "discountPercent" DOUBLE PRECISION,
  "totalCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "notes" TEXT,
  "metadata" JSONB,
  "reprintOfId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "PrintOrderItem" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "modelId" TEXT,
  "modelTitle" TEXT NOT NULL,
  "partId" TEXT,
  "partName" TEXT,
  "material" TEXT NOT NULL,
  "colors" JSONB,
  "infillPct" INTEGER,
  "finish" TEXT,
  "customNotes" TEXT,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unitPriceCents" INTEGER NOT NULL,
  "totalCents" INTEGER NOT NULL,
  "configuration" JSONB,
  "thumbnailPath" TEXT,
  "viewerPath" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "PrintOrderRevision" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "userId" TEXT,
  "label" TEXT,
  "note" TEXT,
  "filePath" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "PrintOrder"
  ADD CONSTRAINT "PrintOrder_pkey" PRIMARY KEY ("id"),
  ADD CONSTRAINT "PrintOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "PrintOrder_reprintOfId_fkey" FOREIGN KEY ("reprintOfId") REFERENCES "PrintOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PrintOrderItem"
  ADD CONSTRAINT "PrintOrderItem_pkey" PRIMARY KEY ("id"),
  ADD CONSTRAINT "PrintOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PrintOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PrintOrderRevision"
  ADD CONSTRAINT "PrintOrderRevision_pkey" PRIMARY KEY ("id"),
  ADD CONSTRAINT "PrintOrderRevision_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PrintOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "PrintOrderRevision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "PrintOrder_orderNumber_key" ON "PrintOrder" ("orderNumber");
CREATE INDEX "PrintOrder_userId_idx" ON "PrintOrder" ("userId");
CREATE INDEX "PrintOrder_status_idx" ON "PrintOrder" ("status");
CREATE INDEX "PrintOrder_reprintOfId_idx" ON "PrintOrder" ("reprintOfId");
CREATE INDEX "PrintOrderItem_orderId_idx" ON "PrintOrderItem" ("orderId");
CREATE INDEX "PrintOrderRevision_orderId_idx" ON "PrintOrderRevision" ("orderId");
