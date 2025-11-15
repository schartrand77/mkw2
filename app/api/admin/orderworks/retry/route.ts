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
    return NextResponse.json({ error: err?.message || 'Failed to retry jobs' }, { status: 500 })
  }
}
