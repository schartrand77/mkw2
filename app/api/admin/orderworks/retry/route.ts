import { NextResponse } from 'next/server'
import { requireAdmin } from '../../_utils'
import { retryPendingOrderWorksJobs } from '@/lib/orderworks'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    await requireAdmin()
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }

  try {
    const result = await retryPendingOrderWorksJobs()
    return NextResponse.json({ ok: true, ...result })
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500
    const body: Record<string, any> = { error: err?.message || 'Failed to retry jobs' }
    if (err?.code) body.code = err.code
    if (typeof err?.processed === 'number') body.processed = err.processed
    if (typeof err?.remaining === 'number') body.remaining = err.remaining
    if (Array.isArray(err?.failures)) body.failures = err.failures
    return NextResponse.json(body, { status })
  }
}
