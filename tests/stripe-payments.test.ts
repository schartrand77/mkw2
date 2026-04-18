import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildStripeCheckoutSessionParams,
  mergeStripePaymentMetadata,
  normalizeStripePaymentStatus,
  resolvePaymentIntentIdFromOrder,
} from '../lib/stripe-payments'

test('Stripe payment status maps actionable payment intent states', () => {
  assert.equal(normalizeStripePaymentStatus('succeeded'), 'paid')
  assert.equal(normalizeStripePaymentStatus('processing'), 'processing')
  assert.equal(normalizeStripePaymentStatus('requires_payment_method'), 'failed')
  assert.equal(normalizeStripePaymentStatus('canceled'), 'canceled')
})

test('Stripe metadata merge preserves existing order metadata and records Stripe details', () => {
  const merged = mergeStripePaymentMetadata(
    { paymentIntentId: 'pi_old', cartItems: [{ modelId: 'model_1' }] },
    {
      paymentIntentId: 'pi_123',
      paymentStatus: 'paid',
      chargeId: 'ch_123',
      receiptUrl: 'https://pay.stripe.com/receipt',
      customerId: 'cus_123',
      refundedCents: 250,
    },
  ) as Record<string, any>

  assert.equal(merged.paymentIntentId, 'pi_old')
  assert.deepEqual(merged.cartItems, [{ modelId: 'model_1' }])
  assert.equal(merged.stripe.paymentIntentId, 'pi_123')
  assert.equal(merged.stripe.paymentStatus, 'paid')
  assert.equal(merged.stripe.chargeId, 'ch_123')
  assert.equal(merged.stripe.refundedCents, 250)
})

test('Payment intent id resolves from first-class order field before metadata fallback', () => {
  assert.equal(resolvePaymentIntentIdFromOrder({ stripePaymentIntentId: 'pi_field', metadata: { paymentIntentId: 'pi_meta' } }), 'pi_field')
  assert.equal(resolvePaymentIntentIdFromOrder({ metadata: { stripe: { paymentIntentId: 'pi_nested' } } }), 'pi_nested')
  assert.equal(resolvePaymentIntentIdFromOrder({ metadata: { paymentIntentId: 'pi_meta' } }), 'pi_meta')
})

test('Checkout Session params enable Stripe Tax and customer creation when requested', () => {
  const params = buildStripeCheckoutSessionParams({
    currency: 'USD',
    lineItems: [{ name: 'Printed part', amountCents: 1299, quantity: 2 }],
    successUrl: 'https://makerworks.example/success',
    cancelUrl: 'https://makerworks.example/cancel',
    customerEmail: 'buyer@example.com',
    collectShipping: true,
    automaticTax: true,
    metadata: { checkoutId: 'checkout_123' },
  }) as any

  assert.equal(params.mode, 'payment')
  assert.equal(params.automatic_tax.enabled, true)
  assert.equal(params.customer_creation, 'always')
  assert.equal(params.shipping_address_collection.allowed_countries.includes('US'), true)
  assert.equal(params.line_items[0].price_data.unit_amount, 1299)
})
