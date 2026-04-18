import assert from 'node:assert/strict'
import test from 'node:test'
import Stripe from 'stripe'
import { STRIPE_API_VERSION } from '../lib/stripe'

test('Stripe client is pinned to the SDK API version', () => {
  assert.equal(STRIPE_API_VERSION, Stripe.API_VERSION)
})
