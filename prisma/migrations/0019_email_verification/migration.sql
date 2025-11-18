ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT true;

UPDATE "User" SET "emailVerified" = true WHERE "emailVerified" IS NULL;

ALTER TABLE "User" ALTER COLUMN "emailVerified" SET DEFAULT false;
