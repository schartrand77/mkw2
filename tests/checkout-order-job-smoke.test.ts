import assert from 'node:assert/strict'
import { rm } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { NextRequest } from 'next/server'

import { prisma } from '../lib/db'
import { POST as quotePost } from '../app/api/models/[id]/quote/route'
import { POST as checkoutPost } from '../app/api/checkout/route'

function jsonRequest(url: string, body: unknown) {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

test('quote route returns the expected pricing contract for a printable model', async () => {
  const originalModelFindUnique = (prisma.model as any).findUnique
  const originalSiteConfigFindUnique = (prisma.siteConfig as any).findUnique
  const originalModelPartFindMany = (prisma.modelPart as any).findMany
  const originalPrinterFindMany = (prisma.printer as any).findMany
  const originalJobFormFindMany = (prisma.jobForm as any).findMany
  const originalPrintOrderFindMany = (prisma.printOrder as any).findMany

  ;(prisma.model as any).findUnique = async () => ({
    id: 'model_quote_1',
    title: 'Calibration Cube',
    material: 'PLA',
    volumeMm3: 12000,
    sizeXmm: 20,
    sizeYmm: 20,
    sizeZmm: 20,
    salePriceUsd: null,
    flatRatePricing: false,
    supportRatio: 0.08,
    colorSlotCount: 2,
    allowedColors: ['#ffffff', '#000000'],
  })
  ;(prisma.siteConfig as any).findUnique = async () => ({
    id: 'main',
    minimumPriceUsd: 1,
  })
  ;(prisma.modelPart as any).findMany = async () => []
  ;(prisma.printer as any).findMany = async () => [
    { active: true, status: 'available' },
    { active: true, status: 'printing' },
  ]
  ;(prisma.jobForm as any).findMany = async () => []
  ;(prisma.printOrder as any).findMany = async () => []

  try {
    const req = jsonRequest('http://localhost/api/models/model_quote_1/quote', {
      material: 'PLA',
      colors: ['#ffffff'],
      qty: 2,
      toleranceClass: 'cosmetic',
      targetDimensions: { x: 30, y: 30, z: 30 },
    })
    const res = await quotePost(req, {
      params: Promise.resolve({ id: 'model_quote_1' }),
    })
    assert.equal(res.status, 200)
    const payload = await res.json()
    assert.equal(payload.quote.modelId, 'model_quote_1')
    assert.equal(payload.quote.material, 'PLA')
    assert.deepEqual(payload.quote.colors, ['#ffffff'])
    assert.equal(payload.quote.toleranceClass, 'cosmetic')
    assert.equal(payload.quote.targetDimensions.x, 30)
    assert.ok(payload.quote.priceUsd > 0)
    assert.ok(payload.quote.leadTimeHours >= 0.25)
    assert.ok(payload.quote.leadTimeWindowHours.min > 0)
    assert.ok(payload.quote.etaConfidenceScore > 0)
  } finally {
    ;(prisma.model as any).findUnique = originalModelFindUnique
    ;(prisma.siteConfig as any).findUnique = originalSiteConfigFindUnique
    ;(prisma.modelPart as any).findMany = originalModelPartFindMany
    ;(prisma.printer as any).findMany = originalPrinterFindMany
    ;(prisma.jobForm as any).findMany = originalJobFormFindMany
    ;(prisma.printOrder as any).findMany = originalPrintOrderFindMany
  }
})

test('checkout commit smoke covers orderworks, customer order, artifact persistence, and printlab submission', async () => {
  const envSnapshot = {
    BASE_URL: process.env.BASE_URL,
    STORAGE_DIR: process.env.STORAGE_DIR,
    PRINTLAB_BASE_URL: process.env.PRINTLAB_BASE_URL,
    PRINTLAB_API_KEY: process.env.PRINTLAB_API_KEY,
  }
  process.env.BASE_URL = 'http://localhost:3000'
  process.env.PRINTLAB_BASE_URL = 'https://printlab.local'
  process.env.PRINTLAB_API_KEY = 'test-key'
  process.env.STORAGE_DIR = path.join(process.cwd(), 'storage-test')

  const originalFetch = global.fetch
  const originalGetUserIdFromCookie = (prisma.user as any).findUnique
  const originalModelFindMany = (prisma.model as any).findMany
  const originalSiteConfigFindUnique = (prisma.siteConfig as any).findUnique
  const originalModelPartFindMany = (prisma.modelPart as any).findMany
  const originalPrinterFindMany = (prisma.printer as any).findMany
  const originalJobFormFindMany = (prisma.jobForm as any).findMany
  const originalJobFormUpsert = (prisma.jobForm as any).upsert
  const originalPrintOrderFindMany = (prisma.printOrder as any).findMany
  const originalPrintOrderFindUnique = (prisma.printOrder as any).findUnique
  const originalPrintOrderCreate = (prisma.printOrder as any).create
  const originalPrintOrderUpdate = (prisma.printOrder as any).update
  const originalPrintLabJobFindMany = (prisma.printLabJob as any).findMany
  const originalPrintLabJobCreate = (prisma.printLabJob as any).create
  const originalPrintLabJobUpdate = (prisma.printLabJob as any).update
  const originalPushSubscriptionFindMany = (prisma.pushSubscription as any).findMany
  const originalTransaction = (prisma as any).$transaction

  const recorded: {
    orderWorksPayload: any
    createdOrderData: any
    artifactMetadata: Record<string, unknown> | null
    printLabPayloads: any[]
  } = {
    orderWorksPayload: null,
    createdOrderData: null,
    artifactMetadata: null,
    printLabPayloads: [],
  }

  const createdAt = new Date('2026-04-06T12:00:00.000Z')
  let persistedOrder: any = null
  const printLabJobs: any[] = []

  ;(prisma.user as any).findUnique = async () => null
  ;(prisma.model as any).findMany = async () => [
    {
      id: 'model_checkout_1',
      title: 'Bracket',
      priceUsd: 24.5,
      effectivePriceUsd: 24.5,
      salePriceUsd: 24.5,
      disableCustomerDiscounts: false,
      flatRatePricing: false,
      volumeMm3: 15000,
      material: 'PLA',
      sizeXmm: 120,
      sizeYmm: 70,
      sizeZmm: 40,
      supportRatio: 0.12,
      printabilityScore: 0.93,
      failureRiskScore: 0.08,
      orientationSuggestion: 'Flat side down',
      supportLikelihood: 'low',
      colorSlotCount: 2,
      allowedColors: ['#ffffff', '#111111'],
      filePath: '/models/bracket.3mf',
      viewerFilePath: '/models/bracket.3mf',
      _count: { parts: 0 },
    },
  ]
  ;(prisma.siteConfig as any).findUnique = async () => ({
    id: 'main',
    minimumPriceUsd: 1,
    minimumOrderSubtotalUsd: null,
  })
  ;(prisma.modelPart as any).findMany = async () => []
  ;(prisma.printer as any).findMany = async () => [
    { id: 'printer_1', name: 'P1S', active: true, status: 'available' },
  ]
  ;(prisma.jobForm as any).findMany = async () => []
  ;(prisma.jobForm as any).upsert = async (payload: any) => {
    recorded.orderWorksPayload = payload
    return {
      id: 'job_1',
      paymentIntentId: payload.where.paymentIntentId,
      status: 'pending',
    }
  }
  ;(prisma.printOrder as any).findMany = async () => []
  ;(prisma.printOrder as any).create = async (payload: any) => {
    recorded.createdOrderData = payload.data
    persistedOrder = {
      id: 'order_1',
      orderNumber: 1001,
      paymentMethod: payload.data.paymentMethod,
      shippingMethod: payload.data.shippingMethod,
      status: payload.data.status,
      metadata: payload.data.metadata || {},
      printerId: null,
      items: (payload.data.items.create || []).map((item: any, index: number) => ({
        id: `item_${index + 1}`,
        modelId: item.modelId,
        modelTitle: item.modelTitle,
        partId: item.partId ?? null,
        partName: item.partName ?? null,
        material: item.material,
        colors: item.colors ?? null,
        finish: item.finish ?? null,
        configuration: item.configuration ?? {},
        viewerPath: item.viewerPath ?? null,
        createdAt,
      })),
    }
    return persistedOrder
  }
  ;(prisma.printOrder as any).update = async (payload: any) => {
    if (payload?.data?.metadata && persistedOrder) {
      recorded.artifactMetadata = payload.data.metadata
      persistedOrder = {
        ...persistedOrder,
        metadata: payload.data.metadata,
      }
      return persistedOrder
    }
    return persistedOrder
  }
  ;(prisma.printOrder as any).findUnique = async () => persistedOrder
  ;(prisma.printLabJob as any).findMany = async () => printLabJobs
  ;(prisma.printLabJob as any).create = async (payload: any) => {
    const created = {
      id: `pl_local_${printLabJobs.length + 1}`,
      orderId: payload.data.orderId,
      orderItemId: payload.data.orderItemId,
      paymentIntentId: payload.data.paymentIntentId ?? null,
      sourceJobId: payload.data.sourceJobId,
      printLabJobId: null,
      idempotencyKey: payload.data.idempotencyKey,
      status: 'pending_submission',
      printerId: null,
      printerName: null,
      queueItemId: null,
      successfulGcodeId: null,
      modelId: payload.data.modelId,
      modelName: payload.data.modelName ?? null,
      modelUrl: null,
      downloadUrl: null,
      filePath: payload.data.filePath ?? null,
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
      metadata: payload.data.metadata ?? {},
      lastCallbackPayload: null,
      history: [],
      createdAt,
      updatedAt: createdAt,
    }
    printLabJobs.push(created)
    return created
  }
  ;(prisma.printLabJob as any).update = async (payload: any) => {
    const job = printLabJobs.find((entry) => entry.id === payload.where.id)
    if (!job) throw new Error(`Missing local PrintLab job ${payload.where.id}`)
    const data = payload.data || {}
    if (data.submitAttempts?.increment) {
      job.submitAttempts += Number(data.submitAttempts.increment)
    }
    for (const [key, value] of Object.entries(data)) {
      if (key === 'submitAttempts') continue
      ;(job as any)[key] = value
    }
    job.updatedAt = new Date()
    return job
  }
  ;(prisma.pushSubscription as any).findMany = async () => []
  ;(prisma as any).$transaction = async (operations: Promise<unknown>[]) => Promise.all(operations)

  global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const requestUrl = String(url)
    if (requestUrl === 'https://printlab.local/api/works/makerworks/jobs') {
      const payload = JSON.parse(String(init?.body || '{}'))
      recorded.printLabPayloads.push(payload)
      return new Response(
        JSON.stringify({
          id: 'pl_remote_1',
          status: 'queued',
          model_id: payload.model_id,
          printer_id: 'printer_1',
          printer_name: 'P1S',
          queue_item_id: 'queue_1',
          history: [],
        }),
        { status: 200 },
      )
    }
    if (requestUrl.startsWith('https://discord.com/api/')) {
      return new Response(JSON.stringify({ id: 'discord_message_1' }), { status: 200 })
    }
    throw new Error(`Unexpected fetch in checkout smoke test: ${requestUrl}`)
  }) as typeof fetch

  try {
    const req = jsonRequest('http://localhost/api/checkout', {
      commit: true,
      paymentMethod: 'quote',
      items: [
        {
          modelId: 'model_checkout_1',
          qty: 2,
          colors: ['#ffffff'],
          material: 'PLA',
          finish: 'Matte',
        },
      ],
      shipping: { method: 'pickup' },
    })
    const res = await checkoutPost(req, {} as any)
    assert.equal(res.status, 200)
    const payload = await res.json()

    assert.equal(payload.committed, true)
    assert.equal(payload.paymentMethod, 'quote')
    assert.match(payload.paymentIntentId, /^quote_/)
    assert.equal(payload.lineItems.length, 1)
    assert.equal(payload.printLabSubmission?.submitted, 1)
    assert.equal(payload.printLabSubmission?.failed, 0)

    assert.ok(recorded.orderWorksPayload)
    assert.equal(recorded.orderWorksPayload.create.paymentMethod, 'quote')
    assert.equal(recorded.orderWorksPayload.create.paymentStatus, 'quote')
    assert.equal(recorded.orderWorksPayload.create.lineItems.length, 1)

    assert.ok(recorded.createdOrderData)
    assert.equal(recorded.createdOrderData.paymentMethod, 'quote')
    assert.equal(recorded.createdOrderData.items.create.length, 1)
    assert.equal(recorded.createdOrderData.items.create[0].quantity, 2)

    const report = (recorded.artifactMetadata?.artifacts as any)?.manufacturabilityReport
    assert.ok(report)
    assert.match(String(report.filePath || ''), /^\/orders\/order_1\/reports\/manufacturability-/)

    assert.equal(recorded.printLabPayloads.length, 1)
    assert.equal(recorded.printLabPayloads[0].source_order_id, 'order_1')
    assert.equal(recorded.printLabPayloads[0].model_id, 'model_checkout_1')
    assert.deepEqual(recorded.printLabPayloads[0].ams_mapping, [0])

    assert.equal(printLabJobs.length, 1)
    assert.equal(printLabJobs[0].printLabJobId, 'pl_remote_1')
    assert.equal(printLabJobs[0].status, 'queued')
  } finally {
    global.fetch = originalFetch
    ;(prisma.user as any).findUnique = originalGetUserIdFromCookie
    ;(prisma.model as any).findMany = originalModelFindMany
    ;(prisma.siteConfig as any).findUnique = originalSiteConfigFindUnique
    ;(prisma.modelPart as any).findMany = originalModelPartFindMany
    ;(prisma.printer as any).findMany = originalPrinterFindMany
    ;(prisma.jobForm as any).findMany = originalJobFormFindMany
    ;(prisma.jobForm as any).upsert = originalJobFormUpsert
    ;(prisma.printOrder as any).findMany = originalPrintOrderFindMany
    ;(prisma.printOrder as any).findUnique = originalPrintOrderFindUnique
    ;(prisma.printOrder as any).create = originalPrintOrderCreate
    ;(prisma.printOrder as any).update = originalPrintOrderUpdate
    ;(prisma.printLabJob as any).findMany = originalPrintLabJobFindMany
    ;(prisma.printLabJob as any).create = originalPrintLabJobCreate
    ;(prisma.printLabJob as any).update = originalPrintLabJobUpdate
    ;(prisma.pushSubscription as any).findMany = originalPushSubscriptionFindMany
    ;(prisma as any).$transaction = originalTransaction
    for (const [key, value] of Object.entries(envSnapshot)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    await rm(path.join(process.cwd(), 'storage-test'), { recursive: true, force: true }).catch(() => {})
  }
})
