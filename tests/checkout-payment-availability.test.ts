import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveCheckoutPanelPrompt, resolvePublicPaymentConfig } from '../lib/checkout-payment-availability'

test('card checkout is unavailable unless Stripe has both public and secret keys', () => {
  assert.deepEqual(
    resolvePublicPaymentConfig({
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_public',
      STRIPE_SECRET_KEY: '',
    }),
    { stripePublishableKey: '', paypalClientId: '' },
  )

  assert.deepEqual(
    resolvePublicPaymentConfig({
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_public',
      STRIPE_SECRET_KEY: 'sk_test_secret',
    }),
    { stripePublishableKey: 'pk_test_public', paypalClientId: '' },
  )
})

test('PayPal checkout is unavailable unless PayPal has both client and secret keys', () => {
  assert.deepEqual(
    resolvePublicPaymentConfig({
      PAYPAL_CLIENT_ID: 'paypal-client',
      PAYPAL_CLIENT_SECRET: '',
    }),
    { stripePublishableKey: '', paypalClientId: '' },
  )

  assert.deepEqual(
    resolvePublicPaymentConfig({
      PAYPAL_CLIENT_ID: 'paypal-client',
      PAYPAL_CLIENT_SECRET: 'paypal-secret',
    }),
    { stripePublishableKey: '', paypalClientId: 'paypal-client' },
  )
})

test('checkout panel does not ask for cart items when cart items are already present', () => {
  assert.equal(
    resolveCheckoutPanelPrompt({
      hasCartItems: true,
      hasIntent: false,
      loading: false,
      hasSuccessIntent: false,
      hasConfirmation: false,
      error: null,
    }),
    'Preparing checkout totals and payment options.',
  )

  assert.equal(
    resolveCheckoutPanelPrompt({
      hasCartItems: true,
      hasIntent: false,
      loading: false,
      hasSuccessIntent: false,
      hasConfirmation: false,
      error: 'Stripe is not configured',
    }),
    'Resolve the checkout issue before continuing.',
  )
})

