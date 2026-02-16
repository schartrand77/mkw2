ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "registrationSource" TEXT NOT NULL DEFAULT 'self_signup',
  ADD COLUMN IF NOT EXISTS "registrationIp" TEXT,
  ADD COLUMN IF NOT EXISTS "registrationUserAgent" TEXT,
  ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastLoginIp" TEXT,
  ADD COLUMN IF NOT EXISTS "lastLoginUserAgent" TEXT;

CREATE INDEX IF NOT EXISTS "User_lastLoginAt_idx" ON "User"("lastLoginAt");
