import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const stripePublishableKey = process.env['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'] || ''
  return NextResponse.json({ stripePublishableKey })
}
