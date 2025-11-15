-- AlterTable
ALTER TABLE "JobForm" ADD COLUMN     "lastAttemptAt" TIMESTAMP(3),
ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "webhookAttempts" INTEGER NOT NULL DEFAULT 0;
