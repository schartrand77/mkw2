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

function stripDepartmentNoise(raw: string | null | undefined, fallback: string): string {
  const source = (raw || '').trim()
  if (!source) return fallback
  const phraseSource = 'industrial\\s*&\\s*scientific(?:\\s+store)?'
  const colonPattern = new RegExp(`\\s*[:|–-]\\s*(?=${phraseSource})`, 'gi')
  const connectorPattern = new RegExp(`\\b(?:at|in|from)\\s+(?:the\\s+|an\\s+|a\\s+)?(?=${phraseSource})`, 'gi')
  const phrasePattern = new RegExp(phraseSource, 'gi')
  let cleaned = source
  cleaned = cleaned.replace(colonPattern, ' ')
  cleaned = cleaned.replace(connectorPattern, '')
  cleaned = cleaned.replace(phrasePattern, ' ')
  cleaned = cleaned.replace(/\s{2,}/g, ' ')
  cleaned = cleaned.replace(/\s+([,.;!?:])/g, '$1')
  cleaned = cleaned.replace(/^[\s|:,-]+/, '').replace(/[\s|:,-]+$/, '')
  cleaned = cleaned.trim()
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

      const cleanedDescription = meta?.description
        ? stripDepartmentNoise(meta.description, item.description)
        : undefined

      return {
        ...item,
        displayTitle: stripDepartmentNoise(meta?.title || item.title, item.title),
        displayImage: meta?.image || item.image,
        descriptionFromAmazon: cleanedDescription,
        canonicalUrl: meta?.url || item.url,
        url: meta?.url || item.url,
      }
    }),
  )

  return cards
}
