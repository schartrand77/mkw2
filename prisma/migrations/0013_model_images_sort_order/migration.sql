-- Use BIGINT for image sort order so we can store timestamps safely
ALTER TABLE "ModelImage"
ALTER COLUMN "sortOrder" TYPE BIGINT USING "sortOrder"::bigint;
