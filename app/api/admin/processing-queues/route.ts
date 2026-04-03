import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../_utils'
import {
  IMAGE_PROCESSING_QUEUE,
  PREVIEW_PROCESSING_QUEUE,
  PROCESSING_DLQ_QUEUE,
  listProcessingQueueJobs,
  processingBrokerEnabled,
  type ProcessingQueueName,
} from '@/lib/processing-jobs'

export const dynamic = 'force-dynamic'

type QueueState = 'waiting' | 'active' | 'delayed' | 'failed' | 'completed'

function parseQueueName(value: string | null): ProcessingQueueName | null {
  if (!value) return null
  if (value === IMAGE_PROCESSING_QUEUE || value === PREVIEW_PROCESSING_QUEUE || value === PROCESSING_DLQ_QUEUE) return value
  return null
}

function parseState(value: string | null): QueueState {
  if (value === 'active' || value === 'delayed' || value === 'failed' || value === 'completed') return value
  return 'waiting'
}

export async function GET(req: NextRequest) {
  try { await requireAdmin() } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }
  if (!processingBrokerEnabled()) {
    return NextResponse.json({
      enabled: false,
      queues: {
        [IMAGE_PROCESSING_QUEUE]: [],
        [PREVIEW_PROCESSING_QUEUE]: [],
        [PROCESSING_DLQ_QUEUE]: [],
      },
      message: 'REDIS_URL is not configured. Worker broker is disabled.',
    })
  }

  const { searchParams } = new URL(req.url)
  const queueFilter = parseQueueName(searchParams.get('queue'))
  const state = parseState(searchParams.get('state'))
  const limit = Math.max(1, Math.min(200, Number(searchParams.get('limit') || '50') || 50))

  const names: ProcessingQueueName[] = queueFilter
    ? [queueFilter]
    : [IMAGE_PROCESSING_QUEUE, PREVIEW_PROCESSING_QUEUE, PROCESSING_DLQ_QUEUE]

  const entries = await Promise.all(names.map(async (name) => {
    const jobs = await listProcessingQueueJobs(name, state, limit)
    return [name, jobs] as const
  }))

  const queues: Record<string, any[]> = {}
  for (const [name, jobs] of entries) queues[name] = jobs

  return NextResponse.json({ enabled: true, state, limit, queues })
}
