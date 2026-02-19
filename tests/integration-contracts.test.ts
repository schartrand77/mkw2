import assert from 'node:assert/strict'
import test from 'node:test'

import { stockworksFetch, stockworksJson } from '../lib/stockworks-client'
import { fetchBambuPrinters } from '../lib/bambu-view'
import { prisma } from '../lib/db'
import { recordOrderWorksJob } from '../lib/orderworks'

const originalFetch = global.fetch

function restoreEnv(snapshot: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

test('StockWorks client authenticates via form login and forwards session cookie', async () => {
  const envSnapshot = {
    STOCKWORKS_BASE_URL: process.env.STOCKWORKS_BASE_URL,
    STOCKWORKS_ADMIN_USERNAME: process.env.STOCKWORKS_ADMIN_USERNAME,
    STOCKWORKS_ADMIN_PASSWORD: process.env.STOCKWORKS_ADMIN_PASSWORD,
  }
  process.env.STOCKWORKS_BASE_URL = 'https://stockworks.local'
  process.env.STOCKWORKS_ADMIN_USERNAME = 'admin'
  process.env.STOCKWORKS_ADMIN_PASSWORD = 'secret'

  const calls: Array<{ url: string; init?: RequestInit }> = []
  global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const requestUrl = String(url)
    calls.push({ url: requestUrl, init })
    if (requestUrl.endsWith('/login')) {
      return new Response('', {
        status: 302,
        headers: { 'set-cookie': 'session=abc123; Path=/; HttpOnly' },
      })
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  }) as typeof fetch

  try {
    const res = await stockworksFetch('/api/inventory')
    assert.equal(res.status, 200)
    assert.equal(calls.length, 2)
    assert.equal(calls[0]?.url, 'https://stockworks.local/login')
    assert.match(String(calls[0]?.init?.body || ''), /username=admin/)
    assert.match(String(calls[0]?.init?.body || ''), /password=secret/)
    assert.equal(calls[1]?.url, 'https://stockworks.local/api/inventory')
    const headers = new Headers(calls[1]?.init?.headers)
    assert.equal(headers.get('Cookie'), 'session=abc123')
  } finally {
    global.fetch = originalFetch
    restoreEnv(envSnapshot)
  }
})

test('StockWorks JSON helper surfaces status and payload for failed upstream response', async () => {
  const envSnapshot = {
    STOCKWORKS_BASE_URL: process.env.STOCKWORKS_BASE_URL,
    STOCKWORKS_ADMIN_USERNAME: process.env.STOCKWORKS_ADMIN_USERNAME,
    STOCKWORKS_ADMIN_PASSWORD: process.env.STOCKWORKS_ADMIN_PASSWORD,
  }
  process.env.STOCKWORKS_BASE_URL = 'https://stockworks.local'
  process.env.STOCKWORKS_ADMIN_USERNAME = 'admin'
  process.env.STOCKWORKS_ADMIN_PASSWORD = 'secret'

  global.fetch = (async (url: string | URL | Request) => {
    const requestUrl = String(url)
    if (requestUrl.endsWith('/login')) {
      return new Response('', {
        status: 302,
        headers: { 'set-cookie': 'session=abc123; Path=/; HttpOnly' },
      })
    }
    return new Response(JSON.stringify({ detail: 'upstream unavailable' }), { status: 503 })
  }) as typeof fetch

  try {
    await assert.rejects(
      () => stockworksJson('/api/inventory'),
      (err: any) => err?.status === 503 && err?.payload?.detail === 'upstream unavailable',
    )
  } finally {
    global.fetch = originalFetch
    restoreEnv(envSnapshot)
  }
})

test('Bambu View client sends configured auth headers', async () => {
  const envSnapshot = {
    BAMBU_VIEW_BASE_URL: process.env.BAMBU_VIEW_BASE_URL,
    BAMBU_VIEW_SESSION_COOKIE: process.env.BAMBU_VIEW_SESSION_COOKIE,
    BAMBU_VIEW_AUTH_HEADER: process.env.BAMBU_VIEW_AUTH_HEADER,
    BAMBU_VIEW_API_KEY: process.env.BAMBU_VIEW_API_KEY,
    BAMBU_VIEW_API_KEY_HEADER: process.env.BAMBU_VIEW_API_KEY_HEADER,
  }
  process.env.BAMBU_VIEW_BASE_URL = 'https://bambu.local'
  process.env.BAMBU_VIEW_SESSION_COOKIE = 'sid=xyz'
  process.env.BAMBU_VIEW_AUTH_HEADER = 'Bearer token'
  process.env.BAMBU_VIEW_API_KEY = 'abc'
  process.env.BAMBU_VIEW_API_KEY_HEADER = 'X-API-Key'

  let capturedHeaders: Headers | null = null
  global.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    capturedHeaders = new Headers(init?.headers)
    return new Response(JSON.stringify({ printers: [] }), { status: 200 })
  }) as typeof fetch

  try {
    const printers = await fetchBambuPrinters()
    assert.deepEqual(printers, [])
    if (!capturedHeaders) {
      throw new Error('Expected request headers to be captured')
    }
    const headers = capturedHeaders as Headers
    assert.equal(headers.get('Cookie'), 'sid=xyz')
    assert.equal(headers.get('Authorization'), 'Bearer token')
    assert.equal(headers.get('X-API-Key'), 'abc')
  } finally {
    global.fetch = originalFetch
    restoreEnv(envSnapshot)
  }
})

test('OrderWorks job contract normalizes payment metadata before persistence', async () => {
  const originalUpsert = (prisma.jobForm as any).upsert
  let capturedPayload: any = null
  ;(prisma.jobForm as any).upsert = async (payload: any) => {
    capturedPayload = payload
    return {
      id: 'job_1',
      paymentIntentId: payload.where.paymentIntentId,
      status: 'pending',
    }
  }

  try {
    await recordOrderWorksJob({
      paymentIntentId: 'pi_123',
      amountCents: 2599,
      currency: 'usd',
      lineItems: [
        {
          modelId: 'model_1',
          title: 'Widget',
          qty: 1,
          unitPrice: 25.99,
          lineTotal: 25.99,
          material: 'PLA',
          colors: ['#ffffff'],
          scale: 1,
        },
      ] as any,
      paymentMethod: 'credit card',
      paymentStatus: 'succeeded',
      metadata: { source: 'test' },
    })
    assert.ok(capturedPayload)
    assert.equal(capturedPayload.create.currency, 'USD')
    assert.equal(capturedPayload.create.paymentMethod, 'card')
    assert.equal(capturedPayload.create.paymentStatus, 'paid')
    assert.equal(capturedPayload.create.status, 'pending')
  } finally {
    ;(prisma.jobForm as any).upsert = originalUpsert
  }
})
