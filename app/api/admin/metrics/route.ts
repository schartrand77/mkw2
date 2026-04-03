import { NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/_utils'
import { getInMemoryMetricsSnapshot } from '@/lib/observability-metrics'
import { getOperationalMetrics } from '@/lib/observability-health'
import { withRequestObservability } from '@/lib/request-observability'

export const dynamic = 'force-dynamic'

async function handleGet() {
  try {
    await requireAdmin()
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }

  const [runtime, operational] = await Promise.all([
    Promise.resolve(getInMemoryMetricsSnapshot()),
    getOperationalMetrics(),
  ])

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    runtime,
    operational,
  })
}

export const GET = withRequestObservability(handleGet, { routeName: '/api/admin/metrics' })
