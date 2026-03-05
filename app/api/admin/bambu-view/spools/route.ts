import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../../_utils'
import { fetchPrintLabSpools, printLabDisabledResponse } from '@/lib/printlab'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try { await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  try {
    if (!process.env.PRINTLAB_BASE_URL && !process.env.BAMBU_VIEW_BASE_URL) return printLabDisabledResponse()
    const { searchParams } = new URL(req.url)
    const printerId = (searchParams.get('printerId') || '').trim()
    if (!printerId) return NextResponse.json({ error: 'printerId required' }, { status: 400 })
    const data = await fetchPrintLabSpools(printerId)
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to fetch spools' }, { status: 400 })
  }
}
