import { NextResponse } from 'next/server'
import { normalizeServiceBaseUrl } from '@/lib/service-base-url'
import { getEffectiveSuiteRuntimeSettings } from '@/lib/suite-runtime'

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

async function resolveConfig() {
  const runtime = await getEffectiveSuiteRuntimeSettings([
    'stockworksBaseUrl',
    'stockworksUsername',
    'stockworksPassword',
  ])
  const baseUrl = normalizeServiceBaseUrl(runtime.stockworksBaseUrl.value || process.env.STOCKWORKS_BASE_URL)
  const username = runtime.stockworksUsername.value || process.env.STOCKWORKS_ADMIN_USERNAME || process.env.STOCKWORKS_USERNAME || ''
  const password = runtime.stockworksPassword.value || process.env.STOCKWORKS_ADMIN_PASSWORD || process.env.STOCKWORKS_PASSWORD || ''
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

function stockworksBasicAuthHeader(username: string, password: string) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
}

export async function getStockworksSession(): Promise<{ baseUrl: string; authHeader: string }> {
  const { baseUrl, username, password } = await resolveConfig()
  if (!baseUrl || !username || !password) {
    throw new Error('StockWorks is not configured')
  }
  return { baseUrl, authHeader: stockworksBasicAuthHeader(username, password) }
}

export async function stockworksFetch(path: string, init?: RequestInit) {
  const { baseUrl, authHeader } = await getStockworksSession()
  const url = `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`
  const headers = new Headers(init?.headers)
  headers.set('Authorization', authHeader)
  try {
    return await fetchWithTimeout(url, {
      ...init,
      headers,
      cache: 'no-store',
    })
  } catch (cause: any) {
    throw Object.assign(
      new Error(
        `Unable to reach StockWorks at ${baseUrl}. Confirm STOCKWORKS_BASE_URL is reachable from the MakerWorks container, both containers are on the shared Docker network, and StockWorks is listening on the configured internal port.`,
      ),
      { status: 502, cause },
    )
  }
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
