import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { clearAuthCookie } from '@/lib/auth'

export async function POST(_req: NextRequest) {
  clearAuthCookie()
  return NextResponse.json({ ok: true })
}
