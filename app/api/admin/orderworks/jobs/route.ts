import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '../../_utils'
import { serializeJob, type JobWithUser } from './_helpers'

export const dynamic = 'force-dynamic'

type JobStatusFilter = 'pending' | 'sent' | 'all'

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }

  const { searchParams } = new URL(req.url)
  const limit = Math.min(250, Math.max(1, parseInt(searchParams.get('limit') || '100', 10) || 100))
  const statusParam = (searchParams.get('status') || 'all').toLowerCase() as JobStatusFilter
  const where =
    statusParam === 'pending' || statusParam === 'sent'
      ? { status: statusParam }
      : undefined

  const [jobs, totalCount, pendingCount] = await Promise.all([
    prisma.jobForm.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.jobForm.count(),
    prisma.jobForm.count({ where: { status: 'pending' } }),
  ])

  return NextResponse.json({
    jobs: (jobs as JobWithUser[]).map(serializeJob),
    totalCount,
    pendingCount,
    orderWorksEnabled: Boolean(process.env.ORDERWORKS_WEBHOOK_URL),
  })
}
