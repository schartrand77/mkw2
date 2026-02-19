import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../../_utils'
import {
  IMAGE_PROCESSING_QUEUE,
  PREVIEW_PROCESSING_QUEUE,
  requeueStuckProcessingJobs,
  type ProcessingQueueName,
} from '@/lib/processing-jobs'

export const dynamic = 'force-dynamic'

function parseQueueName(value: string): ProcessingQueueName | null {
  if (value === IMAGE_PROCESSING_QUEUE || value === PREVIEW_PROCESSING_QUEUE) return value
  return null
}

export async function POST(req: NextRequest) {
  try { await requireAdmin() } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }

  const body = await req.json().catch(() => null)
  const queueName = parseQueueName(String(body?.queue || ''))
  const olderThanMinutes = Math.max(1, Math.min(24 * 60, Number(body?.olderThanMinutes || 15) || 15))
  const limit = Math.max(1, Math.min(100, Number(body?.limit || 20) || 20))
  if (!queueName) {
    return NextResponse.json({ error: 'queue is required and must be a processing queue.' }, { status: 400 })
  }

  const result = await requeueStuckProcessingJobs(queueName, olderThanMinutes * 60 * 1000, limit)
  return NextResponse.json({ ok: true, ...result, queue: queueName, olderThanMinutes, limit })
}
