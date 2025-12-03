-- CreateEnum
CREATE TYPE "FulfillmentStatus" AS ENUM ('pending', 'ready', 'picked_up', 'shipped');

-- AlterTable
ALTER TABLE "JobForm"
  ADD COLUMN "payment_method" TEXT,
  ADD COLUMN "payment_status" TEXT,
  ADD COLUMN "fulfillment_status" "FulfillmentStatus" NOT NULL DEFAULT 'pending',
  ADD COLUMN "fulfilled_at" TIMESTAMP(3);
