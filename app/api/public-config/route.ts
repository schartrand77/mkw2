import { NextResponse } from 'next/server'
import { getMaxCartColors } from '@/lib/cartPricing'

export const dynamic = 'force-dynamic'

export async function GET() {
  const publicKeyVar = 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'
  const stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY || process.env[publicKeyVar] || ''
  const maxCartColors = getMaxCartColors()
  return NextResponse.json({ stripePublishableKey, maxCartColors })
}
