import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '../../../_utils'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  try {
    await requireAdmin()
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }
  try {
    const result = await prisma.$transaction(async (tx) => {
      const job = await tx.jobForm.findUnique({
        where: { id },
        select: { id: true, paymentIntentId: true },
      })
      if (!job) {
        const err = new Error('Job not found') as Error & { code?: string }
        err.code = 'P2025'
        throw err
      }

      const linkedOrders = await tx.printOrder.findMany({
        where: {
          OR: [
            {
              metadata: {
                path: ['paymentIntentId'],
                equals: job.paymentIntentId,
              },
            },
            {
              metadata: {
                path: ['jobFormId'],
                equals: job.id,
              },
            },
          ],
        },
        select: { id: true },
      })

      const linkedOrderIds = linkedOrders.map((order) => order.id)
      if (linkedOrderIds.length > 0) {
        // Prevent self-relation FK violations before removing source orders.
        await tx.printOrder.updateMany({
          where: { reprintOfId: { in: linkedOrderIds } },
          data: { reprintOfId: null },
        })
        await tx.printOrder.deleteMany({
          where: { id: { in: linkedOrderIds } },
        })
      }

      await tx.jobForm.delete({ where: { id: job.id } })
      return { deletedOrderCount: linkedOrderIds.length }
    })

    return NextResponse.json({ ok: true, deletedOrderCount: result.deletedOrderCount })
  } catch (err: any) {
    const message = err?.code === 'P2025' ? 'Job not found' : 'Failed to delete job'
    return NextResponse.json({ error: message }, { status: err?.code === 'P2025' ? 404 : 500 })
  }
}
