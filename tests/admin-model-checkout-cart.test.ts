import assert from 'node:assert/strict'
import test from 'node:test'

import { buildAdminCheckoutCartItem } from '../lib/admin-checkout-cart'

test('builds a checkout-ready cart item for an unlisted admin model', () => {
  const item = buildAdminCheckoutCartItem({
    id: 'model_123',
    title: 'Hidden Fixture',
    coverImagePath: '/uploads/cover.webp',
    updatedAt: '2026-05-07T12:00:00.000Z',
    material: 'PETG',
    sizeXmm: 10,
    sizeYmm: 20,
    sizeZmm: 30,
    salePriceUsd: 12.5,
    priceUsd: 15,
    flatRatePricing: true,
    colorSlotCount: 2,
    allowedColors: ['Black', 'White'],
    defaultColors: ['Black'],
  })

  assert.equal(item.modelId, 'model_123')
  assert.equal(item.title, 'Hidden Fixture')
  assert.equal(item.priceUsd, 12.5)
  assert.equal(item.thumbnail?.startsWith('/files/uploads/cover.webp'), true)
  assert.deepEqual(item.size, { x: 10, y: 20, z: 30 })
  assert.deepEqual(item.allowedColors, ['Black', 'White'])
  assert.deepEqual(item.options, {
    qty: 1,
    material: 'PETG',
    colors: ['Black'],
    finish: 'standard',
    toleranceClass: 'standard',
  })
})

test('falls back to a direct checkout cart item when defaults are sparse', () => {
  const item = buildAdminCheckoutCartItem({
    id: 'model_456',
    title: 'Sparse Model',
    visibility: 'unlisted',
  })

  assert.equal(item.modelId, 'model_456')
  assert.equal(item.title, 'Sparse Model')
  assert.equal(item.priceUsd, null)
  assert.equal(item.thumbnail, null)
  assert.deepEqual(item.size, {})
  assert.deepEqual(item.options.colors, [])
  assert.equal(item.options.material, 'PLA')
})
