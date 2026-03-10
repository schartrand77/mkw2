import { NextResponse } from 'next/server'
import { requireAdmin } from '../../../../_utils'
import { resubmitPrintLabJobById } from '@/lib/printlab-jobs'

type Params = { params: Promise<{ id: string }> }

export const dynamic = 'force-dynamic'

export async function POST(_req: Request, { params }: Params) {
  try {
    await requireAdmin()
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }

  const { id } = await params
  const job = await resubmitPrintLabJobById(id)
  if (!job) {
    return NextResponse.json({ error: 'PrintLab job not found' }, { status: 404 })
  }
  return NextResponse.json({ ok: true, job })
}
