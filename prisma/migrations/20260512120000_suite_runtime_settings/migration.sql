CREATE TABLE "RuntimeSetting" (
  "key" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "value" TEXT,
  "secret" BOOLEAN NOT NULL DEFAULT false,
  "source" TEXT NOT NULL DEFAULT 'database',
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RuntimeSetting_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "RuntimeSetting_category_idx" ON "RuntimeSetting"("category");
CREATE INDEX "RuntimeSetting_updatedAt_idx" ON "RuntimeSetting"("updatedAt");
