import assert from 'node:assert/strict'
import test from 'node:test'

import { buildConsumptionLinesForOrder, type InventoryItem } from '../lib/stockworks-consumption'
import { submitPrintLabMakerWorksJob } from '../lib/printlab'
import { buildPrintLabSubmitPayloads } from '../lib/printlab-submit'

const originalFetch = global.fetch

function restoreEnv(snapshot: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

test('uploaded MakerWorks model can become a StockWorks-aware PrintLab routed job', async () => {
  const uploadedModel = {
    id: 'model_uploaded_1',
    title: 'Uploaded calibration bracket',
    storagePath: '/uploads/user-1/models/calibration-bracket.3mf',
    storageUrl: 'https://makerworks.local/files/uploads/user-1/models/calibration-bracket.3mf',
  }
  const order = {
    id: 'order_1',
    orderNumber: 42,
    status: 'queued',
    paymentMethod: 'cash',
    paymentStatus: 'pending',
    shippingMethod: 'pickup',
    customerEmail: 'buyer@example.com',
    metadata: {
      slicerStats: {
        materials: [
          { material: 'PETG', color: 'Black', grams: 36.4 },
        ],
      },
    },
    items: [{
      id: 'item_1',
      modelId: uploadedModel.id,
      modelTitle: uploadedModel.title,
      material: 'PETG',
      colors: ['Black'],
      quantity: 1,
      configuration: {
        storagePath: uploadedModel.storagePath,
        storageUrl: uploadedModel.storageUrl,
      },
    }],
  }

  const stockworksInventory: InventoryItem[] = [{
    id: 77,
    quantity_grams: 950,
    reorder_level: 200,
    location: 'AMS slot 1',
    material: {
      id: 12,
      name: 'PETG Black',
      filament_type: 'PETG',
      color: 'Black',
    },
  }]

  const consumption = await buildConsumptionLinesForOrder(
    order,
    null,
    stockworksInventory,
    'MW-00042',
  )
  assert.equal(consumption.source, 'slicer_stats')
  assert.deepEqual(consumption.lines, [{
    inventory_item_id: 77,
    change_grams: -36.4,
    movement_type: 'outgoing',
    reference: 'MW-00042',
    note: 'Auto consumption for PETG (black).',
  }])

  const [payload] = buildPrintLabSubmitPayloads(order, { id: 'job_1', paymentIntentId: 'cash_1' })
  assert.equal(payload.model_id, uploadedModel.id)
  assert.equal(payload.source_order_id, order.id)
  assert.equal(payload.source_job_id, 'job_1')
  assert.equal(payload.idempotency_key, 'makerworks-order:order_1:item:item_1')
  assert.equal(payload.route_only, true)
  assert.equal(payload.metadata?.order_label, 'MW-00042')
  assert.equal(payload.metadata?.material, 'PETG')
  assert.deepEqual(payload.metadata?.colors, ['Black'])
  assert.equal(payload.metadata?.storage_path, uploadedModel.storagePath)
  assert.equal(payload.metadata?.storage_url, uploadedModel.storageUrl)

  const envSnapshot = {
    PRINTLAB_BASE_URL: process.env.PRINTLAB_BASE_URL,
    PRINTLAB_API_KEY: process.env.PRINTLAB_API_KEY,
    PRINTLAB_API_KEY_HEADER: process.env.PRINTLAB_API_KEY_HEADER,
  }
  process.env.PRINTLAB_BASE_URL = 'https://printlab.local'
  process.env.PRINTLAB_API_KEY = 'test-api-key'
  process.env.PRINTLAB_API_KEY_HEADER = 'X-API-Key'

  let capturedUrl: string | null = null
  let capturedHeaders: Headers | null = null
  let capturedBody: any = null
  global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    capturedUrl = String(url)
    capturedHeaders = new Headers(init?.headers)
    capturedBody = JSON.parse(String(init?.body || '{}'))
    return new Response(JSON.stringify({
      id: 'printlab_job_1',
      status: 'queued',
      printer_id: null,
      routing_hold: true,
    }), { status: 200 })
  }) as typeof fetch

  try {
    const submitted = await submitPrintLabMakerWorksJob(payload)
    assert.equal(capturedUrl, 'https://printlab.local/api/works/makerworks/jobs')
    if (!capturedHeaders) throw new Error('Expected PrintLab request headers to be captured')
    assert.equal((capturedHeaders as Headers).get('Content-Type'), 'application/json')
    assert.equal((capturedHeaders as Headers).get('X-API-Key'), 'test-api-key')
    assert.deepEqual(capturedBody, payload)
    assert.equal(submitted.status, 'queued')
    assert.equal(submitted.routing_hold, true)
  } finally {
    global.fetch = originalFetch
    restoreEnv(envSnapshot)
  }
})
