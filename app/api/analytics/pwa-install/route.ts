import { NextRequest, NextResponse } from 'next/server'
import { buildPwaInstallAnalyticsPayload, type PwaInstallAnalyticsEvent } from '@/lib/pwa-install-analytics'

export const dynamic = 'force-dynamic'

const EVENTS = new Set<PwaInstallAnalyticsEvent>(['accepted', 'dismissed', 'ios_instruction_shown'])

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const event = body?.event
  if (!EVENTS.has(event)) {
    return NextResponse.json({ error: 'Invalid PWA install analytics event' }, { status: 400 })
  }
  const payload = buildPwaInstallAnalyticsPayload(event, {
    platform: typeof body?.platform === 'string' ? body.platform : null,
    source: typeof body?.source === 'string' ? body.source : null,
  })
  console.info('[analytics:pwa-install]', payload)
  return NextResponse.json({ ok: true })
}
