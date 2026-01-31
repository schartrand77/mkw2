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

function resolveAmazonTag(): string {
  const env =
    (typeof process !== 'undefined' && process.env)
      ? (process.env as NodeJS.ProcessEnv)
      : ({} as NodeJS.ProcessEnv)
  const rawTag =
    env['AMAZON_ASSOCIATE_TAG'] ||
    env['NEXT_PUBLIC_AMAZON_TAG'] ||
    ''
  return rawTag.trim()
}

function resolveAmazonDomain(): string {
  const env =
    (typeof process !== 'undefined' && process.env)
      ? (process.env as NodeJS.ProcessEnv)
      : ({} as NodeJS.ProcessEnv)
  const rawDomain =
    env['AMAZON_DOMAIN'] ||
    env['NEXT_PUBLIC_AMAZON_DOMAIN'] ||
    'amazon.ca'
  return normalizeDomain(rawDomain) || 'amazon.ca'
}

function normalizeDomain(domain: string | undefined | null): string {
  if (!domain) return ''
  return domain.replace(/^https?:\/\//i, '').replace(/\/+$/, '').trim().toLowerCase()
}

export function getAmazonMarketplaceHost(): string {
  return resolveAmazonDomain()
}

export const DEFAULT_AMAZON_QUERY = '3d printing accessories'

function getAmazonBaseUrl(): string {
  return `https://${resolveAmazonDomain()}`
}

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
      parsed.hostname = resolveAmazonDomain()
      parsed.port = ''
      return parsed
    } catch {
      continue
    }
  }

  try {
    return new URL(raw.startsWith('/') ? raw : `/${raw}`, getAmazonBaseUrl())
  } catch {
    return null
  }
}

export function normalizeAmazonAffiliateUrl(input: string): string | null {
  const parsed = toAmazonUrl(input)
  if (!parsed) return null
  parsed.hostname = resolveAmazonDomain()
  parsed.protocol = 'https:'
  parsed.port = ''
  const tag = resolveAmazonTag()
  if (tag) parsed.searchParams.set('tag', tag)
  return parsed.toString()
}

const ASIN_REGEX = /^[A-Z0-9]{10}$/

export function extractAmazonAsin(input: string | null | undefined): string | null {
  if (!input) return null
  try {
    const url = new URL(input)
    const segments = url.pathname.split('/').filter(Boolean)
    for (let i = 0; i < segments.length; i += 1) {
      const seg = segments[i].toUpperCase()
      if (ASIN_REGEX.test(seg)) return seg
      if ((segments[i] === 'dp' || segments[i] === 'product' || segments[i] === 'gp') && segments[i + 1]) {
        const next = segments[i + 1].toUpperCase()
        if (ASIN_REGEX.test(next)) return next
      }
    }
    const asinParam = url.searchParams.get('asin') || url.searchParams.get('ASIN')
    if (asinParam) {
      const uppercase = asinParam.toUpperCase()
      if (ASIN_REGEX.test(uppercase)) return uppercase
    }
  } catch {
    return null
  }
  return null
}

function resolveMarketplaceCode(domain: string): string {
  if (domain.endsWith('.ca')) return 'CA'
  if (domain.endsWith('.co.uk')) return 'UK'
  if (domain.endsWith('.de')) return 'DE'
  if (domain.endsWith('.fr')) return 'FR'
  if (domain.endsWith('.jp')) return 'JP'
  if (domain.endsWith('.com.au')) return 'AU'
  return 'US'
}

function getAmazonMarketplaceCode(): string {
  return resolveMarketplaceCode(resolveAmazonDomain())
}

export function buildAmazonImageUrl(asin: string, size = 500): string {
  const clamped = Math.min(1000, Math.max(100, Math.round(size / 50) * 50))
  const url = new URL('https://ws-na.amazon-adsystem.com/widgets/q')
  url.searchParams.set('_encoding', 'UTF8')
  url.searchParams.set('ASIN', asin)
  url.searchParams.set('Format', `_SL${clamped}_`)
  url.searchParams.set('ID', 'AsinImage')
  url.searchParams.set('MarketPlace', getAmazonMarketplaceCode())
  url.searchParams.set('ServiceVersion', '20070822')
  url.searchParams.set('WS', '1')
  const tag = resolveAmazonTag()
  if (tag) url.searchParams.set('tag', tag)
  return url.toString()
}

export function buildAmazonSearchUrl(
  query: string = DEFAULT_AMAZON_QUERY,
  ref: string = 'makerworks_v2_store',
): string {
  const normalizedQuery = query.trim().length > 0 ? query.trim() : DEFAULT_AMAZON_QUERY
  const url = new URL('/s', getAmazonBaseUrl())
  url.searchParams.set('k', normalizedQuery)
  url.searchParams.set('i', 'industrial')
  url.searchParams.set('ref', ref)
  const tag = resolveAmazonTag()
  if (tag) url.searchParams.set('tag', tag)
  return url.toString()
}

export function buildAmazonProductUrl(
  asin: string,
  ref: string = 'makerworks_v2_store_product',
): string {
  const url = new URL(`/dp/${asin}`, getAmazonBaseUrl())
  url.searchParams.set('ref', ref)
  const tag = resolveAmazonTag()
  if (tag) url.searchParams.set('tag', tag)
  url.searchParams.set('th', '1')
  return url.toString()
}

const gearAccentPalette = [
  '#0EA5E9',
  '#9333EA',
  '#14B8A6',
  '#F97316',
  '#F43F5E',
  '#22D3EE',
  '#A855F7',
  '#FACC15',
  '#84CC16',
  '#EC4899',
  '#38BDF8',
  '#FB7185',
] as const

function escapeSvgText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function createGearCardImage(title: string, accent: string): string {
  const safeTitle = escapeSvgText(title)
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="grad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="${accent}" stop-opacity="1" />
          <stop offset="100%" stop-color="#0f172a" stop-opacity="0.95" />
        </linearGradient>
      </defs>
      <rect width="800" height="450" rx="32" fill="url(#grad)" />
      <circle cx="80" cy="370" r="150" fill="rgba(255,255,255,0.12)" />
      <circle cx="720" cy="80" r="140" fill="rgba(255,255,255,0.1)" />
      <text x="60" y="230" font-family="'Space Grotesk', 'Inter', sans-serif" font-size="46" font-weight="600" fill="#ffffff" opacity="0.95">
        ${safeTitle}
      </text>
      <text x="60" y="290" font-family="'Space Grotesk', 'Inter', sans-serif" font-size="22" fill="rgba(255,255,255,0.8)">
        Amazon picks for makers
      </text>
    </svg>
  `

  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

const collectionSeeds = [
  {
    id: 'fdm-printers',
    title: 'FDM Printer Rigs',
    category: 'Printers',
    description: 'Bowden and CoreXY printers dialed for production and prototyping.',
    priceHint: 'From ~$250',
    highlights: ['Auto bed leveling ready', '32-bit controllers', 'Farm-friendly volume'],
    tags: ['Printers', 'FDM', 'Farm'],
    primeEligible: true,
    searchQuery: 'FDM 3d printer',
  },
  {
    id: 'resin-printers',
    title: 'Resin & MSLA',
    category: 'Printers',
    description: 'MSLA printers with bundled wash/cure stations for miniature-perfect detail.',
    priceHint: 'From ~$200',
    highlights: ['8K LCD panels', 'Carbon filtration', 'Wash & cure combos'],
    tags: ['Printers', 'Resin', 'MSLA'],
    primeEligible: true,
    searchQuery: 'resin 3d printer',
  },
  {
    id: 'large-format-printers',
    title: 'Large-Format Builds',
    category: 'Printers',
    description: 'Tall build-volume printers for cosplay parts, signage, and fixtures.',
    priceHint: 'From ~$450',
    highlights: ['400mm+ beds', 'Direct drive ready', 'Enclosure friendly'],
    tags: ['Printers', 'Large format', 'CoreXY'],
    primeEligible: true,
    searchQuery: 'large format 3d printer',
  },
  {
    id: 'starter-pla-filament',
    title: 'PLA Color Packs',
    category: 'Materials',
    description: 'Everyday PLA bundles, matte variants, and sampler packs for client work.',
    priceHint: 'Spools from $20',
    highlights: ['Silk & matte finishes', '1.75mm consistency', 'Prime-ready brands'],
    tags: ['Filament', 'PLA', 'Materials'],
    primeEligible: true,
    searchQuery: 'PLA filament 1.75mm 3d printing',
  },
  {
    id: 'petg-functional-filament',
    title: 'PETG & Copolyesters',
    category: 'Materials',
    description: 'Impact-resistant PETG for brackets, outdoor gear, and fixtures.',
    priceHint: 'Spools from $28',
    highlights: ['High temp stability', 'Low-odor blends', 'Color-sorted sets'],
    tags: ['Materials', 'PETG', 'Functional'],
    primeEligible: true,
    searchQuery: 'PETG filament 1.75mm',
  },
  {
    id: 'abs-asa-filament',
    title: 'ABS & ASA',
    category: 'Materials',
    description: 'Engineering thermoplastics that laugh at shop heat and UV.',
    priceHint: 'Spools from $32',
    highlights: ['High-temp ready', 'UV-stable ASA', 'Solvent smoothing friendly'],
    tags: ['Materials', 'ABS', 'ASA'],
    primeEligible: true,
    searchQuery: 'ABS ASA filament 3d printing',
  },
  {
    id: 'tpu-flexible-filament',
    title: 'TPU Flexibles',
    category: 'Materials',
    description: 'Flexible TPU/TPE blends for gaskets, wearable gear, and robotics.',
    priceHint: 'Spools from $30',
    highlights: ['Shore 95A to 60A', 'Direct & Bowden tuned', 'Low stringing'],
    tags: ['Materials', 'TPU', 'Flexible'],
    primeEligible: true,
    searchQuery: 'TPU flexible filament 3d printing',
  },
  {
    id: 'nylon-carbon-filament',
    title: 'Nylon & CF Mixes',
    category: 'Materials',
    description: 'Fiber-filled nylon blends for tooling plates and fixtures.',
    priceHint: 'Spools from $45',
    highlights: ['Carbon & glass fills', 'Dry-box bundles', 'Warp-tamed blends'],
    tags: ['Materials', 'Nylon', 'Carbon fiber'],
    primeEligible: true,
    searchQuery: 'nylon carbon fiber filament 3d printing',
  },
  {
    id: 'polycarbonate-high-temp-filament',
    title: 'Polycarbonate & HT',
    category: 'Materials',
    description: 'Polycarbonate, PEI-lite, and high-temp filaments built for enclosures.',
    priceHint: 'Spools from $55',
    highlights: ['High heat deflection', 'Reinforced coils', 'Requires enclosures'],
    tags: ['Materials', 'Polycarbonate', 'High temp'],
    primeEligible: true,
    searchQuery: 'polycarbonate filament 3d printing',
  },
  {
    id: 'standard-resin-kits',
    title: 'Standard Resin',
    category: 'Materials',
    description: 'Low-odor, plant-based, and fast-curing resins for miniature labs.',
    priceHint: 'Bottles from $25',
    highlights: ['Fast exposure profiles', 'Matte & gloss finishes', '1kg refills'],
    tags: ['Materials', 'Resin', 'Standard'],
    primeEligible: true,
    searchQuery: 'standard resin 3d printing',
  },
  {
    id: 'engineering-resin-kits',
    title: 'Engineering Resin',
    category: 'Materials',
    description: 'Tough, flexible, and high-temp resins that behave like ABS.',
    priceHint: 'Bottles from $35',
    highlights: ['ABS-like blends', 'Impact-ready', 'High-temp molds'],
    tags: ['Materials', 'Resin', 'Engineering'],
    primeEligible: true,
    searchQuery: 'engineering resin 3d printing',
  },
  {
    id: 'nozzle-rebuild-kits',
    title: 'Nozzle Kits',
    category: 'Upgrades',
    description: 'Full nozzle assortments that jump from 0.2 to 1.0 mm on demand.',
    priceHint: 'Kits from $15',
    highlights: ['Brass & steel mixes', 'Storage cases', 'Color-coded sizing'],
    tags: ['Upgrades', 'Nozzles', 'Maintenance'],
    primeEligible: true,
    searchQuery: '3d printer nozzle kit',
  },
  {
    id: 'hardened-nozzles',
    title: 'Hardened Nozzles',
    category: 'Upgrades',
    description: 'Wear-resistant nozzles for abrasive CF, glow, and metal fills.',
    priceHint: 'Singles from $18',
    highlights: ['Vanadium & ruby tips', 'High-flow variants', 'CF-safe builds'],
    tags: ['Upgrades', 'Nozzles', 'Abrasive'],
    primeEligible: true,
    searchQuery: 'hardened steel 3d printer nozzle',
  },
  {
    id: 'hotend-upgrades',
    title: 'Hotend Upgrades',
    category: 'Upgrades',
    description: 'All-metal hotends, E3D Revo kits, and bi-metal heatbreaks.',
    priceHint: 'From $65',
    highlights: ['Drop-in assemblies', 'Bi-metal breaks', 'Higher flow rate'],
    tags: ['Upgrades', 'Hotends', 'Revo'],
    primeEligible: true,
    searchQuery: 'e3d revo hotend kit',
  },
  {
    id: 'pei-build-surfaces',
    title: 'Build Surfaces',
    category: 'Bed & adhesion',
    description: 'PEI flex plates, textured sheets, and glass upgrades for clean releases.',
    priceHint: 'Plates from $28',
    highlights: ['Magnetic bases', 'Dual texture sheets', 'Matched sizing'],
    tags: ['Bed', 'PEI', 'Upgrades'],
    primeEligible: true,
    searchQuery: 'PEI build plate 3d printer',
  },
  {
    id: 'bed-adhesion-solutions',
    title: 'Adhesion Boosters',
    category: 'Bed & adhesion',
    description: 'Bed adhesives, Magigoo, and sprays tuned per material.',
    priceHint: 'From $10',
    highlights: ['Magigoo flavors', 'Purple glue staples', 'PEI-safe sprays'],
    tags: ['Adhesion', 'Bed prep', 'Chemistry'],
    primeEligible: true,
    searchQuery: '3d printer bed adhesive',
  },
  {
    id: 'autolevel-sensors',
    title: 'Auto-Level Sensors',
    category: 'Electronics',
    description: 'BLTouch, CR Touch, and inductive probe kits for confident first layers.',
    priceHint: 'From $25',
    highlights: ['Drop-in harnesses', '32-bit firmware support', 'Mount kits included'],
    tags: ['Electronics', 'Leveling', 'Sensors'],
    primeEligible: true,
    searchQuery: 'BLTouch auto bed leveling sensor',
  },
  {
    id: 'motion-linear-rails',
    title: 'Linear Rails & Motion',
    category: 'Hardware',
    description: 'MGN rails, lead screws, and belt kits to tighten motion systems.',
    priceHint: 'From $30',
    highlights: ['Matched pairs', 'Gates belts', 'Preloaded carriages'],
    tags: ['Hardware', 'Motion', 'Rails'],
    primeEligible: true,
    searchQuery: 'MGN12 linear rail kit 3d printer',
  },
  {
    id: 'part-cooling-upgrades',
    title: 'Cooling & Fans',
    category: 'Hardware',
    description: 'Part-cooling fans, ducts, and Nevermore-style recirculation kits.',
    priceHint: 'From $18',
    highlights: ['5015 blowers', 'Quiet bearings', 'Drop-in ducts'],
    tags: ['Cooling', 'Fans', 'Upgrades'],
    primeEligible: true,
    searchQuery: '3d printer part cooling fan 5015',
  },
  {
    id: 'filament-dryers',
    title: 'Filament Dryers',
    category: 'Storage',
    description: 'Dry boxes, dehydrators, and inline heaters to keep spools crisp.',
    priceHint: 'From $40',
    highlights: ['Dual spool chambers', 'Digital humidity readouts', 'Inline feed ports'],
    tags: ['Storage', 'Materials', 'Dry box'],
    primeEligible: true,
    searchQuery: 'filament dry box 3d printing',
  },
  {
    id: 'printer-enclosures',
    title: 'Printer Enclosures',
    category: 'Safety',
    description: 'Soft covers, IKEA hacks, and rigid panels that tame drafts.',
    priceHint: 'From $70',
    highlights: ['Temp-stable builds', 'Smoke & odor control', 'Voron panel kits'],
    tags: ['Safety', 'Enclosure', 'Upgrade'],
    primeEligible: true,
    searchQuery: '3d printer enclosure kit',
  },
  {
    id: 'tool-maintenance-kits',
    title: 'Tool Essentials',
    category: 'Workspace',
    description: 'Flush cutters, tweezers, scrapers, and hex sets sized for printers.',
    priceHint: 'Kits from $15',
    highlights: ['Deburring tools', 'Magnetic mats', 'Heat-set inserts tools'],
    tags: ['Tools', 'Maintenance', 'Workspace'],
    primeEligible: true,
    searchQuery: '3d printer tool kit',
  },
  {
    id: 'finishing-deburring',
    title: 'Finishing & Paint',
    category: 'Post-processing',
    description: 'Sanding sticks, filler primers, and paint kits for hero props.',
    priceHint: 'From $18',
    highlights: ['Wet/dry grits', 'PLA-safe primers', 'Airbrush starters'],
    tags: ['Finishing', 'Painting', 'Post'],
    primeEligible: true,
    searchQuery: '3d print finishing kit',
  },
  {
    id: 'electronics-octoprint',
    title: 'OctoPrint Electronics',
    category: 'Electronics',
    description: 'Raspberry Pi kits, hubs, and UPS units for remote monitoring.',
    priceHint: 'From $40',
    highlights: ['Pi bundles', 'Camera-ready kits', 'MicroSD included'],
    tags: ['Electronics', 'OctoPrint', 'Connectivity'],
    primeEligible: true,
    searchQuery: 'raspberry pi octoprint kit',
  },
  {
    id: 'monitoring-cameras',
    title: 'Monitoring & Cameras',
    category: 'Workspace',
    description: 'Action cams, webcams, and articulating mounts for timelapses.',
    priceHint: 'From $25',
    highlights: ['OctoLapse ready', 'Clamp mounts', 'Low-light sensors'],
    tags: ['Cameras', 'Monitoring', 'Timelapse'],
    primeEligible: true,
    searchQuery: '3d printer camera mount kit',
  },
  {
    id: 'air-filtration',
    title: 'Air Filtration',
    category: 'Safety',
    description: 'HEPA and carbon filter units sized for resin labs and enclosures.',
    priceHint: 'From $45',
    highlights: ['Dual-stage filters', 'Compact enclosures', 'USB-powered options'],
    tags: ['Safety', 'Filters', 'Air quality'],
    primeEligible: true,
    searchQuery: '3d printer air filter',
  },
  {
    id: 'resin-safety-gear',
    title: 'Resin Safety Gear',
    category: 'Safety',
    description: 'Nitrile gloves, respirators, and splash protection for resin shifts.',
    priceHint: 'From $12',
    highlights: ['Organic vapor filters', 'Bulk nitrile packs', 'Face shields'],
    tags: ['Safety', 'Resin', 'PPE'],
    primeEligible: true,
    searchQuery: 'resin 3d printing safety gear respirator',
  },
  {
    id: 'storage-organization',
    title: 'Storage & Racks',
    category: 'Workspace',
    description: 'Spool racks, drawer inserts, and bin systems for organized labs.',
    priceHint: 'From $25',
    highlights: ['Modular bins', 'Label-ready trays', 'Wall mounts'],
    tags: ['Storage', 'Organization', 'Lab'],
    primeEligible: true,
    searchQuery: '3d printer storage organizer bin',
  },
  {
    id: 'lubricants-cleaners',
    title: 'Lubricants & Cleaners',
    category: 'Maintenance',
    description: 'PTFE grease, IPA refills, and resin cleaning kits for upkeep.',
    priceHint: 'From $10',
    highlights: ['Super Lube tubes', 'High-purity IPA', 'Lint-free wipes'],
    tags: ['Maintenance', 'Cleaning', 'Lubrication'],
    primeEligible: true,
    searchQuery: 'super lube ptfe grease 3d printer',
  },
  {
    id: 'calibration-instruments',
    title: 'Calibration Instruments',
    category: 'Metrology',
    description: 'Digital calipers, feeler gauges, and alignment tools.',
    priceHint: 'From $15',
    highlights: ['0.01mm calipers', 'Machined squares', 'Bed tramming kits'],
    tags: ['Calibration', 'QA', 'Tools'],
    primeEligible: true,
    searchQuery: 'digital calipers feeler gauge 3d printer',
  },
  {
    id: 'heat-set-inserts',
    title: 'Heat-Set Inserts',
    category: 'Hardware',
    description: 'Threaded inserts, soldering tips, and fixtures for plastics.',
    priceHint: 'Kits from $20',
    highlights: ['Metric & imperial sets', 'Guide blocks', 'Tip assortments'],
    tags: ['Hardware', 'Inserts', 'Threads'],
    primeEligible: true,
    searchQuery: 'heat set threaded inserts 3d printing kit',
  },
  {
    id: 'assembly-adhesives',
    title: 'Assembly Adhesives',
    category: 'Post-processing',
    description: 'CA glue, activators, and epoxies that bond multi-part prints.',
    priceHint: 'From $8',
    highlights: ['Thick & thin CA', 'Activator sprays', 'Epoxy syringes'],
    tags: ['Adhesives', 'Assembly', 'Finishing'],
    primeEligible: true,
    searchQuery: 'CA glue activator 3d prints',
  },
  {
    id: 'lighting-rigs',
    title: 'Lighting & Accent',
    category: 'Workspace',
    description: 'LED strip kits, task lights, and backdrop lamps for showcase shots.',
    priceHint: 'From $20',
    highlights: ['RGB + daylight', 'USB-powered bars', 'Diffused channels'],
    tags: ['Lighting', 'Workspace', 'Showcase'],
    primeEligible: true,
    searchQuery: '3d printer led light kit',
  },
] satisfies Array<Omit<AmazonShopItem, 'image'>>

const rawItems: AmazonShopItem[] = collectionSeeds.map((item, index) => ({
  ...item,
  image: createGearCardImage(
    item.title,
    gearAccentPalette[index % gearAccentPalette.length],
  ),
}))

export const amazonShopItems: AmazonShopItemWithUrl[] = rawItems.map((item) => {
  const normalizedManual = item.manualUrl
    ? normalizeAmazonAffiliateUrl(item.manualUrl)
    : null
  const searchTerm = item.searchQuery
    ? `${item.searchQuery}`.trim()
    : DEFAULT_AMAZON_QUERY
  return {
    ...item,
    url:
      normalizedManual ||
      buildAmazonSearchUrl(searchTerm, `makerworks_v2_store_${item.id}`),
  }
})
