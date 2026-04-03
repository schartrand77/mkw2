import { NextRequest, NextResponse } from 'next/server'
import { captureError } from '@/lib/error-tracking'
import { incrementMetric } from '@/lib/observability-metrics'
import { withRequestObservability } from '@/lib/request-observability'

export const dynamic = 'force-dynamic'

async function handlePost(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const payload = body as Record<string, unknown>
  const message = typeof payload.message === 'string' ? payload.message : 'Client error'
  const stack = typeof payload.stack === 'string' ? payload.stack : undefined
  const source = typeof payload.source === 'string' ? payload.source : 'client'
  const page = typeof payload.page === 'string' ? payload.page : undefined
  incrementMetric('client_errors_total', 1, { source, page: page || 'unknown' })

  await captureError(new Error(message), {
    category: 'client_runtime',
    route: page || '/unknown',
    method: 'CLIENT',
    source,
    stack,
  })

  return NextResponse.json({ ok: true })
}

export const POST = withRequestObservability(handlePost, { routeName: '/api/client-errors' })
