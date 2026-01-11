CREATE TABLE IF NOT EXISTS "Collection" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "kind" TEXT NOT NULL DEFAULT 'curated',
  "materialKey" TEXT,
  "heroImagePath" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CollectionModel" (
  "collectionId" TEXT NOT NULL,
  "modelId" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CollectionModel_pkey" PRIMARY KEY ("collectionId","modelId")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Collection_slug_key" ON "Collection"("slug");
CREATE INDEX IF NOT EXISTS "Collection_isActive_idx" ON "Collection"("isActive");
CREATE INDEX IF NOT EXISTS "Collection_kind_idx" ON "Collection"("kind");
CREATE INDEX IF NOT EXISTS "Collection_materialKey_idx" ON "Collection"("materialKey");
CREATE INDEX IF NOT EXISTS "Collection_position_idx" ON "Collection"("position");
CREATE INDEX IF NOT EXISTS "CollectionModel_collectionId_position_idx" ON "CollectionModel"("collectionId","position");

ALTER TABLE "CollectionModel"
  ADD CONSTRAINT "CollectionModel_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CollectionModel"
  ADD CONSTRAINT "CollectionModel_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE CASCADE ON UPDATE CASCADE;
