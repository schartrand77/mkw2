import { NextResponse } from 'next/server'
import { withRequestObservability } from '@/lib/request-observability'

export const dynamic = 'force-dynamic'

async function handleGet() {
  return NextResponse.json({ ok: true, now: new Date().toISOString() })
}

export const GET = withRequestObservability(handleGet, { routeName: '/api/health' })
