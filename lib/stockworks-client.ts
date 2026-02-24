import { NextResponse } from 'next/server'

type StockworksSession = { cookie: string }

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
  const baseUrl = (process.env.STOCKWORKS_BASE_URL || '').replace(/\/+$/, '')
  const username = process.env.STOCKWORKS_ADMIN_USERNAME || process.env.STOCKWORKS_USERNAME || ''
  const password = process.env.STOCKWORKS_ADMIN_PASSWORD || process.env.STOCKWORKS_PASSWORD || ''
  return { baseUrl, username, password }
}

function extractCookie(headers: Headers) {
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie
  const setCookies = typeof getSetCookie === 'function' ? getSetCookie.call(headers) : null
  const raw = setCookies?.[0] || headers.get('set-cookie') || ''
  const first = raw.split(';')[0]?.trim()
  return first || null
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
  const loginPageCookie = extractCookie(loginPage.headers)
  const loginPageHtml = await loginPage.text().catch(() => '')
  const csrfToken = extractCsrfToken(loginPageHtml)

  const payload = new URLSearchParams({ username, password })
  if (csrfToken) payload.set('csrf_token', csrfToken)

  const headers = new Headers({ 'Content-Type': 'application/x-www-form-urlencoded' })
  if (loginPageCookie) headers.set('Cookie', loginPageCookie)
  headers.set('Referer', `${baseUrl}/login`)

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
  const cookie = extractCookie(response.headers) || loginPageCookie
  if (!cookie) {
    throw Object.assign(new Error('StockWorks authentication failed'), {
      status: 502,
    })
  }
  return { cookie }
}

export async function getStockworksSession(): Promise<{ baseUrl: string; cookie: string }> {
  const { baseUrl, username, password } = resolveConfig()
  if (!baseUrl || !username || !password) {
    throw new Error('StockWorks is not configured')
  }
  const session = await login(baseUrl, username, password)
  return { baseUrl, cookie: session.cookie }
}

export async function stockworksFetch(path: string, init?: RequestInit) {
  const { baseUrl, cookie } = await getStockworksSession()
  const url = `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`
  const headers = new Headers(init?.headers)
  headers.set('Cookie', cookie)
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
    throw Object.assign(new Error(body?.detail || body?.error || `StockWorks request failed (${response.status})`), {
      status: response.status,
      payload: body,
    })
  }
  return body
}

export function stockworksDisabledResponse() {
  return NextResponse.json({ enabled: false, error: 'StockWorks is not configured.' }, { status: 400 })
}
