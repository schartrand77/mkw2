import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/app/api/admin/_utils'
import { z } from 'zod'

const payloadSchema = z.object({
  printerId: z.string().min(1).nullable().optional(),
  amsTrayMap: z.array(z.object({ color: z.string(), tray: z.number() })).optional(),
})

type RouteParams = { params: Promise<{ orderId: string }> }

function mergeMetadata(base: any, patch: Record<string, any>) {
  const existing = base && typeof base === 'object' && !Array.isArray(base) ? base : {}
  return { ...existing, ...patch }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  let adminId = ''
  try { adminId = await requireAdmin() } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }
  try {
    const { orderId } = await params
    const payload = payloadSchema.parse(await req.json())
    const order = await prisma.printOrder.findUnique({ where: { id: orderId }, select: { id: true, metadata: true } })
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    const nextMetadata = payload.amsTrayMap
      ? mergeMetadata(order.metadata, { amsTrayMap: payload.amsTrayMap })
      : order.metadata

    const printerId = payload.printerId === undefined ? undefined : payload.printerId

    const updated = await prisma.printOrder.update({
      where: { id: orderId },
      data: {
        printerId: printerId === null ? null : printerId,
        printerAssignedAt: printerId ? new Date() : null,
        printerAssignedBy: printerId ? adminId : null,
        metadata: nextMetadata as any,
      },
      select: { id: true, printerId: true, printerAssignedAt: true, printerAssignedBy: true, metadata: true },
    })

    return NextResponse.json({ order: updated })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid request' }, { status: 400 })
  }
}
