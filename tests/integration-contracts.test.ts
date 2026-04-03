import assert from 'node:assert/strict'
import test from 'node:test'

import { stockworksFetch, stockworksJson, stockworksList } from '../lib/stockworks-client'
import { fetchPrintLabPrinters, submitPrintLabJob } from '../lib/printlab'
import { prisma } from '../lib/db'
import { recordOrderWorksJob } from '../lib/orderworks'
import { buildPrintLabIdempotencyKey, mapPrintLabStatusToOrderStatus, submitPrintLabJobsForOrder } from '../lib/printlab-jobs'
import { POST as printLabCallbackPost } from '../app/api/printlab/jobs/[jobId]/route'
import { NextRequest } from 'next/server'

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
    return new Response(JSON.stringify({ items: [{ id: 1 }], total: 1 }), { status: 200 })
  }) as typeof fetch

  try {
    const res = await stockworksFetch('/api/inventory')
    assert.equal(res.status, 200)
    assert.equal(calls.length, 3)
    assert.equal(calls[0]?.url, 'https://stockworks.local/login')
    assert.equal(String(calls[0]?.init?.method || 'GET').toUpperCase(), 'GET')
    assert.equal(calls[1]?.url, 'https://stockworks.local/login')
    assert.match(String(calls[1]?.init?.body || ''), /username=admin/)
    assert.match(String(calls[1]?.init?.body || ''), /password=secret/)
    assert.equal(calls[2]?.url, 'https://stockworks.local/api/inventory')
    const headers = new Headers(calls[2]?.init?.headers)
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

test('PrintLab submit-job client posts the MakerWorks job contract', async () => {
  const envSnapshot = {
    PRINTLAB_BASE_URL: process.env.PRINTLAB_BASE_URL,
    PRINTLAB_API_KEY: process.env.PRINTLAB_API_KEY,
  }
  process.env.PRINTLAB_BASE_URL = 'https://printlab.local'
  process.env.PRINTLAB_API_KEY = 'abc'

  let capturedUrl = ''
  let capturedInit: RequestInit | undefined
  global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    capturedUrl = String(url)
    capturedInit = init
    return new Response(JSON.stringify({ id: 'pl_1', status: 'queued', model_id: 'model_1', history: [] }), { status: 200 })
  }) as typeof fetch

  try {
    const job = await submitPrintLabJob({
      model_id: 'model_1',
      idempotency_key: 'idem_123',
      source_job_id: 'mw:order:item',
      source_order_id: 'order_1',
      use_ams: true,
      ams_mapping: [0],
      metadata: { source: 'makerworks' },
    })
    assert.equal(job.id, 'pl_1')
    assert.equal(capturedUrl, 'https://printlab.local/api/works/makerworks/jobs')
    const payload = JSON.parse(String(capturedInit?.body || '{}'))
    assert.equal(payload.model_id, 'model_1')
    assert.equal(payload.idempotency_key, 'idem_123')
    assert.equal(payload.source_job_id, 'mw:order:item')
    assert.deepEqual(payload.ams_mapping, [0])
  } finally {
    global.fetch = originalFetch
    restoreEnv(envSnapshot)
  }
})

test('PrintLab idempotency key generation is deterministic per order item', () => {
  const a = buildPrintLabIdempotencyKey('order_1', 'item_1')
  const b = buildPrintLabIdempotencyKey('order_1', 'item_1')
  const c = buildPrintLabIdempotencyKey('order_1', 'item_2')
  assert.equal(a, b)
  assert.notEqual(a, c)
})

test('PrintLab submission skips jobs already linked upstream', async () => {
  const originalOrderFindUnique = (prisma.printOrder as any).findUnique
  const originalJobFindMany = (prisma.printLabJob as any).findMany
  const originalJobUpdate = (prisma.printLabJob as any).update

  ;(prisma.printOrder as any).findUnique = async () => ({
    id: 'order_1',
    orderNumber: 12,
    paymentMethod: 'card',
    printerId: null,
    shippingMethod: 'pickup',
    status: 'queued',
    metadata: { paymentIntentId: 'pi_1' },
    items: [
      {
        id: 'item_1',
        modelId: 'model_1',
        modelTitle: 'Widget',
        partId: null,
        partName: null,
        material: 'PLA',
        colors: ['#fff'],
        finish: null,
        configuration: { useAms: true },
        viewerPath: '/storage/widget.3mf',
      },
    ],
  })
  ;(prisma.printLabJob as any).findMany = async () => ([
    {
      id: 'local_1',
      orderId: 'order_1',
      orderItemId: 'item_1',
      paymentIntentId: 'pi_1',
      sourceJobId: 'mw:order_1:item_1',
      printLabJobId: 'pl_1',
      idempotencyKey: 'idem_1',
      status: 'queued',
      printerId: null,
      printerName: null,
      queueItemId: null,
      successfulGcodeId: null,
      modelId: 'model_1',
      modelName: 'Widget',
      modelUrl: null,
      downloadUrl: null,
      filePath: '/storage/widget.3mf',
      fileName: null,
      plateGcode: null,
      startAt: null,
      lastSubmittedAt: null,
      lastCallbackAt: null,
      startedAt: null,
      completedAt: null,
      submitAttempts: 0,
      callbackCount: 0,
      lastError: null,
      metadata: {},
      lastCallbackPayload: null,
      history: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ])
  ;(prisma.printLabJob as any).update = async (payload: any) => payload.data

  let fetchCalls = 0
  global.fetch = (async () => {
    fetchCalls += 1
    return new Response(JSON.stringify({ id: 'pl_ignored', status: 'queued', history: [] }), { status: 200 })
  }) as typeof fetch

  try {
    const result = await submitPrintLabJobsForOrder('order_1')
    assert.equal(result.submitted, 0)
    assert.equal(result.failed, 0)
    assert.equal(fetchCalls, 0)
  } finally {
    ;(prisma.printOrder as any).findUnique = originalOrderFindUnique
    ;(prisma.printLabJob as any).findMany = originalJobFindMany
    ;(prisma.printLabJob as any).update = originalJobUpdate
    global.fetch = originalFetch
  }
})

test('PrintLab callback route updates local job state idempotently', async () => {
  const envSnapshot = {
    PRINTLAB_WEBHOOK_SECRET: process.env.PRINTLAB_WEBHOOK_SECRET,
  }
  process.env.PRINTLAB_WEBHOOK_SECRET = 'secret'

  const originalFindFirst = (prisma.printLabJob as any).findFirst
  const originalUpdate = (prisma.printLabJob as any).update
  const originalOrderUpdate = (prisma.printOrder as any).update
  const originalPrinterFindFirst = (prisma.printer as any).findFirst

  let updatedJobPayload: any = null
  let updatedOrderPayload: any = null

  ;(prisma.printLabJob as any).findFirst = async () => ({
    id: 'local_1',
    orderId: 'order_1',
    callbackCount: 0,
    status: 'queued',
    queueItemId: null,
    lastCallbackPayload: null,
    history: [],
  })
  ;(prisma.printLabJob as any).update = async (payload: any) => {
    updatedJobPayload = payload
    return {
      id: 'local_1',
      orderId: 'order_1',
      printLabJobId: 'pl_1',
      status: payload.data.status,
    }
  }
  ;(prisma.printOrder as any).update = async (payload: any) => {
    updatedOrderPayload = payload
    return { id: 'order_1', status: payload.data.status }
  }
  ;(prisma.printer as any).findFirst = async () => null

  try {
    const req = new NextRequest('http://localhost/api/printlab/jobs/pl_1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer secret',
      },
      body: JSON.stringify({
        job_id: 'pl_1',
        status: 'started',
        source: 'makerworks',
        printer_id: 'printer_ext_1',
        updated_at: '2026-03-10T12:00:00.000Z',
        history: [],
      }),
    })
    const res = await printLabCallbackPost(req, {
      params: Promise.resolve({ jobId: 'pl_1' }),
    })
    assert.equal(res.status, 200)
    assert.equal(updatedJobPayload.data.status, 'started')
    assert.equal(updatedOrderPayload.data.status, 'printing')
  } finally {
    ;(prisma.printLabJob as any).findFirst = originalFindFirst
    ;(prisma.printLabJob as any).update = originalUpdate
    ;(prisma.printOrder as any).update = originalOrderUpdate
    ;(prisma.printer as any).findFirst = originalPrinterFindFirst
    restoreEnv(envSnapshot)
  }
})

test('PrintLab status mapping follows MakerWorks production states', () => {
  assert.equal(mapPrintLabStatusToOrderStatus('queued'), 'queued')
  assert.equal(mapPrintLabStatusToOrderStatus('started'), 'printing')
  assert.equal(mapPrintLabStatusToOrderStatus('completed'), 'post_process')
  assert.equal(mapPrintLabStatusToOrderStatus('failed'), 'failed')
  assert.equal(mapPrintLabStatusToOrderStatus('cancelled'), 'cancelled')
  assert.equal(mapPrintLabStatusToOrderStatus('submit_failed'), 'failed')
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
