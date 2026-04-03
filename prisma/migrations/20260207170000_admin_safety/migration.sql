-- Add user roles and config change audit log
DO $$ BEGIN
  CREATE TYPE "UserRole" AS ENUM ('admin', 'staff', 'customer');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" "UserRole" NOT NULL DEFAULT 'customer';
UPDATE "User" SET "role" = 'admin' WHERE "isAdmin" = TRUE;

CREATE TABLE IF NOT EXISTS "ConfigChangeLog" (
  "id" TEXT NOT NULL,
  "adminId" TEXT NOT NULL,
  "section" TEXT NOT NULL,
  "changes" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ConfigChangeLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ConfigChangeLog_adminId_idx" ON "ConfigChangeLog"("adminId");
CREATE INDEX IF NOT EXISTS "ConfigChangeLog_createdAt_idx" ON "ConfigChangeLog"("createdAt");
CREATE INDEX IF NOT EXISTS "ConfigChangeLog_section_idx" ON "ConfigChangeLog"("section");

ALTER TABLE "ConfigChangeLog" ADD CONSTRAINT "ConfigChangeLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
