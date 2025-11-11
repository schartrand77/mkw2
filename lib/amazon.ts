export type AmazonShopItem = {
  id: string
  title: string
  category: string
  description: string
  priceHint: string
  highlights: string[]
  tags: string[]
  image: string
  asin?: string
  rating?: number
  primeEligible?: boolean
  searchQuery?: string
  manualUrl?: string
}

export type AmazonShopItemWithUrl = AmazonShopItem & { url: string }

const rawTag =
  process.env.NEXT_PUBLIC_AMAZON_TAG ||
  process.env.AMAZON_ASSOCIATE_TAG ||
  ''

const AMAZON_TAG = rawTag.trim()

const rawDomain =
  process.env.NEXT_PUBLIC_AMAZON_DOMAIN ||
  process.env.AMAZON_DOMAIN ||
  'amazon.ca'

function normalizeDomain(domain: string | undefined | null): string {
  if (!domain) return ''
  return domain.replace(/^https?:\/\//i, '').replace(/\/+$/, '').trim().toLowerCase()
}

const AMAZON_DOMAIN = normalizeDomain(rawDomain) || 'amazon.ca'
export const AMAZON_MARKETPLACE_HOST = AMAZON_DOMAIN

export const DEFAULT_AMAZON_QUERY = '3d printing accessories'

const AMAZON_BASE_URL = `https://${AMAZON_DOMAIN}`

function isAmazonHost(hostname: string): boolean {
  return hostname.toLowerCase().includes('amazon.')
}

function toAmazonUrl(input: string): URL | null {
  const raw = (input || '').trim()
  if (!raw) return null
  const attempts: string[] = [raw]
  if (!/^https?:\/\//i.test(raw)) attempts.unshift(`https://${raw}`)

  for (const candidate of attempts) {
    try {
      const parsed = new URL(candidate)
      if (!isAmazonHost(parsed.hostname)) continue
      parsed.protocol = 'https:'
      parsed.hostname = AMAZON_DOMAIN
      parsed.port = ''
      return parsed
    } catch {
      continue
    }
  }

  try {
    return new URL(raw.startsWith('/') ? raw : `/${raw}`, AMAZON_BASE_URL)
  } catch {
    return null
  }
}

export function normalizeAmazonAffiliateUrl(input: string): string | null {
  const parsed = toAmazonUrl(input)
  if (!parsed) return null
  parsed.hostname = AMAZON_DOMAIN
  parsed.protocol = 'https:'
  parsed.port = ''
  if (AMAZON_TAG) parsed.searchParams.set('tag', AMAZON_TAG)
  return parsed.toString()
}

export function buildAmazonSearchUrl(
  query: string = DEFAULT_AMAZON_QUERY,
  ref: string = 'makerworks_v2_store',
): string {
  const normalizedQuery = query.trim().length > 0 ? query.trim() : DEFAULT_AMAZON_QUERY
  const url = new URL('/s', AMAZON_BASE_URL)
  url.searchParams.set('k', normalizedQuery)
  url.searchParams.set('i', 'industrial')
  url.searchParams.set('ref', ref)
  if (AMAZON_TAG) url.searchParams.set('tag', AMAZON_TAG)
  return url.toString()
}

export function buildAmazonProductUrl(
  asin: string,
  ref: string = 'makerworks_v2_store_product',
): string {
  const url = new URL(`/dp/${asin}`, AMAZON_BASE_URL)
  url.searchParams.set('ref', ref)
  if (AMAZON_TAG) url.searchParams.set('tag', AMAZON_TAG)
  url.searchParams.set('th', '1')
  return url.toString()
}

const rawItems: AmazonShopItem[] = [
  {
    id: 'polymaker-filament',
    title: 'Polymaker Filament Hub',
    category: 'Materials',
    description: 'Shop Polymaker PLA, PETG, and specialty blends that keep print quality dialed in.',
    priceHint: 'Varies by spool',
    highlights: ['Trusted brands', 'Exotic blends', 'Bulk color packs'],
    tags: ['Filament', 'Polymaker'],
    image: 'https://m.media-amazon.com/images/I/71uYpXrVvjL._AC_SL1500_.jpg',
    primeEligible: true,
    manualUrl: 'https://www.amazon.ca/s?k=Polymaker&crid=3IBJDUH0TJWGE&sprefix=polymaker%2Caps%2C147&linkCode=ll2&tag=makerworks20-20&linkId=808a5e6a33ea93956ddca47fb8aa1726&language=en_CA&ref_=as_li_ss_tl',
  },
  {
    id: 'precision-magnets',
    title: 'Precision Magnets',
    category: 'Mechanical kits',
    description: 'Dial in enclosures, tool holders, and modular prints with matched magnet sets.',
    priceHint: '$10 - $35',
    highlights: ['Rare-earth options', 'Closures & doors', 'Tool-free swaps'],
    tags: ['Kinematics', 'Fast swaps'],
    image: 'https://m.media-amazon.com/images/I/61X5Gucs5QL._AC_SL1500_.jpg',
    primeEligible: true,
    manualUrl: 'https://www.amazon.ca/s?k=Magnets&crid=295AEV587VUXE&sprefix=magnets%2Caps%2C150&linkCode=ll2&tag=makerworks20-20&linkId=4312748ba1ca2cf41a9645c7c3210723&language=en_CA&ref_=as_li_ss_tl',
  },
  {
    id: 'led-layers',
    title: 'LED Accent Lighting',
    category: 'Workstation upgrades',
    description: 'LED strips and task lights for light painting, timelapses, and enclosure builds.',
    priceHint: '$15 - $60',
    highlights: ['RGB & daylight', 'USB-powered', 'Adhesive channels'],
    tags: ['Lighting', 'Showcase'],
    image: 'https://m.media-amazon.com/images/I/71gyUgsL4cL._AC_SL1500_.jpg',
    primeEligible: true,
    manualUrl: 'https://www.amazon.ca/s?k=led+lights&crid=3TUPBQITCT97A&sprefix=Led%2Caps%2C153&linkCode=ll2&tag=makerworks20-20&linkId=b330deecaa1ab0ea944b40c021931cd9&language=en_CA&ref_=as_li_ss_tl',
  },
  {
    id: 'desk-accessories',
    title: 'Desk & Computer Accessories',
    category: 'Control center',
    description: 'USB hubs, monitor risers, and mounts that keep slicers and dashboards within reach.',
    priceHint: '$20 - $120',
    highlights: ['Cable cleanup', 'Extra USB-C power', 'Monitor stands'],
    tags: ['Workspace', 'PC gear'],
    image: 'https://m.media-amazon.com/images/I/71YhrhZCTXN._AC_SL1500_.jpg',
    primeEligible: true,
    manualUrl: 'https://www.amazon.ca/s?k=computer+accessories&crid=2HZSMRF89VV6O&sprefix=Computer+acc%2Caps%2C141&linkCode=ll2&tag=makerworks20-20&linkId=58ce9696e7dfaa184494d476cc5a1cbd&language=en_CA&ref_=as_li_ss_tl',
  },
] satisfies AmazonShopItem[]

export const amazonShopItems: AmazonShopItemWithUrl[] = rawItems.map((item) => ({
  ...item,
  url:
    item.manualUrl ||
    buildAmazonSearchUrl(
      item.searchQuery
        ? `${item.searchQuery} 3d printing accessories`
        : DEFAULT_AMAZON_QUERY,
      `makerworks_v2_store_${item.id}`,
    ),
}))
