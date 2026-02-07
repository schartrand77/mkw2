import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../../_utils'
import { bambuViewDisabledResponse, fetchBambuSpools } from '@/lib/bambu-view'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try { await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  try {
    if (!process.env.BAMBU_VIEW_BASE_URL) return bambuViewDisabledResponse()
    const { searchParams } = new URL(req.url)
    const printerId = (searchParams.get('printerId') || '').trim()
    if (!printerId) return NextResponse.json({ error: 'printerId required' }, { status: 400 })
    const data = await fetchBambuSpools(printerId)
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to fetch spools' }, { status: 400 })
  }
}
