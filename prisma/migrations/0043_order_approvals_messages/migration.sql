-- Add order messages and approval requests
CREATE TABLE "PrintOrderMessage" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "userId" TEXT,
  "senderRole" TEXT NOT NULL DEFAULT 'shop',
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrintOrderMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PrintOrderApprovalRequest" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "requestedById" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "message" TEXT NOT NULL,
  "responseNote" TEXT,
  "respondedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrintOrderApprovalRequest_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PrintOrderMessage"
  ADD CONSTRAINT "PrintOrderMessage_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "PrintOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PrintOrderMessage"
  ADD CONSTRAINT "PrintOrderMessage_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PrintOrderApprovalRequest"
  ADD CONSTRAINT "PrintOrderApprovalRequest_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "PrintOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PrintOrderApprovalRequest"
  ADD CONSTRAINT "PrintOrderApprovalRequest_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "PrintOrderMessage_orderId_idx" ON "PrintOrderMessage"("orderId");
CREATE INDEX "PrintOrderMessage_createdAt_idx" ON "PrintOrderMessage"("createdAt");
CREATE INDEX "PrintOrderApprovalRequest_orderId_idx" ON "PrintOrderApprovalRequest"("orderId");
CREATE INDEX "PrintOrderApprovalRequest_status_idx" ON "PrintOrderApprovalRequest"("status");
CREATE INDEX "PrintOrderApprovalRequest_createdAt_idx" ON "PrintOrderApprovalRequest"("createdAt");
