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
    await prisma.jobForm.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    const message = err?.code === 'P2025' ? 'Job not found' : 'Failed to delete job'
    return NextResponse.json({ error: message }, { status: err?.code === 'P2025' ? 404 : 500 })
  }
}
