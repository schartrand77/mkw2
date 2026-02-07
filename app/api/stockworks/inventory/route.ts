import { NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/_utils'
import { stockworksJson, stockworksDisabledResponse } from '@/lib/stockworks-client'

export const dynamic = 'force-dynamic'

export async function GET() {
  try { await requireAdmin() } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }

  try {
    const inventory = await stockworksJson('/inventory')
    return NextResponse.json({ enabled: true, inventory })
  } catch (err: any) {
    if (err?.message === 'StockWorks is not configured') return stockworksDisabledResponse()
    return NextResponse.json({ enabled: false, error: err?.message || 'StockWorks request failed' }, { status: err?.status || 502 })
  }
}