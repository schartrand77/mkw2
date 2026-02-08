import { NextResponse } from 'next/server'
import { requireAdmin } from '../_utils'
import { getAnalyticsSnapshot } from '@/lib/admin/analytics'

export async function GET(request: Request) {
  try { await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  const { searchParams } = new URL(request.url)
  const daysParam = searchParams.get('days')
  const days = daysParam ? Number(daysParam) : undefined
  const snapshot = await getAnalyticsSnapshot({ days: Number.isFinite(days) ? Number(days) : undefined })
  return NextResponse.json(snapshot)
}
