import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildShippingManifestPayload,
  buildShopifyDraftOrderPayload,
  getConnectorBetaStatuses,
} from '../lib/connector-betas'

const sampleOrder = {
  id: 'order_123',
  orderNumber: 42,
  status: 'ready',
  shippingMethod: 'ship',
  customerName: 'Taylor Maker',
  customerEmail: 'taylor@example.com',
  subtotalCents: 25000,
  totalCents: 27500,
  currency: 'usd',
  organization: { name: 'Acme Labs' },
  shippingAddress: {
    name: 'Taylor Maker',
    line1: '123 Print St',
    city: 'Toronto',
    state: 'ON',
    postalCode: 'M5V 1A1',
    country: 'CA',
  },
  metadata: {
    projectCode: 'PX-7',
    departmentCode: 'ENG',
    shippingInfo: {
      carrier: 'UPS',
      service: 'Ground',
      trackingNumber: '1Z999',
      trackingUrl: 'https://carrier.test/track/1Z999',
      labelUrl: 'https://carrier.test/label/1Z999.pdf',
      shippedAt: '2026-04-06T12:00:00.000Z',
    },
  },
  items: [
    {
      modelTitle: 'Bracket',
      partName: 'Bracket Left',
      quantity: 2,
      unitPriceCents: 12500,
      totalCents: 25000,
      material: 'PLA',
      finish: 'standard',
    },
  ],
}

test('shopify draft order beta includes item, org, and metadata fields', () => {
  const payload = buildShopifyDraftOrderPayload(sampleOrder)
  assert.equal(payload.draft_order.currency, 'USD')
  assert.equal(payload.draft_order.line_items.length, 1)
  assert.equal(payload.draft_order.tags.includes('org:Acme Labs'), true)
  assert.equal(payload.draft_order.custom_attributes.some((entry) => Boolean(entry) && entry.key === 'project_code' && entry.value === 'PX-7'), true)
})

test('shipping manifest beta includes tracking and recipient fields', () => {
  const payload = buildShippingManifestPayload(sampleOrder)
  assert.equal(payload.shipment.reference, 'MW-00042')
  assert.equal(payload.shipment.carrier, 'UPS')
  assert.equal(payload.shipment.recipient.city, 'Toronto')
  assert.equal(payload.shipment.items[0]?.declaredValue, 250)
})

test('connector beta status selection surfaces eligible recent orders', () => {
  const statuses = getConnectorBetaStatuses({ orders: [sampleOrder] })
  assert.equal(statuses.length, 2)
  assert.equal(statuses.every((entry) => entry.readiness === 'beta'), true)
  assert.equal(statuses.some((entry) => entry.id === 'shopify_draft_order' && entry.eligible), true)
  assert.equal(statuses.some((entry) => entry.id === 'shipping_manifest' && entry.eligible), true)
})
