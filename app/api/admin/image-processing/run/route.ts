import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../../_utils'
import { enqueueImageProcessing } from '@/lib/processing-jobs'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try { await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  const { searchParams } = new URL(req.url)
  const limitParam = searchParams.get('limit')
  const limit = Math.max(1, Math.min(25, Number(limitParam || 5) || 5))
  const queued = await enqueueImageProcessing({ limit, includeAvatars: true, includeComments: true })
  return NextResponse.json({ ok: true, queued })
}
