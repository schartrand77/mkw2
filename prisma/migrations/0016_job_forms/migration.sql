-- CreateTable
CREATE TABLE "JobForm" (
    "id" TEXT NOT NULL,
    "paymentIntentId" TEXT NOT NULL,
    "userId" TEXT,
    "customerEmail" TEXT,
    "lineItems" JSONB NOT NULL,
    "shipping" JSONB,
    "metadata" JSONB,
    "totalCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobForm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobForm_paymentIntentId_key" ON "JobForm"("paymentIntentId");

-- AddForeignKey
ALTER TABLE "JobForm" ADD CONSTRAINT "JobForm_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
