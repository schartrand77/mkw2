import { NextResponse } from 'next/server'
import { runDependencyChecks } from '@/lib/observability-health'
import { withRequestObservability } from '@/lib/request-observability'

export const dynamic = 'force-dynamic'

async function handleGet() {
  const result = await runDependencyChecks()
  return NextResponse.json(result, { status: result.ok ? 200 : 503 })
}

export const GET = withRequestObservability(handleGet, { routeName: '/api/health/ready' })
