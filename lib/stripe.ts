import Stripe from 'stripe'

let stripeClient: Stripe | null = null

export function getStripe() {
  if (stripeClient) return stripeClient
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) throw new Error('STRIPE_SECRET_KEY not set')
  stripeClient = new Stripe(secret)
  return stripeClient
}

export type StripeClient = Stripe
