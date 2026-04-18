import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { handleStripeWebhookEvent } from '@/lib/stripe-payments'
import { withRequestObservability } from '@/lib/request-observability'

export const dynamic = 'force-dynamic'

async function handlePost(req: NextRequest) {
  const secret = (process.env.STRIPE_WEBHOOK_SECRET || '').trim()
  if (!secret) return NextResponse.json({ error: 'Stripe webhook secret is not configured' }, { status: 500 })

  const signature = req.headers.get('stripe-signature')
  if (!signature) return NextResponse.json({ error: 'Missing Stripe signature' }, { status: 400 })

  const body = await req.text()
  let event
  try {
    event = getStripe().webhooks.constructEvent(body, signature, secret)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Invalid Stripe signature' }, { status: 400 })
  }

  const result = await handleStripeWebhookEvent(event)
  return NextResponse.json({ received: true, ...result })
}

export const POST = withRequestObservability(handlePost, { routeName: '/api/stripe/webhook' })
