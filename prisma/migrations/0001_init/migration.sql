-- CreateTable User
CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "passwordHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- CreateTable Model
CREATE TABLE IF NOT EXISTS "Model" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "filePath" TEXT NOT NULL,
  "coverImagePath" TEXT,
  "fileType" TEXT NOT NULL,
  "unit" TEXT NOT NULL DEFAULT 'mm',
  "material" TEXT NOT NULL DEFAULT 'PLA',
  "volumeMm3" DOUBLE PRECISION,
  "priceUsd" DOUBLE PRECISION,
  "visibility" TEXT NOT NULL DEFAULT 'public',
  "downloads" INTEGER NOT NULL DEFAULT 0,
  "likes" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "userId" TEXT NOT NULL,
  CONSTRAINT "Model_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

