import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../../_utils'
import { buildConnectionTestHeaders, buildHealthCheckUrl, type SuiteConnectionService } from '@/lib/admin/suite-connection-tests'
import { getEffectiveSuiteRuntimeSettings } from '@/lib/suite-runtime'

export const dynamic = 'force-dynamic'

type Body = {
  service?: SuiteConnectionService
  baseUrl?: string
  apiKey?: string
}

export async function POST(req: NextRequest) {
  try { await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  const body = (await req.json().catch(() => ({}))) as Body
  const service = body.service || 'printlab'
  const baseUrl = String(body.baseUrl || '').trim()
  if (!baseUrl) return NextResponse.json({ ok: false, service, error: 'Base URL is required.' }, { status: 400 })
  try {
    const runtime = await getEffectiveSuiteRuntimeSettings([
      service === 'printlab' ? 'printlabApiKey' : 'stockworksServiceApiKey',
    ])
    const apiKey = body.apiKey || (service === 'printlab' ? runtime.printlabApiKey.value : runtime.stockworksServiceApiKey.value)
    const res = await fetch(buildHealthCheckUrl(baseUrl), {
      cache: 'no-store',
      headers: buildConnectionTestHeaders(apiKey),
      signal: AbortSignal.timeout(5000),
    })
    return NextResponse.json({ ok: res.ok, service, status: res.status })
  } catch (e: any) {
    return NextResponse.json({ ok: false, service, error: e.message || 'Connection failed.' }, { status: 502 })
  }
}
