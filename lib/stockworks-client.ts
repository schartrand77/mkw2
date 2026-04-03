import { NextResponse } from 'next/server'
import { normalizeServiceBaseUrl } from '@/lib/service-base-url'

type StockworksSession = { cookie: string; csrfToken?: string | null }
type StockworksListResponse<T> = {
  items?: T[]
  results?: T[]
  data?: T[]
  inventory?: T[]
  materials?: T[]
}

const STOCKWORKS_TIMEOUT_MS = readPositiveInt(process.env.STOCKWORKS_TIMEOUT_MS, 12000)

function readPositiveInt(raw: string | undefined, fallback: number) {
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

async function fetchWithTimeout(url: string, init?: RequestInit, timeoutMs = STOCKWORKS_TIMEOUT_MS) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, {
      ...init,
      signal: init?.signal ?? controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }
}

function resolveConfig() {
  const baseUrl = normalizeServiceBaseUrl(process.env.STOCKWORKS_BASE_URL)
  const username = process.env.STOCKWORKS_ADMIN_USERNAME || process.env.STOCKWORKS_USERNAME || ''
  const password = process.env.STOCKWORKS_ADMIN_PASSWORD || process.env.STOCKWORKS_PASSWORD || ''
  return { baseUrl, username, password }
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function summarizeStockworksPayload(value: unknown, depth = 0): string {
  if (depth > 4 || value == null) return ''
  const direct = normalizeText(value)
  if (direct) return direct
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    const parts = value
      .map((entry) => summarizeStockworksPayload(entry, depth + 1))
      .filter(Boolean)
    return parts.join('; ')
  }
  if (typeof value === 'object') {
    const row = value as Record<string, unknown>
    const loc = Array.isArray(row.loc)
      ? row.loc.map((entry) => normalizeText(entry)).filter(Boolean).join('.')
      : normalizeText(row.loc)
    const msg = summarizeStockworksPayload(
      row.msg ?? row.message ?? row.error ?? row.detail ?? row.reason,
      depth + 1,
    )
    if (loc && msg) return `${loc}: ${msg}`
    if (msg) return msg
    try {
      return JSON.stringify(row)
    } catch {
      return ''
    }
  }
  return ''
}

export function stockworksErrorMessage(body: unknown, fallback: string) {
  const detail = summarizeStockworksPayload((body as any)?.detail)
  if (detail) return detail
  const error = summarizeStockworksPayload((body as any)?.error)
  if (error) return error
  const message = summarizeStockworksPayload((body as any)?.message ?? (body as any)?.msg)
  if (message) return message
  const generic = summarizeStockworksPayload(body)
  if (generic) return generic
  return fallback
}

function extractCookies(headers: Headers) {
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie
  const setCookies = typeof getSetCookie === 'function' ? getSetCookie.call(headers) : null
  const raw = setCookies && setCookies.length > 0
    ? setCookies
    : (headers.get('set-cookie') ? [headers.get('set-cookie') as string] : [])
  const pairs = raw
    .map((entry) => entry.split(';')[0]?.trim() || '')
    .filter(Boolean)
  return pairs
}

function mergeCookiePairs(...groups: string[][]) {
  const map = new Map<string, string>()
  for (const group of groups) {
    for (const pair of group) {
      const idx = pair.indexOf('=')
      if (idx <= 0) continue
      const key = pair.slice(0, idx).trim()
      const value = pair.slice(idx + 1).trim()
      if (!key) continue
      map.set(key, value)
    }
  }
  return Array.from(map.entries()).map(([key, value]) => `${key}=${value}`).join('; ')
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

function extractCsrfToken(html: string) {
  const nameFirst = html.match(/name=["']csrf_token["'][^>]*value=["']([^"']+)["']/i)
  if (nameFirst?.[1]) return nameFirst[1]
  const valueFirst = html.match(/value=["']([^"']+)["'][^>]*name=["']csrf_token["']/i)
  return valueFirst?.[1] || null
}

async function login(baseUrl: string, username: string, password: string): Promise<StockworksSession> {
  const loginPage = await fetchWithTimeout(`${baseUrl}/login`, {
    method: 'GET',
    cache: 'no-store',
  })
  if (!loginPage.ok) {
    throw Object.assign(new Error(`StockWorks login page request failed (${loginPage.status})`), {
      status: 502,
    })
  }
  const loginPageCookies = extractCookies(loginPage.headers)
  const loginPageHtml = await loginPage.text().catch(() => '')
  const csrfFromForm = extractCsrfToken(loginPageHtml)
  const csrfFromCookie = extractCsrfFromCookieHeader(loginPageCookies.join('; '))
  const csrfToken = csrfFromCookie || csrfFromForm

  const payload = new URLSearchParams({ username, password })
  if (csrfFromForm) payload.set('csrf_token', csrfFromForm)

  const headers = new Headers({ 'Content-Type': 'application/x-www-form-urlencoded' })
  if (loginPageCookies.length > 0) headers.set('Cookie', mergeCookiePairs(loginPageCookies))
  headers.set('Referer', `${baseUrl}/login`)
  if (csrfToken) {
    headers.set('X-CSRFToken', csrfToken)
    headers.set('X-CSRF-Token', csrfToken)
  }

  const response = await fetchWithTimeout(`${baseUrl}/login`, {
    method: 'POST',
    headers,
    body: payload.toString(),
    redirect: 'manual',
    cache: 'no-store',
  })
  if (response.status === 401 || response.status === 403) {
    throw Object.assign(new Error('StockWorks authentication failed'), {
      status: 502,
    })
  }
  const loginResponseCookies = extractCookies(response.headers)
  const cookie = mergeCookiePairs(loginPageCookies, loginResponseCookies)
  if (!cookie) {
    throw Object.assign(new Error('StockWorks authentication failed'), {
      status: 502,
    })
  }
  const csrfMerged = extractCsrfFromCookieHeader(cookie) || csrfToken
  return { cookie, csrfToken: csrfMerged }
}

export async function getStockworksSession(): Promise<{ baseUrl: string; cookie: string; csrfToken?: string | null }> {
  const { baseUrl, username, password } = resolveConfig()
  if (!baseUrl || !username || !password) {
    throw new Error('StockWorks is not configured')
  }
  const session = await login(baseUrl, username, password)
  return { baseUrl, cookie: session.cookie, csrfToken: session.csrfToken }
}

export async function stockworksFetch(path: string, init?: RequestInit) {
  const { baseUrl, cookie, csrfToken } = await getStockworksSession()
  const url = `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`
  const headers = new Headers(init?.headers)
  headers.set('Cookie', cookie)
  const method = String(init?.method || 'GET').toUpperCase()
  const isMutating = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS'
  if (isMutating && csrfToken) {
    headers.set('X-CSRFToken', csrfToken)
    headers.set('X-CSRF-Token', csrfToken)
  }
  const response = await fetchWithTimeout(url, {
    ...init,
    headers,
    cache: 'no-store',
  })
  return response
}

export async function stockworksJson(path: string, init?: RequestInit) {
  const response = await stockworksFetch(path, init)
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw Object.assign(new Error('StockWorks upstream denied the request. Check StockWorks credentials/permissions.'), {
        status: 502,
        payload: body,
      })
    }
    throw Object.assign(new Error(stockworksErrorMessage(body, `StockWorks request failed (${response.status})`)), {
      status: response.status,
      payload: body,
    })
  }
  return body
}

export function stockworksList<T>(input: unknown): T[] {
  if (Array.isArray(input)) return input as T[]
  if (input && typeof input === 'object') {
    const row = input as StockworksListResponse<T>
    if (Array.isArray(row.items)) return row.items
    if (Array.isArray(row.results)) return row.results
    if (Array.isArray(row.data)) return row.data
    if (Array.isArray(row.inventory)) return row.inventory
    if (Array.isArray(row.materials)) return row.materials
  }
  return []
}

export function stockworksDisabledResponse() {
  return NextResponse.json({ enabled: false, error: 'StockWorks is not configured.' }, { status: 400 })
}
