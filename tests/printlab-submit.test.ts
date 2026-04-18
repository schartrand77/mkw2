import assert from 'node:assert/strict'
import test from 'node:test'

import { buildPrintLabSubmitPayloads, shouldAutoSubmitOrderToPrintLab } from '../lib/printlab-submit'

test('PrintLab submit payload uses order item material and StockWorks color names', () => {
  const payloads = buildPrintLabSubmitPayloads({
    id: 'order-1',
    orderNumber: 16,
    paymentMethod: 'cash',
    paymentStatus: 'pending',
    shippingMethod: 'pickup',
    items: [{
      id: 'item-1',
      modelId: 'model-1',
      modelTitle: 'Toothbrush holder',
      material: 'PETG',
      colors: ['Black #000000', 'White #FFFFFF'],
      quantity: 4,
      configuration: {
        storageUrl: 'https://makerworks.app/files/model.3mf',
        storagePath: '/models/model.3mf',
      },
    }],
  }, { id: 'job-1', paymentIntentId: 'cash-1' })

  assert.equal(payloads.length, 1)
  assert.equal(payloads[0].model_id, 'model-1')
  assert.equal(payloads[0].source_job_id, 'job-1')
  assert.equal(payloads[0].source_order_id, 'order-1')
  assert.equal(payloads[0].idempotency_key, 'makerworks-order:order-1:item:item-1')
  assert.equal(payloads[0].metadata?.material, 'PETG')
  assert.deepEqual(payloads[0].metadata?.colors, ['Black #000000', 'White #FFFFFF'])
  assert.equal(payloads[0].metadata?.order_label, 'MW-00016')
  assert.equal(payloads[0].metadata?.storage_url, 'https://makerworks.app/files/model.3mf')
})

test('PrintLab submit payload skips manual items without model ids', () => {
  const payloads = buildPrintLabSubmitPayloads({
    id: 'order-1',
    items: [{
      id: 'item-1',
      modelId: null,
      modelTitle: 'Manual item',
      material: 'PETG',
      quantity: 1,
    }],
  })

  assert.deepEqual(payloads, [])
})

test('PrintLab auto submit only runs for queued model-backed orders', () => {
  assert.equal(shouldAutoSubmitOrderToPrintLab({
    id: 'order-1',
    status: 'queued',
    items: [{
      id: 'item-1',
      modelId: 'model-1',
      modelTitle: 'Widget',
      material: 'PETG',
      quantity: 1,
    }],
  }), true)

  assert.equal(shouldAutoSubmitOrderToPrintLab({
    id: 'order-2',
    status: 'awaiting_payment',
    items: [{
      id: 'item-1',
      modelId: 'model-1',
      modelTitle: 'Widget',
      material: 'PETG',
      quantity: 1,
    }],
  }), false)
})
