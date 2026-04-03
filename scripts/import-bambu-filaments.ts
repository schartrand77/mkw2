import 'dotenv/config'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

type StockworksMaterial = {
  id?: number
  name?: string | null
  brand?: string | null
  filament_type?: string | null
  category?: string | null
  color?: string | null
  spool_weight_grams?: number | null
}

type StockworksInventoryRow = {
  material?: StockworksMaterial | null
}

type StockworksListResponse<T> = {
  items?: T[]
  results?: T[]
  data?: T[]
  total?: number
  limit?: number
  offset?: number
}

type BambuVariant = {
  sku?: string
  name?: string
  offers?: {
    url?: string
    price?: number | string
    availability?: string
  }
}

type BambuProductGroup = {
  name?: string
  url?: string
  hasVariant?: BambuVariant[]
}

type ImportRow = {
  name: string
  brand: string
  filament_type: string
  category: string
  color: string
  price_per_gram?: number
  spool_weight_grams?: number
  notes: string
}

const BAMBULAB_COLLECTION_URL = 'https://ca.store.bambulab.com/collections/bambu-lab-3d-printer-filament?By+Material=All'
const BAMBULAB_PRODUCT_URL = 'https://ca.store.bambulab.com/products'
const BAMBULAB_BRAND = 'Bambu Lab'
const CACHE_DIR = path.join(process.cwd(), '.tmp', 'bambu-filament-cache')
const BAMBU_HEADERS = {
  'User-Agent': 'MakerWorks/1.0 (+https://github.com/steph/mkwV2)',
  'Accept-Language': 'en-CA,en;q=0.9',
} as const
const KNOWN_TYPES = ['PETG', 'PLA', 'ABS', 'ASA', 'TPU', 'PA6', 'PAHT', 'PPA', 'PPS', 'PET', 'PC'] as const
const IGNORED_HANDLES = new Set(['bambu-reusable-spool', 'h2c', 'h2d', 'h2s', 'p2s'])
const FALLBACK_HANDLES = [
  'abs-filament',
  'abs-gf',
  'asa-aero',
  'asa-cf',
  'asa-filament',
  'pa6-cf',
  'pa6-gf',
  'paht-cf',
  'pet-cf',
  'petg-cf',
  'petg-hf',
  'petg-translucent',
  'pla-aero',
  'pla-basic-beginner-s-filament-pack',
  'pla-basic-filament',
  'pla-basic-gradient',
  'pla-cf',
  'pla-cmyk-lithophane',
  'pla-galaxy',
  'pla-glow',
  'pla-marble',
  'pla-matte',
  'pla-metal',
  'pla-silk-multi-color',
  'pla-silk-upgrade',
  'pla-sparkle',
  'pla-tough-upgrade',
  'pla-translucent',
  'pla-wood',
  'ppa-cf',
  'pps-cf',
  'tpu-85a-tpu-90a',
  'tpu-95a-hf',
  'tpu-for-ams',
] as const
const MANUAL_FALLBACK_GROUPS: Partial<Record<(typeof FALLBACK_HANDLES)[number], BambuProductGroup>> = {
  'ppa-cf': {
    name: 'PPA-CF',
    url: `${BAMBULAB_PRODUCT_URL}/ppa-cf`,
    hasVariant: [
      {
        name: 'PPA-CF - Black (N06-K0) / Filament with spool / 0.75 kg',
        offers: { url: `${BAMBULAB_PRODUCT_URL}/ppa-cf` },
      },
    ],
  },
  'pps-cf': {
    name: 'PPS-CF',
    url: `${BAMBULAB_PRODUCT_URL}/pps-cf`,
    hasVariant: [
      {
        name: 'PPS-CF - Black (73100) / Filament with spool / 0.75 kg',
        offers: { url: `${BAMBULAB_PRODUCT_URL}/pps-cf` },
      },
    ],
  },
  'tpu-95a-hf': {
    name: 'TPU 95A HF',
    url: `${BAMBULAB_PRODUCT_URL}/tpu-95a-hf`,
    hasVariant: ['White (51105)', 'Yellow (51400)', 'Blue (51600)', 'Red (51200)', 'Gray (51102)', 'Black (51103)'].map((color) => ({
      name: `TPU 95A HF - ${color} / Filament with spool / 1 kg`,
      offers: { url: `${BAMBULAB_PRODUCT_URL}/tpu-95a-hf` },
    })),
  },
  'tpu-for-ams': {
    name: 'TPU for AMS',
    url: `${BAMBULAB_PRODUCT_URL}/tpu-for-ams`,
    hasVariant: ['White (53100)', 'Black (53101)', 'Gray (53102)', 'Red (53200)', 'Yellow (53400)', 'Neon Green (53500)', 'Blue (53600)'].map((color) => ({
      name: `TPU for AMS - ${color} / Filament with spool / 1 kg`,
      offers: { url: `${BAMBULAB_PRODUCT_URL}/tpu-for-ams` },
    })),
  },
  'tpu-85a-tpu-90a': {
    name: 'TPU 85A/90A',
    url: `${BAMBULAB_PRODUCT_URL}/tpu-85a-tpu-90a`,
    hasVariant: [
      'TPU 85A Light Cyan (51500)',
      'TPU 85A Neon Orange (51305)',
      'TPU 90A Frozen (51900)',
      'TPU 90A Blaze (51901)',
      'TPU 90A White (51105)',
      'TPU 90A Black (51103)',
    ].map((color) => ({
      name: `TPU 85A/90A - ${color} / Filament with spool / 1 kg`,
      offers: { url: `${BAMBULAB_PRODUCT_URL}/tpu-85a-tpu-90a` },
    })),
  },
}

function normalize(value: unknown) {
  return String(value || '').trim().toLowerCase()
}

function toList<T>(input: unknown): T[] {
  if (Array.isArray(input)) return input as T[]
  if (input && typeof input === 'object') {
    const row = input as StockworksListResponse<T>
    if (Array.isArray(row.items)) return row.items
    if (Array.isArray(row.results)) return row.results
    if (Array.isArray(row.data)) return row.data
  }
  return []
}

function parseSetCookies(headers: Headers) {
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie
  const raw = typeof getSetCookie === 'function'
    ? getSetCookie.call(headers)
    : headers.get('set-cookie')
      ? [headers.get('set-cookie') as string]
      : []
  return raw
    .map((entry) => entry.split(';')[0]?.trim() || '')
    .filter(Boolean)
}

function mergeCookies(...groups: string[][]) {
  const map = new Map<string, string>()
  for (const group of groups) {
    for (const pair of group) {
      const idx = pair.indexOf('=')
      if (idx <= 0) continue
      map.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim())
    }
  }
  return Array.from(map.entries()).map(([key, value]) => `${key}=${value}`).join('; ')
}

function extractCsrfToken(html: string) {
  const nameFirst = html.match(/name=["']csrf_token["'][^>]*value=["']([^"']+)["']/i)
  if (nameFirst?.[1]) return nameFirst[1]
  const valueFirst = html.match(/value=["']([^"']+)["'][^>]*name=["']csrf_token["']/i)
  return valueFirst?.[1] || null
}

function extractCsrfFromCookieHeader(cookieHeader: string) {
  const pairs = cookieHeader.split(';').map((entry) => entry.trim())
  let stockworksSessionValue: string | null = null
  for (const pair of pairs) {
    const idx = pair.indexOf('=')
    if (idx <= 0) continue
    const key = pair.slice(0, idx).trim().toLowerCase()
    const value = pair.slice(idx + 1).trim()
    if (!value) continue
    if (key === 'csrftoken' || key === 'csrf_token' || key === 'csrf') return value
    if (key === 'stockworks-session') stockworksSessionValue = value
  }

  if (stockworksSessionValue) {
    try {
      const payloadPart = stockworksSessionValue.split('.')[0] || ''
      const decoded = Buffer.from(payloadPart, 'base64url').toString('utf8')
      const parsed = JSON.parse(decoded)
      const embedded = typeof parsed?.csrf_token === 'string' ? parsed.csrf_token.trim() : ''
      if (embedded) return embedded
    } catch {}
  }
  return null
}

async function getStockworksSession() {
  const baseUrl = (process.env.STOCKWORKS_BASE_URL || '').replace(/\/+$/, '')
  const username = process.env.STOCKWORKS_ADMIN_USERNAME || process.env.STOCKWORKS_USERNAME || ''
  const password = process.env.STOCKWORKS_ADMIN_PASSWORD || process.env.STOCKWORKS_PASSWORD || ''
  if (!baseUrl || !username || !password) {
    throw new Error('StockWorks credentials are not configured.')
  }

  const loginPage = await fetch(`${baseUrl}/login`, { cache: 'no-store' })
  if (!loginPage.ok) throw new Error(`StockWorks login page request failed (${loginPage.status}).`)
  const loginPageHtml = await loginPage.text()
  const loginPageCookies = parseSetCookies(loginPage.headers)
  const csrfToken = extractCsrfToken(loginPageHtml)

  const body = new URLSearchParams({ username, password })
  if (csrfToken) body.set('csrf_token', csrfToken)
  const headers = new Headers({ 'Content-Type': 'application/x-www-form-urlencoded' })
  if (loginPageCookies.length > 0) headers.set('Cookie', mergeCookies(loginPageCookies))
  headers.set('Referer', `${baseUrl}/login`)
  if (csrfToken) {
    headers.set('X-CSRFToken', csrfToken)
    headers.set('X-CSRF-Token', csrfToken)
  }

  const response = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers,
    body: body.toString(),
    redirect: 'manual',
    cache: 'no-store',
  })
  if (response.status === 401 || response.status === 403) {
    throw new Error('StockWorks authentication failed.')
  }

  const responseCookies = parseSetCookies(response.headers)
  const cookie = mergeCookies(loginPageCookies, responseCookies)
  if (!cookie) throw new Error('StockWorks authentication failed.')
  return {
    baseUrl,
    cookie,
    csrfToken: extractCsrfFromCookieHeader(cookie) || csrfToken,
  }
}

async function stockworksFetch(path: string, init?: RequestInit) {
  const { baseUrl, cookie, csrfToken } = await getStockworksSession()
  const headers = new Headers(init?.headers)
  headers.set('Cookie', cookie)
  const method = String(init?.method || 'GET').toUpperCase()
  const isMutating = !['GET', 'HEAD', 'OPTIONS'].includes(method)
  if (isMutating && csrfToken) {
    headers.set('X-CSRFToken', csrfToken)
    headers.set('X-CSRF-Token', csrfToken)
  }
  return fetch(`${baseUrl}${path.startsWith('/') ? path : `/${path}`}`, {
    ...init,
    headers,
    cache: 'no-store',
  })
}

async function stockworksJson(path: string, init?: RequestInit) {
  const response = await stockworksFetch(path, init)
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const detail = (() => {
      if (typeof body?.detail === 'string') return body.detail
      if (typeof body?.error === 'string') return body.error
      if (typeof body?.message === 'string') return body.message
      if (body && typeof body === 'object') {
        try {
          return JSON.stringify(body)
        } catch {}
      }
      return null
    })()
    const message = detail
      ? `StockWorks request failed (${response.status}): ${detail}`
      : `StockWorks request failed (${response.status}).`
    throw new Error(message)
  }
  return body
}

async function listAllStockworksMaterials() {
  const output: StockworksMaterial[] = []
  let offset = 0
  const limit = 200
  for (let i = 0; i < 100; i += 1) {
    const page = await stockworksJson(`/materials?limit=${limit}&offset=${offset}`) as StockworksListResponse<StockworksMaterial>
    const items = toList<StockworksMaterial>(page)
    output.push(...items)
    const total = Number(page.total)
    if (!Number.isFinite(total) || output.length >= total || items.length < limit) break
    offset += limit
  }
  return output
}

async function fetchText(url: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: BAMBU_HEADERS,
    })
    if (response.ok) return response.text()
    if (response.status !== 429 && response.status < 500) {
      throw new Error(`Request failed for ${url} (${response.status}).`)
    }
    const retryAfterSeconds = Number(response.headers.get('retry-after'))
    const retryAfterMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
      ? retryAfterSeconds * 1000
      : (attempt + 1) * 2500
    await new Promise((resolve) => setTimeout(resolve, retryAfterMs))
  }
  throw new Error(`Request failed for ${url} after multiple retries.`)
}

async function fetchCollectionHandles() {
  try {
    const html = await fetchText(BAMBULAB_COLLECTION_URL)
    const matches = [...html.matchAll(/\/products\/([a-z0-9-]+)(?=["'?/\\\s<])/gi)]
    const handles = [...new Set(matches.map((match) => match[1]).filter((handle) => !IGNORED_HANDLES.has(handle)))].sort()
    if (handles.length > 0) return handles
  } catch (error) {
    console.warn(`Collection discovery failed, using fallback handle list. ${error instanceof Error ? error.message : String(error)}`)
  }
  return [...FALLBACK_HANDLES]
}

async function readCachedGroup(handle: string) {
  try {
    const raw = await readFile(path.join(CACHE_DIR, `${handle}.json`), 'utf8')
    const parsed = JSON.parse(raw) as BambuProductGroup
    if (parsed && Array.isArray(parsed.hasVariant) && parsed.hasVariant.length > 0) return parsed
  } catch {}
  return null
}

async function writeCachedGroup(handle: string, group: BambuProductGroup) {
  await mkdir(CACHE_DIR, { recursive: true })
  await writeFile(path.join(CACHE_DIR, `${handle}.json`), JSON.stringify(group, null, 2))
}

function extractProductGroupSchema(html: string) {
  const matches = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
  for (const match of matches) {
    try {
      const parsed = JSON.parse(match[1]) as BambuProductGroup | BambuProductGroup[]
      const entries = Array.isArray(parsed) ? parsed : [parsed]
      const group = entries.find((entry) => Array.isArray(entry?.hasVariant) && entry.hasVariant.length > 0)
      if (group) return group
    } catch {}
  }
  return null
}

function parseProductGroupName(value: string) {
  const name = value.trim()
  const upper = name.toUpperCase()
  const matchedType = [...KNOWN_TYPES].sort((a, b) => b.length - a.length).find((token) =>
    upper === token
    || upper.startsWith(`${token} `)
    || upper.startsWith(`${token}-`))
  if (!matchedType) return null
  const category = name.slice(matchedType.length).replace(/^[-\s]+/, '').trim() || 'Standard'
  return { filamentType: matchedType, category }
}

function parseSpoolWeightGrams(parts: string[]) {
  for (const part of parts) {
    const match = part.match(/(\d+(?:\.\d+)?)\s*(kg|g)\b/i)
    if (!match) continue
    const value = Number(match[1])
    if (!Number.isFinite(value) || value <= 0) continue
    return match[2].toLowerCase() === 'kg' ? Math.round(value * 1000) : Math.round(value)
  }
  return undefined
}

function cleanColorName(color: string, category: string) {
  let value = color.trim()
  value = value.replace(/\s*\(\d+\)\s*$/g, '').trim()
  if (normalize(category) !== 'standard') {
    const categoryPattern = new RegExp(`^${category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+`, 'i')
    value = value.replace(categoryPattern, '').trim()
  }
  return value || color.trim()
}

function choosePreferredVariant(variants: BambuVariant[]) {
  return [...variants].sort((left, right) => {
    const leftName = normalize(left.name)
    const rightName = normalize(right.name)
    const leftRefill = leftName.includes('refill') ? 1 : 0
    const rightRefill = rightName.includes('refill') ? 1 : 0
    if (leftRefill !== rightRefill) return rightRefill - leftRefill
    const leftPrice = Number(left.offers?.price || 0)
    const rightPrice = Number(right.offers?.price || 0)
    return leftPrice - rightPrice
  })[0] || null
}

function buildImportRows(group: BambuProductGroup) {
  const groupName = String(group.name || '').trim()
  const parsedGroup = parseProductGroupName(groupName)
  if (!parsedGroup) return []
  const grouped = new Map<string, BambuVariant[]>()
  for (const variant of group.hasVariant || []) {
    const variantName = String(variant.name || '').trim()
    if (!variantName) continue
    const remainder = variantName.startsWith(`${groupName} - `)
      ? variantName.slice(groupName.length + 3)
      : variantName.startsWith(groupName)
        ? variantName.slice(groupName.length).replace(/^\s*-\s*/, '')
        : variantName
    const parts = remainder.split('/').map((part) => part.trim()).filter(Boolean)
    const color = cleanColorName(parts[0] || remainder, parsedGroup.category)
    if (!color) continue
    const key = normalize(`${parsedGroup.filamentType}|${parsedGroup.category}|${color}`)
    const list = grouped.get(key) || []
    list.push(variant)
    grouped.set(key, list)
  }

  const output: ImportRow[] = []
  for (const variants of grouped.values()) {
    const variant = choosePreferredVariant(variants)
    if (!variant) continue
    const variantName = String(variant.name || '').trim()
    const remainder = variantName.startsWith(`${groupName} - `)
      ? variantName.slice(groupName.length + 3)
      : variantName.startsWith(groupName)
        ? variantName.slice(groupName.length).replace(/^\s*-\s*/, '')
        : variantName
    const parts = remainder.split('/').map((part) => part.trim()).filter(Boolean)
    const color = cleanColorName(parts[0] || remainder, parsedGroup.category)
    const spoolWeightGrams = parseSpoolWeightGrams(parts)
    const price = Number(variant.offers?.price)
    const notes = [
      `Imported from Bambu Lab Canada on ${new Date().toISOString().slice(0, 10)}.`,
      variant.sku ? `Bambu SKU: ${variant.sku}.` : null,
      variant.offers?.availability ? `Availability: ${String(variant.offers.availability).split('/').pop()}.` : null,
      variant.offers?.url || group.url || `${BAMBULAB_PRODUCT_URL}/${encodeURIComponent(groupName)}`,
    ].filter(Boolean).join(' ')
    output.push({
      name: variantName,
      brand: BAMBULAB_BRAND,
      filament_type: parsedGroup.filamentType,
      category: parsedGroup.category,
      color,
      price_per_gram: Number.isFinite(price) ? Number(price.toFixed(2)) : 0,
      spool_weight_grams: spoolWeightGrams,
      notes,
    })
  }
  return output
}

function materialKey(material: Pick<StockworksMaterial, 'brand' | 'filament_type' | 'category' | 'color'>) {
  return [
    normalize(material.brand || BAMBULAB_BRAND),
    normalize(material.filament_type),
    normalize(material.category),
    normalize(material.color),
  ].join('|')
}

async function main() {
  const apply = process.argv.includes('--apply')
  const handles = await fetchCollectionHandles()
  const groups: BambuProductGroup[] = []
  for (const handle of handles) {
    const cached = await readCachedGroup(handle)
    if (cached) {
      groups.push(cached)
      continue
    }
    let group: BambuProductGroup | null = null
    try {
      const html = await fetchText(`${BAMBULAB_PRODUCT_URL}/${handle}`)
      group = extractProductGroupSchema(html)
    } catch (error) {
      const fallback = MANUAL_FALLBACK_GROUPS[handle as keyof typeof MANUAL_FALLBACK_GROUPS] || null
      if (fallback) {
        console.warn(`Using manual fallback for ${handle}. ${error instanceof Error ? error.message : String(error)}`)
        group = fallback
      } else {
        throw error
      }
    }
    if (!group) {
      const fallback = MANUAL_FALLBACK_GROUPS[handle as keyof typeof MANUAL_FALLBACK_GROUPS] || null
      if (!fallback) {
        console.warn(`Skipping ${handle}: no product schema found.`)
        continue
      }
      group = fallback
    }
    await writeCachedGroup(handle, group)
    groups.push(group)
    await new Promise((resolve) => setTimeout(resolve, 700))
  }

  const importRows = groups.flatMap(buildImportRows)
  const uniqueRows = new Map<string, ImportRow>()
  for (const row of importRows) {
    uniqueRows.set(materialKey(row), row)
  }

  const existing = await listAllStockworksMaterials()
  const existingKeys = new Set(existing.map((material) => materialKey(material)))
  const missing = [...uniqueRows.values()].filter((row) => !existingKeys.has(materialKey(row)))
    .sort((a, b) =>
      a.filament_type.localeCompare(b.filament_type)
      || a.category.localeCompare(b.category)
      || a.color.localeCompare(b.color))

  console.log(`Discovered ${groups.length} Bambu product groups and ${uniqueRows.size} distinct material/color entries.`)
  console.log(`StockWorks already has ${existing.length} materials; ${missing.length} Bambu entries are missing.`)
  if (!apply) {
    console.log('Dry run only. Re-run with --apply to create missing materials.')
    for (const row of missing.slice(0, 30)) {
      console.log(`${row.filament_type} | ${row.category} | ${row.color} | ${row.name}`)
    }
    return
  }

  let created = 0
  for (const row of missing) {
    try {
      await stockworksJson('/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(row),
      })
    } catch (error) {
      console.error(`Failed row: ${JSON.stringify(row)}`)
      throw error
    }
    created += 1
    console.log(`Created ${created}/${missing.length}: ${row.filament_type} | ${row.category} | ${row.color}`)
  }
}

main().catch((error) => {
  if (error instanceof Error) {
    console.error(error.stack || error.message)
  } else {
    console.error(String(error))
  }
  process.exit(1)
})
