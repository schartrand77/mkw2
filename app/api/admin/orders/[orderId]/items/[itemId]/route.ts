import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/app/api/admin/_utils'

const payloadSchema = z.object({
  quantity: z.number().int().min(1).max(999),
})

type RouteParams = { params: Promise<{ orderId: string; itemId: string }> }

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin()
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }

  try {
    const { orderId, itemId } = await params
    const payload = payloadSchema.parse(await req.json())

    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.printOrderItem.findFirst({
        where: { id: itemId, orderId },
        select: {
          id: true,
          orderId: true,
          quantity: true,
          unitPriceCents: true,
          totalCents: true,
        },
      })
      if (!item) {
        throw Object.assign(new Error('Order item not found.'), { status: 404 })
      }

      const nextTotalCents = item.unitPriceCents * payload.quantity
      const deltaCents = nextTotalCents - item.totalCents

      const updatedItem = await tx.printOrderItem.update({
        where: { id: item.id },
        data: {
          quantity: payload.quantity,
          totalCents: nextTotalCents,
        },
        select: {
          id: true,
          quantity: true,
          unitPriceCents: true,
          totalCents: true,
        },
      })

      const updatedOrder = await tx.printOrder.update({
        where: { id: orderId },
        data: {
          subtotalCents: { increment: deltaCents },
          totalCents: { increment: deltaCents },
        },
        select: {
          id: true,
          subtotalCents: true,
          totalCents: true,
        },
      })

      return { item: updatedItem, order: updatedOrder }
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (e: any) {
    const status = typeof e?.status === 'number' ? e.status : 400
    return NextResponse.json({ error: e?.message || 'Invalid request.' }, { status })
  }
}

