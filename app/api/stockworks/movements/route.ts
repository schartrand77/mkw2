import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/_utils'
import { stockworksJson, stockworksDisabledResponse } from '@/lib/stockworks-client'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  let adminId: string
  try { adminId = await requireAdmin() } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const inventory_item_id = Number((body as any).inventory_item_id)
  const change_grams = Number((body as any).change_grams)
  const movement_type = String((body as any).movement_type || '').trim()
  const reference = typeof (body as any).reference === 'string' ? (body as any).reference.trim() : ''
  const note = typeof (body as any).note === 'string' ? (body as any).note.trim() : ''

  if (!Number.isFinite(inventory_item_id) || inventory_item_id <= 0) {
    return NextResponse.json({ error: 'inventory_item_id is required' }, { status: 400 })
  }
  if (!Number.isFinite(change_grams) || change_grams === 0) {
    return NextResponse.json({ error: 'change_grams must be a non-zero number' }, { status: 400 })
  }
  if (!movement_type || !['incoming', 'outgoing', 'adjustment'].includes(movement_type)) {
    return NextResponse.json({ error: 'movement_type must be incoming, outgoing, or adjustment' }, { status: 400 })
  }

  const payload = {
    inventory_item_id,
    change_grams,
    movement_type,
    reference: reference || undefined,
    note: note || undefined,
  }

  try {
    const movement = await stockworksJson('/movements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return NextResponse.json({ ok: true, movement, adminId })
  } catch (err: any) {
    if (err?.message === 'StockWorks is not configured') return stockworksDisabledResponse()
    return NextResponse.json({ ok: false, error: err?.message || 'StockWorks request failed' }, { status: err?.status || 502 })
  }
}