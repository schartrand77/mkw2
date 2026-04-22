-- Persist Stripe invoice references for deferred invoice checkout.
ALTER TABLE "PrintOrder" ADD COLUMN "stripeInvoiceId" TEXT;
ALTER TABLE "PrintOrder" ADD COLUMN "hostedInvoiceUrl" TEXT;
ALTER TABLE "PrintOrder" ADD COLUMN "invoicePdfUrl" TEXT;

CREATE UNIQUE INDEX "PrintOrder_stripeInvoiceId_key" ON "PrintOrder"("stripeInvoiceId");
