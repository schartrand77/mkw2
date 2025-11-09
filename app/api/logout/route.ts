import { NextRequest, NextResponse } from 'next/server'
import { clearAuthCookie } from '@/lib/auth'

export async function POST(_req: NextRequest) {
  clearAuthCookie()
  return NextResponse.json({ ok: true })
}

