import { NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/_utils'
import { stockworksJson, stockworksDisabledResponse } from '@/lib/stockworks-client'

type Params = { params: Promise<{ itemId: string }> }

export const dynamic = 'force-dynamic'

export async function GET(_: Request, { params }: Params) {
  try { await requireAdmin() } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }

  const { itemId } = await params
  if (!itemId || !/^[0-9]+$/.test(itemId)) {
    return NextResponse.json({ error: 'Invalid inventory id' }, { status: 400 })
  }

  try {
    const movements = await stockworksJson(`/inventory/${itemId}/movements`)
    return NextResponse.json({ enabled: true, movements })
  } catch (err: any) {
    if (err?.message === 'StockWorks is not configured') return stockworksDisabledResponse()
    return NextResponse.json({ enabled: false, error: err?.message || 'StockWorks request failed' }, { status: err?.status || 502 })
  }
}