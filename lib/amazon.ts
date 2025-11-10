export type AmazonShopItem = {
  id: string
  title: string
  category: string
  description: string
  priceHint: string
  highlights: string[]
  tags: string[]
  image: string
  rating?: number
  primeEligible?: boolean
  searchQuery?: string
}

export type AmazonShopItemWithUrl = AmazonShopItem & { url: string }

const rawTag =
  process.env.NEXT_PUBLIC_AMAZON_TAG ||
  process.env.AMAZON_ASSOCIATE_TAG ||
  ''

const AMAZON_TAG = rawTag.trim()

export const DEFAULT_AMAZON_QUERY = '3d printing accessories'

const AMAZON_BASE_URL = 'https://www.amazon.com'

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
    id: 'filament-studio',
    title: 'Filament Care Bundle',
    category: 'Consistency essentials',
    description: 'Dry boxes, spool weights, and silica packs that keep filament stable before every long print.',
    priceHint: '$25 - $85',
    highlights: ['Fits 1kg+ spools', 'Digital humidity readouts', 'Refillable desiccant trays'],
    tags: ['Print-ready spools', 'Moisture control'],
    image: 'https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=900&q=80',
    rating: 4.7,
    primeEligible: true,
    searchQuery: 'filament dryer box 3d printing accessories',
  },
  {
    id: 'build-surface',
    title: 'Build Plate Refresh Kits',
    category: 'Bed adhesion',
    description: 'PEI sheets, textured plates, and adhesives to swap in when your first layers start slipping.',
    priceHint: '$18 - $60',
    highlights: ['PEI & satin plates', 'Removable flex plates', 'Low-odor adhesives'],
    tags: ['First layer wins', 'Easy swap'],
    image: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=900&q=80',
    rating: 4.6,
    primeEligible: true,
    searchQuery: 'pei build plate kit 3d printing accessories',
  },
  {
    id: 'toolkit',
    title: 'Bench-Side Tool Kits',
    category: 'Calibration & cleanup',
    description: 'Everything from deburring tools to precision calipers for dialing tolerances after a print.',
    priceHint: '$22 - $55',
    highlights: ['Flush cutters & scrapers', '0.01mm calipers', 'Heat-resistant tweezers'],
    tags: ['Maintenance', 'Fine tuning'],
    image: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=900&q=80',
    rating: 4.8,
    primeEligible: true,
    searchQuery: '3d printer tool kit accessories',
  },
  {
    id: 'nozzle-lab',
    title: 'Nozzle Care + Upgrades',
    category: 'Hotend accessories',
    description: 'Hardened nozzles, cleaning needles, and spares for abrasive filaments or quick swaps.',
    priceHint: '$12 - $45',
    highlights: ['0.4-0.8mm kits', 'Wear-resistant materials', 'Includes cleaning needles'],
    tags: ['Swappable hotends', 'Abrasive-ready'],
    image: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=900&q=80&sat=-25',
    rating: 4.5,
    searchQuery: 'hardened steel nozzle kit 3d printer accessories',
  },
  {
    id: 'finishing-lab',
    title: 'Finishing Lab Staples',
    category: 'Surface finishing',
    description: 'Rotary tools, sanding blocks, and polish that smooth PLA, PETG, or resin parts.',
    priceHint: '$30 - $120',
    highlights: ['Variable speed rotary', 'Fine grit sanding cards', 'Non-yellowing polish'],
    tags: ['Post-processing', 'Model ready'],
    image: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=900&q=80',
    rating: 4.4,
    searchQuery: '3d print finishing kit accessories',
  },
  {
    id: 'safety',
    title: 'Safety & Filtration',
    category: 'Workspace upgrades',
    description: 'HEPA enclosures, carbon filters, and respirators sized for makers working with resin.',
    priceHint: '$40 - $160',
    highlights: ['Swap-in carbon filters', 'Low-profile respirators', 'Quiet enclosure fans'],
    tags: ['Resin ready', 'Clean air'],
    image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=80',
    rating: 4.6,
    searchQuery: '3d printer enclosure filter accessories',
  },
  {
    id: 'lighting',
    title: 'Inspection Lighting',
    category: 'Quality control',
    description: 'Magnetic LED bars and articulating lamps to check layers without shadows.',
    priceHint: '$18 - $70',
    highlights: ['High CRI LEDs', 'Flexible goosenecks', 'USB-C power options'],
    tags: ['Layer preview', 'Workbench'],
    image: 'https://images.unsplash.com/photo-1503341455253-b2e723bb3dbb?auto=format&fit=crop&w=900&q=80',
    rating: 4.3,
    searchQuery: 'workbench led light bar 3d printing accessories',
  },
  {
    id: 'organization',
    title: 'Accessory Organization',
    category: 'Storage',
    description: 'Drawer systems, grid walls, and label-ready bins sized for nozzles, bits, and spare parts.',
    priceHint: '$15 - $95',
    highlights: ['Stackable bins', 'Anti-static liners', 'Wall-mount options'],
    tags: ['Tidy bench', 'Quick swaps'],
    image: 'https://images.unsplash.com/photo-1503389152951-9f343605f61e?auto=format&fit=crop&w=900&q=80',
    rating: 4.5,
    searchQuery: 'tool organizer drawers 3d printing accessories',
  },
] satisfies AmazonShopItem[]

export const amazonShopItems: AmazonShopItemWithUrl[] = rawItems.map((item) => ({
  ...item,
  url: buildAmazonSearchUrl(
    item.searchQuery
      ? `${item.searchQuery} 3d printing accessories`
      : DEFAULT_AMAZON_QUERY,
    `makerworks_v2_store_${item.id}`,
  ),
}))
