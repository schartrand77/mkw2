CREATE TABLE IF NOT EXISTS "AdminAuditEvent" (
  "id" TEXT NOT NULL,
  "adminId" TEXT,
  "adminEmail" TEXT,
  "adminName" TEXT,
  "action" TEXT NOT NULL,
  "targetType" TEXT,
  "targetId" TEXT,
  "requestMethod" TEXT NOT NULL,
  "requestPath" TEXT NOT NULL,
  "requestIp" TEXT,
  "userAgent" TEXT,
  "metadata" JSONB,
  "prevHash" TEXT,
  "eventHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AdminAuditEvent_eventHash_key" ON "AdminAuditEvent"("eventHash");
CREATE INDEX IF NOT EXISTS "AdminAuditEvent_adminId_idx" ON "AdminAuditEvent"("adminId");
CREATE INDEX IF NOT EXISTS "AdminAuditEvent_action_idx" ON "AdminAuditEvent"("action");
CREATE INDEX IF NOT EXISTS "AdminAuditEvent_createdAt_idx" ON "AdminAuditEvent"("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AdminAuditEvent_adminId_fkey'
  ) THEN
    ALTER TABLE "AdminAuditEvent"
      ADD CONSTRAINT "AdminAuditEvent_adminId_fkey"
      FOREIGN KEY ("adminId")
      REFERENCES "User"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;
