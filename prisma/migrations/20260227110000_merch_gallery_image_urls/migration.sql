ALTER TABLE "MerchItem"
  ADD COLUMN IF NOT EXISTS "galleryImageUrls" JSONB;

UPDATE "MerchItem"
SET "galleryImageUrls" = CASE
  WHEN "imageUrl" IS NOT NULL AND BTRIM("imageUrl") <> '' THEN to_jsonb(ARRAY["imageUrl"]::TEXT[])
  ELSE '[]'::jsonb
END
WHERE "galleryImageUrls" IS NULL;
