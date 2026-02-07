import { NextResponse } from 'next/server'

type StockworksSession = { cookie: string }

function resolveConfig() {
  const baseUrl = (process.env.STOCKWORKS_BASE_URL || '').replace(/\/+$/, '')
  const username = process.env.STOCKWORKS_ADMIN_USERNAME || process.env.STOCKWORKS_USERNAME || ''
  const password = process.env.STOCKWORKS_ADMIN_PASSWORD || process.env.STOCKWORKS_PASSWORD || ''
  return { baseUrl, username, password }
}

async function login(baseUrl: string, username: string, password: string): Promise<StockworksSession> {
  const payload = new URLSearchParams({ username, password })
  const response = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: payload.toString(),
    redirect: 'manual',
    cache: 'no-store',
  })
  const cookie = response.headers.get('set-cookie')
  if (!cookie) throw new Error('StockWorks authentication failed')
  return { cookie: cookie.split(';')[0] }
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
  const response = await fetch(url, {
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