-- Add durable Stripe references for payment reconciliation, refunds, and webhook idempotency.
ALTER TABLE "User" ADD COLUMN "stripeCustomerId" TEXT;

ALTER TABLE "PrintOrder" ADD COLUMN "paymentStatus" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "PrintOrder" ADD COLUMN "stripePaymentIntentId" TEXT;
ALTER TABLE "PrintOrder" ADD COLUMN "stripeChargeId" TEXT;
ALTER TABLE "PrintOrder" ADD COLUMN "stripeCustomerId" TEXT;
ALTER TABLE "PrintOrder" ADD COLUMN "refundedCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PrintOrder" ADD COLUMN "receiptUrl" TEXT;

CREATE TABLE "StripeEvent" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "paymentIntentId" TEXT,
  "payload" JSONB,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StripeEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");
CREATE UNIQUE INDEX "PrintOrder_stripePaymentIntentId_key" ON "PrintOrder"("stripePaymentIntentId");
CREATE INDEX "PrintOrder_stripeCustomerId_idx" ON "PrintOrder"("stripeCustomerId");
CREATE INDEX "PrintOrder_paymentStatus_idx" ON "PrintOrder"("paymentStatus");
CREATE INDEX "StripeEvent_type_idx" ON "StripeEvent"("type");
CREATE INDEX "StripeEvent_paymentIntentId_idx" ON "StripeEvent"("paymentIntentId");
