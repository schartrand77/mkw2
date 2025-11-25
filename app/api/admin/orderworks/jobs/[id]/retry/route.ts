import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '../../../../_utils'
import { queueOrderWorksJob } from '@/lib/orderworks'
import { serializeJob, type JobWithUser } from '../../_helpers'

export const dynamic = 'force-dynamic'

type Params = { params: { id: string } }

export async function POST(_req: Request, { params }: Params) {
  try {
    await requireAdmin()
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }

  const id = params.id
  const job = await prisma.jobForm.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true, email: true } } },
  })
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }
  if (!process.env.ORDERWORKS_WEBHOOK_URL) {
    return NextResponse.json({ error: 'ORDERWORKS_WEBHOOK_URL is not configured' }, { status: 400 })
  }

  try {
    await queueOrderWorksJob(job.id)
    const updated = await prisma.jobForm.findUnique({
      where: { id: job.id },
      include: { user: { select: { id: true, name: true, email: true } } },
    })
    return NextResponse.json({ ok: true, job: serializeJob(updated as JobWithUser) })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to resend job' }, { status: 500 })
  }
}
