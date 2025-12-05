'use server'

import {
  amazonShopItems,
  AmazonShopItemWithUrl,
  buildAmazonSearchUrl,
} from '@/lib/amazon'
import {
  fetchAmazonProductMeta,
  fetchAmazonProductMetaByAsin,
} from '@/lib/amazonMetadata'

export type AmazonSpotlightCard = AmazonShopItemWithUrl & {
  displayTitle: string
  displayImage: string
  descriptionFromAmazon?: string
  canonicalUrl?: string
}

function stripDepartmentPrefix(rawTitle: string, fallback: string): string {
  const title = (rawTitle || '').trim()
  if (!title) return fallback
  const cleaned = title.replace(/^(industrial\s*&\s*scientific(?:\s+store)?)\s*([:|–-]+\s*)?/i, '').trim()
  return cleaned.length > 0 ? cleaned : fallback
}

export async function getAmazonSpotlightCards(): Promise<
  AmazonSpotlightCard[]
> {
  const cards = await Promise.all(
    amazonShopItems.map(async (item) => {
      const ref = `makerworks_v2_store_${item.id}`
      const hasManualLink = !!item.manualUrl
      let meta = null
      if (!hasManualLink) {
        if (item.asin) {
          meta = await fetchAmazonProductMetaByAsin(item.asin, ref)
        } else if (item.searchQuery) {
          meta = await fetchAmazonProductMeta(
            buildAmazonSearchUrl(item.searchQuery, ref),
          )
        } else {
          meta = await fetchAmazonProductMeta(item.url)
        }
      }

      return {
        ...item,
        displayTitle: stripDepartmentPrefix(meta?.title || item.title, item.title),
        displayImage: meta?.image || item.image,
        descriptionFromAmazon: meta?.description,
        canonicalUrl: meta?.url || item.url,
        url: meta?.url || item.url,
      }
    }),
  )

  return cards
}
