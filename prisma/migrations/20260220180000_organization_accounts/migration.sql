-- Create organization accounts and memberships for B2B workflows
CREATE TABLE IF NOT EXISTS "Organization" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "billingEmail" TEXT,
  "billingContact" TEXT,
  "quoteApprovalRequired" BOOLEAN NOT NULL DEFAULT true,
  "requirePoAboveCents" INTEGER,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OrganizationMember" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'requester',
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PrintOrder" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Organization_createdById_fkey'
  ) THEN
    ALTER TABLE "Organization"
      ADD CONSTRAINT "Organization_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OrganizationMember_organizationId_fkey'
  ) THEN
    ALTER TABLE "OrganizationMember"
      ADD CONSTRAINT "OrganizationMember_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OrganizationMember_userId_fkey'
  ) THEN
    ALTER TABLE "OrganizationMember"
      ADD CONSTRAINT "OrganizationMember_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PrintOrder_organizationId_fkey'
  ) THEN
    ALTER TABLE "PrintOrder"
      ADD CONSTRAINT "PrintOrder_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "Organization_slug_key" ON "Organization"("slug");
CREATE INDEX IF NOT EXISTS "Organization_createdById_idx" ON "Organization"("createdById");
CREATE INDEX IF NOT EXISTS "Organization_name_idx" ON "Organization"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationMember_organizationId_userId_key" ON "OrganizationMember"("organizationId", "userId");
CREATE INDEX IF NOT EXISTS "OrganizationMember_userId_idx" ON "OrganizationMember"("userId");
CREATE INDEX IF NOT EXISTS "OrganizationMember_organizationId_role_idx" ON "OrganizationMember"("organizationId", "role");
CREATE INDEX IF NOT EXISTS "PrintOrder_organizationId_idx" ON "PrintOrder"("organizationId");
