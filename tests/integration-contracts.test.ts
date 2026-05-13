import assert from 'node:assert/strict'
import test from 'node:test'

import { stockworksFetch, stockworksJson, stockworksList } from '../lib/stockworks-client'
import {
  fetchPrintLabJob,
  fetchPrintLabJobs,
  fetchPrintLabPrinters,
  fetchPrintLabSuccessfulGcodes,
} from '../lib/printlab'
import { prisma } from '../lib/db'
import { recordOrderWorksJob } from '../lib/orderworks'

const originalFetch = global.fetch

function restoreEnv(snapshot: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

test('StockWorks client uses Basic auth for service-to-service requests', async () => {
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
    return new Response(JSON.stringify({ items: [{ id: 1 }], total: 1 }), { status: 200 })
  }) as typeof fetch

  try {
    const res = await stockworksFetch('/movements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inventory_item_id: 1, movement_type: 'adjustment', change_grams: 10 }),
    })
    assert.equal(res.status, 200)
    assert.equal(calls.length, 1)
    assert.equal(calls[0]?.url, 'https://stockworks.local/movements')
    const headers = new Headers(calls[0]?.init?.headers)
    assert.equal(headers.get('Authorization'), `Basic ${Buffer.from('admin:secret').toString('base64')}`)
    assert.equal(headers.get('Cookie'), null)
    assert.equal(headers.get('X-CSRF-Token'), null)
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

  global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const requestUrl = String(url)
    if (requestUrl.endsWith('/login')) {
      if ((init?.method || 'GET').toUpperCase() === 'GET') {
        return new Response('<form><input type="hidden" name="csrf_token" value="csrf123" /></form>', {
          status: 200,
          headers: { 'set-cookie': 'session=prelogin; Path=/; HttpOnly' },
        })
      }
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

test('StockWorks client explains upstream network fetch failures', async () => {
  const envSnapshot = {
    STOCKWORKS_BASE_URL: process.env.STOCKWORKS_BASE_URL,
    STOCKWORKS_ADMIN_USERNAME: process.env.STOCKWORKS_ADMIN_USERNAME,
    STOCKWORKS_ADMIN_PASSWORD: process.env.STOCKWORKS_ADMIN_PASSWORD,
  }
  process.env.STOCKWORKS_BASE_URL = 'http://stockworks:8256'
  process.env.STOCKWORKS_ADMIN_USERNAME = 'admin'
  process.env.STOCKWORKS_ADMIN_PASSWORD = 'secret'

  global.fetch = (async () => {
    throw new TypeError('fetch failed')
  }) as typeof fetch

  try {
    await assert.rejects(
      () => stockworksJson('/inventory'),
      (err: any) => (
        err?.message?.includes('Unable to reach StockWorks at http://stockworks:8256') &&
        err?.message?.includes('shared Docker network') &&
        err?.message?.includes('internal port') &&
        err?.cause instanceof TypeError
      ),
    )
  } finally {
    global.fetch = originalFetch
    restoreEnv(envSnapshot)
  }
})

test('StockWorks list helper unwraps paginated payloads', () => {
  const items = stockworksList<{ id: number }>({ items: [{ id: 1 }, { id: 2 }], total: 2 } as any)
  assert.deepEqual(items, [{ id: 1 }, { id: 2 }])
})

test('PrintLab client sends configured auth headers', async () => {
  const envSnapshot = {
    PRINTLAB_BASE_URL: process.env.PRINTLAB_BASE_URL,
    PRINTLAB_SESSION_COOKIE: process.env.PRINTLAB_SESSION_COOKIE,
    PRINTLAB_AUTH_HEADER: process.env.PRINTLAB_AUTH_HEADER,
    PRINTLAB_API_KEY: process.env.PRINTLAB_API_KEY,
    PRINTLAB_API_KEY_HEADER: process.env.PRINTLAB_API_KEY_HEADER,
  }
  process.env.PRINTLAB_BASE_URL = 'https://printlab.local'
  process.env.PRINTLAB_SESSION_COOKIE = 'sid=xyz'
  process.env.PRINTLAB_AUTH_HEADER = 'Bearer token'
  process.env.PRINTLAB_API_KEY = 'abc'
  process.env.PRINTLAB_API_KEY_HEADER = 'X-API-Key'

  let capturedHeaders: Headers | null = null
  global.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    capturedHeaders = new Headers(init?.headers)
    return new Response(JSON.stringify({ printers: [] }), { status: 200 })
  }) as typeof fetch

  try {
    const printers = await fetchPrintLabPrinters()
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

test('PrintLab client fetches submitted jobs with a status filter', async () => {
  const envSnapshot = {
    PRINTLAB_BASE_URL: process.env.PRINTLAB_BASE_URL,
    PRINTLAB_SESSION_COOKIE: process.env.PRINTLAB_SESSION_COOKIE,
    PRINTLAB_AUTH_HEADER: process.env.PRINTLAB_AUTH_HEADER,
    PRINTLAB_API_KEY: process.env.PRINTLAB_API_KEY,
    PRINTLAB_API_KEY_HEADER: process.env.PRINTLAB_API_KEY_HEADER,
  }
  process.env.PRINTLAB_BASE_URL = 'https://printlab.local'
  delete process.env.PRINTLAB_SESSION_COOKIE
  delete process.env.PRINTLAB_AUTH_HEADER
  delete process.env.PRINTLAB_API_KEY
  delete process.env.PRINTLAB_API_KEY_HEADER

  const calls: string[] = []
  global.fetch = (async (url: string | URL | Request) => {
    calls.push(String(url))
    return new Response(JSON.stringify({ items: [{ id: 'job-1', status: 'completed' }] }), { status: 200 })
  }) as typeof fetch

  try {
    const jobs = await fetchPrintLabJobs({ status: 'completed' })
    assert.deepEqual(jobs, [{ id: 'job-1', status: 'completed' }])
    assert.deepEqual(calls, ['https://printlab.local/api/jobs?status=completed'])
  } finally {
    global.fetch = originalFetch
    restoreEnv(envSnapshot)
  }
})

test('PrintLab client fetches a submitted job by encoded ID', async () => {
  const envSnapshot = {
    PRINTLAB_BASE_URL: process.env.PRINTLAB_BASE_URL,
    PRINTLAB_SESSION_COOKIE: process.env.PRINTLAB_SESSION_COOKIE,
    PRINTLAB_AUTH_HEADER: process.env.PRINTLAB_AUTH_HEADER,
    PRINTLAB_API_KEY: process.env.PRINTLAB_API_KEY,
    PRINTLAB_API_KEY_HEADER: process.env.PRINTLAB_API_KEY_HEADER,
  }
  process.env.PRINTLAB_BASE_URL = 'https://printlab.local'
  delete process.env.PRINTLAB_SESSION_COOKIE
  delete process.env.PRINTLAB_AUTH_HEADER
  delete process.env.PRINTLAB_API_KEY
  delete process.env.PRINTLAB_API_KEY_HEADER

  const calls: string[] = []
  global.fetch = (async (url: string | URL | Request) => {
    calls.push(String(url))
    return new Response(JSON.stringify({ item: { id: 'job/1', status: 'completed' } }), { status: 200 })
  }) as typeof fetch

  try {
    const job = await fetchPrintLabJob(' job/1 ')
    assert.deepEqual(job, { id: 'job/1', status: 'completed' })
    assert.deepEqual(calls, ['https://printlab.local/api/jobs/job%2F1'])
    await assert.rejects(
      () => fetchPrintLabJob('   '),
      (err: any) => err?.status === 400 && err?.message === 'PrintLab job ID is required.',
    )
  } finally {
    global.fetch = originalFetch
    restoreEnv(envSnapshot)
  }
})

test('PrintLab client fetches successful G-code records', async () => {
  const envSnapshot = {
    PRINTLAB_BASE_URL: process.env.PRINTLAB_BASE_URL,
    PRINTLAB_SESSION_COOKIE: process.env.PRINTLAB_SESSION_COOKIE,
    PRINTLAB_AUTH_HEADER: process.env.PRINTLAB_AUTH_HEADER,
    PRINTLAB_API_KEY: process.env.PRINTLAB_API_KEY,
    PRINTLAB_API_KEY_HEADER: process.env.PRINTLAB_API_KEY_HEADER,
  }
  process.env.PRINTLAB_BASE_URL = 'https://printlab.local'
  delete process.env.PRINTLAB_SESSION_COOKIE
  delete process.env.PRINTLAB_AUTH_HEADER
  delete process.env.PRINTLAB_API_KEY
  delete process.env.PRINTLAB_API_KEY_HEADER

  const calls: string[] = []
  global.fetch = (async (url: string | URL | Request) => {
    calls.push(String(url))
    return new Response(JSON.stringify({ items: [{ id: 'gcode-1', file_name: 'plate.gcode' }] }), { status: 200 })
  }) as typeof fetch

  try {
    const records = await fetchPrintLabSuccessfulGcodes()
    assert.deepEqual(records, [{ id: 'gcode-1', file_name: 'plate.gcode' }])
    assert.deepEqual(calls, ['https://printlab.local/api/successful-gcodes'])
  } finally {
    global.fetch = originalFetch
    restoreEnv(envSnapshot)
  }
})

test('PrintLab client explains upstream network fetch failures', async () => {
  const envSnapshot = {
    PRINTLAB_BASE_URL: process.env.PRINTLAB_BASE_URL,
    PRINTLAB_SESSION_COOKIE: process.env.PRINTLAB_SESSION_COOKIE,
    PRINTLAB_AUTH_HEADER: process.env.PRINTLAB_AUTH_HEADER,
    PRINTLAB_API_KEY: process.env.PRINTLAB_API_KEY,
    PRINTLAB_API_KEY_HEADER: process.env.PRINTLAB_API_KEY_HEADER,
  }
  process.env.PRINTLAB_BASE_URL = 'http://PrintLab:8080'
  delete process.env.PRINTLAB_SESSION_COOKIE
  delete process.env.PRINTLAB_AUTH_HEADER
  delete process.env.PRINTLAB_API_KEY
  delete process.env.PRINTLAB_API_KEY_HEADER

  global.fetch = (async () => {
    throw new TypeError('fetch failed')
  }) as typeof fetch

  try {
    await assert.rejects(
      () => fetchPrintLabPrinters(),
      (err: any) => (
        err?.message?.includes('Unable to reach PrintLab at http://printlab:8080') &&
        err?.message?.includes('shared Docker network') &&
        err?.cause instanceof TypeError
      ),
    )
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
