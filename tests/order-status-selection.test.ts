import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveInitialOrderStatus } from '../lib/orders'

test('cash pickup orders enter the production queue while payment remains pending', () => {
  assert.equal(resolveInitialOrderStatus({
    amountCents: 1496,
    paymentMethod: 'cash',
    shipping: { method: 'pickup' },
  }), 'queued')
})

test('invoiced and quoted orders still wait for their approval gates', () => {
  assert.equal(resolveInitialOrderStatus({
    amountCents: 1496,
    paymentMethod: 'invoice',
    shipping: { method: 'pickup' },
  }), 'awaiting_payment')

  assert.equal(resolveInitialOrderStatus({
    amountCents: 1496,
    paymentMethod: 'quote',
    shipping: { method: 'pickup' },
  }), 'awaiting_review')
})

test('cash shipped orders remain held if they reach order recording defensively', () => {
  assert.equal(resolveInitialOrderStatus({
    amountCents: 1496,
    paymentMethod: 'cash',
    shipping: { method: 'ship' },
  }), 'awaiting_payment')
})
