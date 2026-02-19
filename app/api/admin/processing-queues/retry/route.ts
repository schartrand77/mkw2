import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../../_utils'
import {
  IMAGE_PROCESSING_QUEUE,
  PREVIEW_PROCESSING_QUEUE,
  PROCESSING_DLQ_QUEUE,
  retryProcessingQueueJob,
  type ProcessingQueueName,
} from '@/lib/processing-jobs'

export const dynamic = 'force-dynamic'

function parseQueueName(value: string): ProcessingQueueName | null {
  if (value === IMAGE_PROCESSING_QUEUE || value === PREVIEW_PROCESSING_QUEUE || value === PROCESSING_DLQ_QUEUE) return value
  return null
}

export async function POST(req: NextRequest) {
  try { await requireAdmin() } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }

  const body = await req.json().catch(() => null)
  const queueName = parseQueueName(String(body?.queue || ''))
  const jobId = String(body?.jobId || '').trim()
  if (!queueName || !jobId) {
    return NextResponse.json({ error: 'queue and jobId are required.' }, { status: 400 })
  }

  const result = await retryProcessingQueueJob(queueName, jobId)
  if (!result.ok) {
    return NextResponse.json({ error: result.error || 'Retry failed.' }, { status: 400 })
  }
  return NextResponse.json({ ok: true, result })
}
