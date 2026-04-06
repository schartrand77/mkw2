import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '../../_utils'
import { fetchPrintLabStatus, isPrintLabConfigured } from '@/lib/printlab'
import { z } from 'zod'
import { recommendSmartRouting } from '@/lib/smart-routing'

export const dynamic = 'force-dynamic'

const payloadSchema = z.object({
  dryRun: z.boolean().optional(),
  policy: z.object({
    prioritizeSpeed: z.number().min(0).max(1).optional(),
    prioritizeCost: z.number().min(0).max(1).optional(),
    prioritizeQueueBalance: z.number().min(0).max(1).optional(),
    prioritizeSla: z.number().min(0).max(1).optional(),
    requireMaterialCompatibility: z.boolean().optional(),
    restrictToPrintLabPrinters: z.boolean().optional(),
  }).partial().optional(),
}).optional()

function isBusy(status: any) {
  const print = status?.job || status?.print || status?.printer?.print || status || {}
  const state = String(print.state || print.gcode_state || print.gcode_status || '').toLowerCase()
  if (!state) return false
  return ['printing', 'paused', 'running', 'busy'].some((token) => state.includes(token))
}

export async function POST(req: Request) {
  let adminId = ''
  try { adminId = await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  try {
    const parsed = payloadSchema.parse(await req.json().catch(() => ({})))
    const dryRun = Boolean(parsed?.dryRun)
    const [printers, queuedOrders] = await Promise.all([
      prisma.printer.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
      prisma.printOrder.findMany({
        where: { status: 'queued' },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          createdAt: true,
          printerId: true,
          items: { select: { material: true, quantity: true } },
        },
      }),
    ])

    const availablePrinters = []
    for (const printer of printers) {
      if (printer.status === 'maintenance' || printer.status === 'offline' || printer.status === 'printing') continue
      if ((printer.provider === 'printlab' || printer.provider === 'bambu-view') && isPrintLabConfigured()) {
        try {
          const status = await fetchPrintLabStatus(printer.externalId || printer.id)
          if (isBusy(status)) continue
        } catch {
          continue
        }
      }
      availablePrinters.push(printer)
    }

    const routing = recommendSmartRouting({
      printers: availablePrinters,
      orders: queuedOrders.map((order, index) => ({
        id: order.id,
        createdAt: order.createdAt,
        printerId: order.printerId,
        totalHours: Math.max(0.5, order.items.reduce((sum, item) => sum + Math.max(1, item.quantity || 1) * 0.75, 0)),
        materials: order.items.map((item) => item.material),
        queuePosition: index + 1,
      })),
      policy: parsed?.policy,
    })

    const assignments: Array<{ printerId: string; printerName: string; orderId: string; score: number; reasons: string[] }> = []
    for (const recommendation of routing.recommendations) {
      if (!dryRun) {
        await prisma.printOrder.update({
          where: { id: recommendation.orderId },
          data: {
            printerId: recommendation.printerId,
            printerAssignedAt: new Date(),
            printerAssignedBy: adminId,
          },
        })
      }
      assignments.push({
        printerId: recommendation.printerId,
        printerName: recommendation.printerName,
        orderId: recommendation.orderId,
        score: recommendation.score,
        reasons: recommendation.reasons,
      })
    }
    return NextResponse.json({ ok: true, dryRun, policy: routing.policy, assignments })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Auto-queue failed' }, { status: 400 })
  }
}
