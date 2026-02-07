import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../_utils'
import { bambuViewDisabledResponse, fetchBambuPrinters, fetchBambuStatus } from '@/lib/bambu-view'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try { await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  try {
    if (!process.env.BAMBU_VIEW_BASE_URL) return bambuViewDisabledResponse()
    const printers = await fetchBambuPrinters()
    const statuses: Record<string, any> = {}
    await Promise.all(printers.map(async (printer) => {
      try {
        const status = await fetchBambuStatus(printer.id)
        statuses[printer.id] = status
      } catch (err: any) {
        statuses[printer.id] = { error: err?.message || 'Status unavailable' }
      }
    }))
    return NextResponse.json({ printers, statuses })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to fetch Bambu status' }, { status: 400 })
  }
}
