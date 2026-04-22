import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildStripeInvoiceCreateParams,
  buildStripeInvoiceItemParams,
  buildStripeCheckoutSessionParams,
  mergeStripeInvoiceMetadata,
  mergeStripePaymentIntentReference,
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

test('Stripe invoice metadata merge preserves checkout metadata and records invoice links', () => {
  const merged = mergeStripeInvoiceMetadata(
    { paymentIntentId: 'invoice_local', cartItems: [{ modelId: 'model_1' }] },
    {
      invoiceId: 'in_123',
      invoiceStatus: 'open',
      paymentStatus: 'pending',
      customerId: 'cus_123',
      hostedInvoiceUrl: 'https://invoice.stripe.com/i/acct/test',
      invoicePdfUrl: 'https://invoice.stripe.com/i/acct/test.pdf',
    },
  ) as Record<string, any>

  assert.equal(merged.paymentIntentId, 'invoice_local')
  assert.deepEqual(merged.cartItems, [{ modelId: 'model_1' }])
  assert.equal(merged.stripe.customerId, 'cus_123')
  assert.equal(merged.stripeInvoice.invoiceId, 'in_123')
  assert.equal(merged.stripeInvoice.hostedInvoiceUrl, 'https://invoice.stripe.com/i/acct/test')
  assert.equal(merged.stripeInvoice.invoicePdfUrl, 'https://invoice.stripe.com/i/acct/test.pdf')
})

test('Payment intent id resolves from first-class order field before metadata fallback', () => {
  assert.equal(resolvePaymentIntentIdFromOrder({ stripePaymentIntentId: 'pi_field', metadata: { paymentIntentId: 'pi_meta' } }), 'pi_field')
  assert.equal(resolvePaymentIntentIdFromOrder({ metadata: { stripe: { paymentIntentId: 'pi_nested' } } }), 'pi_nested')
  assert.equal(resolvePaymentIntentIdFromOrder({ metadata: { paymentIntentId: 'pi_meta' } }), 'pi_meta')
})

test('Stripe payment intent reference merge preserves unrelated metadata and nested Stripe fields', () => {
  const merged = mergeStripePaymentIntentReference(
    {
      paymentIntentId: 'job_legacy',
      cartItems: [{ modelId: 'model_1' }],
      stripe: { chargeId: 'ch_123', paymentStatus: 'paid' },
    },
    'pi_attach_123',
  ) as Record<string, any>

  assert.equal(merged.paymentIntentId, 'pi_attach_123')
  assert.deepEqual(merged.cartItems, [{ modelId: 'model_1' }])
  assert.equal(merged.stripe.paymentIntentId, 'pi_attach_123')
  assert.equal(merged.stripe.chargeId, 'ch_123')
  assert.equal(merged.stripe.paymentStatus, 'paid')
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

test('Stripe invoice params describe invoice checkout line items and send collection', () => {
  const itemParams = buildStripeInvoiceItemParams({
    customerId: 'cus_123',
    currency: 'CAD',
    lineItems: [
      { title: 'Printed bracket', lineTotal: 12.5, qty: 1, partName: 'Left' },
      { title: 'Printed spacer', lineTotal: 8, qty: 2 },
    ],
    metadata: { makerworksOrderId: 'order_123' },
  }) as any[]
  const invoiceParams = buildStripeInvoiceCreateParams({
    customerId: 'cus_123',
    daysUntilDue: 14,
    description: 'MakerWorks order MW-00042',
    metadata: { makerworksOrderId: 'order_123' },
  }) as any

  assert.equal(itemParams.length, 2)
  assert.equal(itemParams[0].customer, 'cus_123')
  assert.equal(itemParams[0].amount, 1250)
  assert.equal(itemParams[0].currency, 'cad')
  assert.equal(itemParams[0].description, 'Printed bracket (Left) x1')
  assert.equal(invoiceParams.collection_method, 'send_invoice')
  assert.equal(invoiceParams.days_until_due, 14)
  assert.equal(invoiceParams.auto_advance, true)
})
