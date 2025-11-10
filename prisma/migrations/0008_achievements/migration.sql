-- CreateTable Achievement
CREATE TABLE IF NOT EXISTS "Achievement" (
  "id" TEXT PRIMARY KEY,
  "key" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "icon" TEXT,
  "description" TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable UserAchievement (junction)
CREATE TABLE IF NOT EXISTS "UserAchievement" (
  "userId" TEXT NOT NULL,
  "achievementId" TEXT NOT NULL,
  "awardedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("userId", "achievementId")
);

-- Add relation field on User is implicit; no schema change required for foreign side
