import { Job, Queue, Worker } from 'bullmq'
import { getProcessingBrokerConnection, processingBrokerEnabled as brokerEnabled } from '@/lib/processing-broker'

export const IMAGE_PROCESSING_QUEUE = 'image-processing'
export const PREVIEW_PROCESSING_QUEUE = 'preview-processing'
export const PROCESSING_DLQ_QUEUE = 'processing-dead-letter'
export const processingBrokerEnabled = brokerEnabled

export type ProcessingQueueName =
  | typeof IMAGE_PROCESSING_QUEUE
  | typeof PREVIEW_PROCESSING_QUEUE
  | typeof PROCESSING_DLQ_QUEUE

type ProcessingState = 'waiting' | 'active' | 'delayed' | 'failed' | 'completed'

type BasePayload = {
  idempotencyKey?: string
  requestedBy?: string | null
}

export type ImageProcessingPayload = BasePayload & {
  modelId?: string
  includeAvatars?: boolean
  includeComments?: boolean
  limit?: number
}

export type PreviewProcessingPayload = BasePayload & {
  modelId?: string
  limit?: number
}

type DeadLetterPayload = {
  sourceQueue: ProcessingQueueName
  originalJobId?: string
  failedReason?: string | null
  attemptsMade?: number
  timestamp?: number
  data: unknown
}

const queueCache = new Map<ProcessingQueueName, Queue>()

function getQueue(name: ProcessingQueueName) {
  if (queueCache.has(name)) return queueCache.get(name)!
  const connection = getProcessingBrokerConnection()
  if (!connection) throw new Error('Processing broker is not configured. Set REDIS_URL to enable queue workers.')
  const queue = new Queue(name, { connection })
  queueCache.set(name, queue)
  return queue
}

function normalizeKey(value: string) {
  return value.replace(/[^a-zA-Z0-9:_-]+/g, '_')
}

function imageJobId(payload: ImageProcessingPayload) {
  if (payload.idempotencyKey) return normalizeKey(payload.idempotencyKey)
  if (payload.modelId) return `image:model:${normalizeKey(payload.modelId)}`
  if (payload.includeAvatars) return 'image:avatars'
  if (payload.includeComments) return 'image:comments'
  return `image:global:${payload.limit || 5}`
}

function previewJobId(payload: PreviewProcessingPayload) {
  if (payload.idempotencyKey) return normalizeKey(payload.idempotencyKey)
  if (payload.modelId) return `preview:model:${normalizeKey(payload.modelId)}`
  return `preview:global:${payload.limit || 3}`
}

export async function enqueueImageProcessing(payload: ImageProcessingPayload) {
  if (!brokerEnabled()) {
    const { processPendingImages } = await import('@/lib/image-queue')
    await processPendingImages(payload.limit || 5, {
      modelId: payload.modelId,
      includeAvatars: payload.includeAvatars,
      includeComments: payload.includeComments,
    })
    return { mode: 'inline' as const, jobId: imageJobId(payload) }
  }
  const queue = getQueue(IMAGE_PROCESSING_QUEUE)
  const job = await queue.add('image.process', payload, {
    jobId: imageJobId(payload),
    attempts: Number(process.env.PROCESSING_QUEUE_ATTEMPTS || 5),
    backoff: { type: 'exponential', delay: Number(process.env.PROCESSING_QUEUE_BACKOFF_MS || 5000) },
    removeOnComplete: 200,
    removeOnFail: false,
  })
  return { mode: 'broker' as const, jobId: String(job.id) }
}

export async function enqueuePreviewProcessing(payload: PreviewProcessingPayload) {
  if (!brokerEnabled()) {
    const { processPendingModelPreviews } = await import('@/lib/model-preview-queue')
    await processPendingModelPreviews(payload.limit || 3, { modelId: payload.modelId })
    return { mode: 'inline' as const, jobId: previewJobId(payload) }
  }
  const queue = getQueue(PREVIEW_PROCESSING_QUEUE)
  const job = await queue.add('preview.process', payload, {
    jobId: previewJobId(payload),
    attempts: Number(process.env.PROCESSING_QUEUE_ATTEMPTS || 5),
    backoff: { type: 'exponential', delay: Number(process.env.PROCESSING_QUEUE_BACKOFF_MS || 5000) },
    removeOnComplete: 200,
    removeOnFail: false,
  })
  return { mode: 'broker' as const, jobId: String(job.id) }
}

export async function enqueueProcessingDeadLetter(payload: DeadLetterPayload) {
  if (!brokerEnabled()) return null
  const queue = getQueue(PROCESSING_DLQ_QUEUE)
  return queue.add('processing.dead-letter', payload, {
    removeOnComplete: 500,
    removeOnFail: false,
  })
}

function queueByName(name: ProcessingQueueName) {
  return getQueue(name)
}

function serializeJob(job: Job) {
  return {
    id: String(job.id),
    name: job.name,
    queueName: job.queueName,
    data: job.data,
    attemptsMade: job.attemptsMade,
    maxAttempts: Number(job.opts.attempts || 1),
    timestamp: job.timestamp,
    processedOn: job.processedOn || null,
    finishedOn: job.finishedOn || null,
    failedReason: job.failedReason || null,
  }
}

export async function listProcessingQueueJobs(name: ProcessingQueueName, state: ProcessingState, limit = 100) {
  if (!brokerEnabled()) return []
  const queue = queueByName(name)
  const jobs = await queue.getJobs([state], 0, Math.max(0, limit - 1), true)
  return jobs.map(serializeJob)
}

export async function retryProcessingQueueJob(name: ProcessingQueueName, jobId: string) {
  if (!brokerEnabled()) return { ok: false, error: 'Broker not configured.' }
  const queue = queueByName(name)
  const job = await queue.getJob(jobId)
  if (!job) return { ok: false, error: 'Job not found.' }

  if (name === PROCESSING_DLQ_QUEUE) {
    const payload = job.data as DeadLetterPayload
    const targetQueue = payload?.sourceQueue
    if (!targetQueue || ![IMAGE_PROCESSING_QUEUE, PREVIEW_PROCESSING_QUEUE].includes(targetQueue)) {
      return { ok: false, error: 'Dead-letter job is missing a valid source queue.' }
    }
    const queueTarget = queueByName(targetQueue)
    const cloned = await queueTarget.add('replay', payload.data as any, {
      attempts: Number(process.env.PROCESSING_QUEUE_ATTEMPTS || 5),
      backoff: { type: 'exponential', delay: Number(process.env.PROCESSING_QUEUE_BACKOFF_MS || 5000) },
      removeOnComplete: 200,
      removeOnFail: false,
      jobId: `${targetQueue}:replay:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    })
    await job.remove()
    return { ok: true, replayedJobId: String(cloned.id) }
  }

  const state = await job.getState()
  if (state === 'failed') {
    await job.retry()
    return { ok: true, retried: true }
  }

  if (state === 'active') {
    const cloned = await queue.add(job.name || 'replay', job.data, {
      attempts: Number(process.env.PROCESSING_QUEUE_ATTEMPTS || 5),
      backoff: { type: 'exponential', delay: Number(process.env.PROCESSING_QUEUE_BACKOFF_MS || 5000) },
      removeOnComplete: 200,
      removeOnFail: false,
      jobId: `${name}:active-replay:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    })
    return { ok: true, replayedJobId: String(cloned.id), note: 'Active job replay queued.' }
  }

  return { ok: false, error: `Job is in '${state}' state and cannot be retried directly.` }
}

export async function requeueStuckProcessingJobs(name: ProcessingQueueName, olderThanMs: number, limit = 20) {
  if (!brokerEnabled()) return { queued: 0, checked: 0 }
  if (name === PROCESSING_DLQ_QUEUE) return { queued: 0, checked: 0 }
  const queue = queueByName(name)
  const activeJobs = await queue.getJobs(['active'], 0, Math.max(0, limit - 1), true)
  const now = Date.now()
  let queued = 0
  for (const job of activeJobs) {
    const started = job.processedOn || job.timestamp
    if (!started) continue
    if (now - started < olderThanMs) continue
    await enqueueProcessingDeadLetter({
      sourceQueue: name,
      originalJobId: String(job.id),
      failedReason: 'Detected as stuck active job; replay queued.',
      attemptsMade: job.attemptsMade,
      timestamp: now,
      data: job.data,
    })
    await queue.add(job.name || 'replay', job.data, {
      attempts: Number(process.env.PROCESSING_QUEUE_ATTEMPTS || 5),
      backoff: { type: 'exponential', delay: Number(process.env.PROCESSING_QUEUE_BACKOFF_MS || 5000) },
      removeOnComplete: 200,
      removeOnFail: false,
      jobId: `${name}:stuck-replay:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    })
    queued += 1
  }
  return { queued, checked: activeJobs.length }
}

export function createProcessingWorker(
  name: ProcessingQueueName,
  processor: (job: Job) => Promise<unknown>,
  opts?: { concurrency?: number },
) {
  const connection = getProcessingBrokerConnection()
  if (!connection) throw new Error('Processing broker is not configured.')
  return new Worker(name, processor, {
    connection,
    concurrency: opts?.concurrency || 2,
  })
}
