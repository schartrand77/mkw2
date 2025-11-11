'use server'

import { buildAmazonProductUrl } from '@/lib/amazon'

export type AmazonProductMeta = {
  title?: string
  description?: string
  image?: string
  url?: string
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0 Safari/537.36 MakerWorksBot/1.0'

type CacheValue = Promise<AmazonProductMeta | null>

declare global {
  // eslint-disable-next-line no-var
  var __mwAmazonMetaCache: Map<string, CacheValue> | undefined
}

const metadataCache =
  globalThis.__mwAmazonMetaCache ?? new Map<string, CacheValue>()

if (!globalThis.__mwAmazonMetaCache) {
  globalThis.__mwAmazonMetaCache = metadataCache
}

export async function fetchAmazonProductMetaByAsin(
  asin: string,
  ref?: string,
): Promise<AmazonProductMeta | null> {
  const url = buildAmazonProductUrl(asin, ref)
  return fetchAmazonProductMeta(url)
}

export async function fetchAmazonProductMeta(
  productUrl: string,
): Promise<AmazonProductMeta | null> {
  const key = `meta:${productUrl}`
  if (!metadataCache.has(key)) {
    metadataCache.set(key, actuallyFetchAmazonMeta(productUrl))
  }
  return metadataCache.get(key)!
}

async function actuallyFetchAmazonMeta(
  productUrl: string,
): Promise<AmazonProductMeta | null> {
  try {
    const res = await fetch(productUrl, {
      cache: 'no-store',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'en-CA,en;q=0.9',
      },
    })
    if (!res.ok) return null
    const html = await res.text()
    return parseMetaFromHtml(html, productUrl)
  } catch {
    return null
  }
}

function parseMetaFromHtml(
  html: string,
  fallbackUrl: string,
): AmazonProductMeta {
  const title =
    extractMetaProperty(html, 'og:title') ||
    extractMetaName(html, 'title') ||
    extractTitleTag(html)

  const description =
    extractMetaProperty(html, 'og:description') ||
    extractMetaName(html, 'description')

  const imageRaw = extractMetaProperty(html, 'og:image')
  const image = imageRaw ? normalizeUrl(imageRaw, fallbackUrl) : undefined

  const canonical =
    extractLinkRel(html, 'canonical') || extractMetaProperty(html, 'og:url')
  const url = canonical ? normalizeUrl(canonical, fallbackUrl) : fallbackUrl

  return { title: decodeHtml(title), description: decodeHtml(description), image, url }
}

function extractMetaProperty(html: string, property: string): string | undefined {
  const regex = new RegExp(
    `<meta[^>]+property=["']${escapeRegex(property)}["'][^>]+content=["']([^"']+)["']`,
    'i',
  )
  const match = html.match(regex)
  return match?.[1]
}

function extractMetaName(html: string, name: string): string | undefined {
  const regex = new RegExp(
    `<meta[^>]+name=["']${escapeRegex(name)}["'][^>]+content=["']([^"']+)["']`,
    'i',
  )
  const match = html.match(regex)
  return match?.[1]
}

function extractLinkRel(html: string, rel: string): string | undefined {
  const regex = new RegExp(
    `<link[^>]+rel=["']${escapeRegex(rel)}["'][^>]+href=["']([^"']+)["']`,
    'i',
  )
  const match = html.match(regex)
  return match?.[1]
}

function extractTitleTag(html: string): string | undefined {
  const match = html.match(/<title>([^<]+)<\/title>/i)
  return match?.[1]
}

function decodeHtml(value?: string): string | undefined {
  if (!value) return value
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .trim()
}

function normalizeUrl(input: string, fallback: string): string {
  try {
    const url = new URL(input, fallback)
    url.protocol = 'https:'
    return url.toString()
  } catch {
    return fallback
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

