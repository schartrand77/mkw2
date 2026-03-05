import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../_utils'
import { fetchPrintLabPrinters, fetchPrintLabStatus, printLabDisabledResponse } from '@/lib/printlab'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try { await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  try {
    if (!process.env.PRINTLAB_BASE_URL && !process.env.BAMBU_VIEW_BASE_URL) return printLabDisabledResponse()
    const printers = await fetchPrintLabPrinters()
    const statuses: Record<string, any> = {}
    await Promise.all(printers.map(async (printer) => {
      try {
        const status = await fetchPrintLabStatus(printer.id)
        statuses[printer.id] = status
      } catch (err: any) {
        statuses[printer.id] = { error: err?.message || 'Status unavailable' }
      }
    }))
    return NextResponse.json({ printers, statuses })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to fetch PrintLab status' }, { status: 400 })
  }
}
