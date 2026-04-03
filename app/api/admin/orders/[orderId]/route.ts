import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/app/api/admin/_utils'
import { extractJobFormId, extractPaymentIntentId } from '@/lib/orderworks-link'

type RouteParams = { params: Promise<{ orderId: string }> }

export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    await requireAdmin()
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }

  try {
    const { orderId } = await params
    await prisma.$transaction(async (tx) => {
      const existing = await tx.printOrder.findUnique({
        where: { id: orderId },
        select: { id: true, metadata: true },
      })
      if (!existing) {
        const err = new Error('Order not found') as Error & { code?: string }
        err.code = 'P2025'
        throw err
      }

      const paymentIntentId = extractPaymentIntentId(existing.metadata)
      const jobFormId = extractJobFormId(existing.metadata)
      const whereOr: any[] = [{ metadata: { path: ['orderId'], equals: orderId } }]
      if (paymentIntentId) whereOr.push({ paymentIntentId })
      if (jobFormId) whereOr.push({ id: jobFormId })
      await tx.jobForm.deleteMany({ where: { OR: whereOr } })

      // Avoid self-relation constraint issues before deleting the source order.
      await tx.printOrder.updateMany({
        where: { reprintOfId: orderId },
        data: { reprintOfId: null },
      })
      await tx.printOrder.delete({ where: { id: orderId } })
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    const status = e?.code === 'P2025' ? 404 : 500
    const error = e?.code === 'P2025' ? 'Order not found' : 'Failed to delete order'
    return NextResponse.json({ error }, { status })
  }
}
