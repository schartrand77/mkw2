-- Replace LinkedIn profile link with Bluesky
ALTER TABLE "Profile"
  DROP COLUMN IF EXISTS "socialLinkedin",
  ADD COLUMN IF NOT EXISTS "socialBluesky" TEXT;
