import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '../../_utils'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }

  const { searchParams } = new URL(req.url)
  const limit = Math.min(250, Math.max(1, parseInt(searchParams.get('limit') || '100', 10) || 100))
  const status = (searchParams.get('status') || 'all').trim().toLowerCase()
  const where = status !== 'all' ? { status } : undefined

  const [jobs, totalCount, failedCount] = await Promise.all([
    prisma.printLabJob.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
      select: {
        id: true,
        orderId: true,
        orderItemId: true,
        sourceJobId: true,
        printLabJobId: true,
        status: true,
        printerId: true,
        printerName: true,
        queueItemId: true,
        modelId: true,
        modelName: true,
        fileName: true,
        filePath: true,
        lastSubmittedAt: true,
        lastCallbackAt: true,
        startedAt: true,
        completedAt: true,
        submitAttempts: true,
        callbackCount: true,
        lastError: true,
        metadata: true,
        history: true,
        createdAt: true,
        updatedAt: true,
        order: {
          select: {
            orderNumber: true,
            customerEmail: true,
            customerName: true,
          },
        },
      },
    }),
    prisma.printLabJob.count(),
    prisma.printLabJob.count({ where: { status: { in: ['failed', 'submit_failed'] } } }),
  ])

  return NextResponse.json({ jobs, totalCount, failedCount })
}
