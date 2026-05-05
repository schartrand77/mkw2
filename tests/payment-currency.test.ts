import assert from 'node:assert/strict'
import test from 'node:test'

import { formatCurrency, getCurrency } from '../lib/currency'
import { createPayPalOrder, capturePayPalOrder } from '../lib/paypal'

test('currency settings accept AUD', () => {
  const previousPublic = process.env.NEXT_PUBLIC_CURRENCY
  const previousServer = process.env.CURRENCY
  process.env.NEXT_PUBLIC_CURRENCY = 'aud'
  delete process.env.CURRENCY

  try {
    assert.equal(getCurrency(), 'AUD')
    assert.equal(formatCurrency(12.5), 'A$12.50')
  } finally {
    if (previousPublic === undefined) delete process.env.NEXT_PUBLIC_CURRENCY
    else process.env.NEXT_PUBLIC_CURRENCY = previousPublic
    if (previousServer === undefined) delete process.env.CURRENCY
    else process.env.CURRENCY = previousServer
  }
})

test('PayPal order creation posts amount and AUD currency to Orders API', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const order = await createPayPalOrder({
    amountCents: 2599,
    currency: 'AUD',
    checkoutId: 'checkout_123',
    accessToken: 'token_123',
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init })
      return new Response(JSON.stringify({ id: 'paypal_order_123', status: 'CREATED' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    },
  })

  assert.equal(order.id, 'paypal_order_123')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'https://api-m.sandbox.paypal.com/v2/checkout/orders')
  const body = JSON.parse(String(calls[0].init?.body))
  assert.equal(body.intent, 'CAPTURE')
  assert.equal(body.purchase_units[0].reference_id, 'checkout_123')
  assert.deepEqual(body.purchase_units[0].amount, { currency_code: 'AUD', value: '25.99' })
})

test('PayPal capture returns paid status only when amount and currency match', async () => {
  const result = await capturePayPalOrder({
    orderId: 'paypal_order_123',
    expectedAmountCents: 2599,
    expectedCurrency: 'AUD',
    accessToken: 'token_123',
    fetchImpl: async () => new Response(JSON.stringify({
      id: 'paypal_order_123',
      status: 'COMPLETED',
      purchase_units: [
        {
          payments: {
            captures: [
              {
                id: 'capture_123',
                status: 'COMPLETED',
                amount: { currency_code: 'AUD', value: '25.99' },
              },
            ],
          },
        },
      ],
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }),
  })

  assert.equal(result.paymentStatus, 'paid')
  assert.equal(result.captureId, 'capture_123')
})
