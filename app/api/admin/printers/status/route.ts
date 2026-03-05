import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '../../_utils'
import { fetchPrintLabStatus, isPrintLabConfigured } from '@/lib/printlab'

export const dynamic = 'force-dynamic'

export async function GET() {
  try { await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  try {
    const printers = await prisma.printer.findMany({ orderBy: { name: 'asc' } })
    if (!isPrintLabConfigured()) {
      return NextResponse.json({ printers, statuses: {}, enabled: false })
    }
    const statuses: Record<string, any> = {}
    await Promise.all(printers.map(async (printer) => {
      if (printer.provider !== 'printlab' && printer.provider !== 'bambu-view') return
      try {
        const status = await fetchPrintLabStatus(printer.externalId || printer.id)
        statuses[printer.id] = status
      } catch (err: any) {
        statuses[printer.id] = { error: err?.message || 'Status unavailable' }
      }
    }))
    return NextResponse.json({ printers, statuses, enabled: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to load printer status' }, { status: 400 })
  }
}
