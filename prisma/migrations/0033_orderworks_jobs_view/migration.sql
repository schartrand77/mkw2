CREATE OR REPLACE VIEW "jobs" AS
SELECT
  "id",
  "paymentIntentId",
  "totalCents",
  "currency",
  "lineItems",
  "shipping",
  "metadata",
  "userId",
  "customerEmail",
  "createdAt" AS "makerworks_created_at",
  "updatedAt" AS "updatedAt",
  'pending'::text AS "status",
  NULL::text AS "notes"
FROM "JobForm";
