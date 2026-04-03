import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '../../_utils'
import { fetchPrintLabStatus, isPrintLabConfigured } from '@/lib/printlab'

export const dynamic = 'force-dynamic'

function isBusy(status: any) {
  const print = status?.job || status?.print || status?.printer?.print || status || {}
  const state = String(print.state || print.gcode_state || print.gcode_status || '').toLowerCase()
  if (!state) return false
  return ['printing', 'paused', 'running', 'busy'].some((token) => state.includes(token))
}

export async function POST() {
  let adminId = ''
  try { adminId = await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  try {
    const printers = await prisma.printer.findMany({ where: { active: true }, orderBy: { name: 'asc' } })
    const assignments: Array<{ printerId: string; orderId: string }> = []
    for (const printer of printers) {
      if (printer.status === 'maintenance' || printer.status === 'offline') continue
      if (printer.status === 'printing') continue
      if ((printer.provider === 'printlab' || printer.provider === 'bambu-view') && isPrintLabConfigured()) {
        try {
          const status = await fetchPrintLabStatus(printer.externalId || printer.id)
          if (isBusy(status)) continue
        } catch {
          continue
        }
      }
      const nextOrder = await prisma.printOrder.findFirst({
        where: { status: 'queued', printerId: null },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      })
      if (!nextOrder) break
      await prisma.printOrder.update({
        where: { id: nextOrder.id },
        data: {
          printerId: printer.id,
          printerAssignedAt: new Date(),
          printerAssignedBy: adminId,
        },
      })
      assignments.push({ printerId: printer.id, orderId: nextOrder.id })
    }
    return NextResponse.json({ ok: true, assignments })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Auto-queue failed' }, { status: 400 })
  }
}
