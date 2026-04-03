import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const publicKey = (process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '').trim()
  if (!publicKey) {
    return NextResponse.json({ publicKey: '' }, { status: 200 })
  }
  return NextResponse.json({ publicKey })
}
