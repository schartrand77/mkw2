import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '../../_utils'
import { fetchPrintLabPrinters, isPrintLabConfigured, printLabDisabledResponse } from '@/lib/printlab'

export const dynamic = 'force-dynamic'

export async function POST() {
  try { await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  try {
    if (!(await isPrintLabConfigured())) return printLabDisabledResponse()
    const printers = await fetchPrintLabPrinters()
    const updates = [] as any[]
    for (const printer of printers) {
      const entry = await prisma.printer.upsert({
        where: { id: printer.id },
        update: {
          name: printer.name || printer.id,
          provider: 'printlab',
          externalId: printer.id,
          metadata: { host: printer.host || null, serial: printer.serial || null, go2rtc_src: printer.go2rtc_src || null },
        },
        create: {
          id: printer.id,
          name: printer.name || printer.id,
          provider: 'printlab',
          externalId: printer.id,
          status: 'available',
          active: true,
          dailyCapacityHours: 8,
          metadata: { host: printer.host || null, serial: printer.serial || null, go2rtc_src: printer.go2rtc_src || null },
        },
      })
      updates.push(entry)
    }
    return NextResponse.json({ printers: updates })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Sync failed' }, { status: 400 })
  }
}
