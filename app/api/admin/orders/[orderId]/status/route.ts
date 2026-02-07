import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/app/api/admin/_utils'
import { ORDER_STATUS_FLOW } from '@/lib/order-status'

const statusKeys = ORDER_STATUS_FLOW.map((entry) => entry.key) as [string, ...string[]]

const payloadSchema = z.object({
  status: z.enum(statusKeys),
})

type RouteParams = { params: Promise<{ orderId: string }> }

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try { await requireAdmin() } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }

  try {
    const { orderId } = await params
    const payload = payloadSchema.parse(await req.json())
    const order = await prisma.printOrder.update({
      where: { id: orderId },
      data: { status: payload.status },
      select: { id: true, status: true },
    })
    return NextResponse.json({ order })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid request.' }, { status: 400 })
  }
}