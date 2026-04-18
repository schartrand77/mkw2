import Stripe from 'stripe'

let stripeClient: Stripe | null = null

export const STRIPE_API_VERSION = Stripe.API_VERSION as Stripe.LatestApiVersion

export function getStripe() {
  if (stripeClient) return stripeClient
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) throw new Error('STRIPE_SECRET_KEY not set')
  stripeClient = new Stripe(secret, {
    apiVersion: STRIPE_API_VERSION,
    maxNetworkRetries: 2,
    typescript: true,
  })
  return stripeClient
}

export type StripeClient = Stripe
