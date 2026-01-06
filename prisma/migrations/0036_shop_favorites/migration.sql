ALTER TABLE "SiteConfig"
  ADD COLUMN IF NOT EXISTS "favoriteShopLinkIds" JSONB;
