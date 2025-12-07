import { NextResponse } from 'next/server'
import { getMaxCartColors } from '@/lib/cartPricing'

export const dynamic = 'force-dynamic'

export async function GET() {
  const stripePublishableKey = process.env['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'] || ''
  const maxCartColors = getMaxCartColors()
  return NextResponse.json({ stripePublishableKey, maxCartColors })
}
