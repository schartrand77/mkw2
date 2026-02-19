/* eslint-disable no-console */
import type { Job } from 'bullmq'
import {
  IMAGE_PROCESSING_QUEUE,
  PREVIEW_PROCESSING_QUEUE,
  createProcessingWorker,
  enqueueProcessingDeadLetter,
} from '@/lib/processing-jobs'
import { processPendingImages } from '@/lib/image-queue'
import { processPendingModelPreviews } from '@/lib/model-preview-queue'

async function processImageJob(job: Job) {
  const data = (job.data || {}) as {
    modelId?: string
    includeAvatars?: boolean
    includeComments?: boolean
    limit?: number
  }
  const result = await processPendingImages(data.limit || 5, {
    modelId: data.modelId,
    includeAvatars: data.includeAvatars,
    includeComments: data.includeComments,
  })
  if (result.totalFailed > 0) {
    throw new Error(`Image processing reported ${result.totalFailed} failures.`)
  }
  return result
}

async function processPreviewJob(job: Job) {
  const data = (job.data || {}) as { modelId?: string; limit?: number }
  const result = await processPendingModelPreviews(data.limit || 3, { modelId: data.modelId })
  if (result.failed > 0) {
    throw new Error(`Preview processing reported ${result.failed} failures.`)
  }
  return result
}

async function maybeDeadLetter(job: Job, err: Error | null) {
  const maxAttempts = Number(job.opts.attempts || 1)
  if (job.attemptsMade < maxAttempts) return
  await enqueueProcessingDeadLetter({
    sourceQueue: job.queueName as any,
    originalJobId: String(job.id),
    failedReason: err?.message || job.failedReason || 'Unknown processing failure',
    attemptsMade: job.attemptsMade,
    timestamp: Date.now(),
    data: job.data,
  })
}

async function main() {
  const imageWorker = createProcessingWorker(
    IMAGE_PROCESSING_QUEUE,
    async (job) => processImageJob(job),
    { concurrency: Number(process.env.IMAGE_WORKER_CONCURRENCY || 2) },
  )

  const previewWorker = createProcessingWorker(
    PREVIEW_PROCESSING_QUEUE,
    async (job) => processPreviewJob(job),
    { concurrency: Number(process.env.PREVIEW_WORKER_CONCURRENCY || 1) },
  )

  imageWorker.on('ready', () => console.log('[worker] image queue ready'))
  previewWorker.on('ready', () => console.log('[worker] preview queue ready'))

  imageWorker.on('failed', async (job, err) => {
    console.error('[worker] image job failed', job?.id, err?.message || err)
    if (job) {
      await maybeDeadLetter(job, err || null).catch((deadErr) => console.error('[worker] failed to dead-letter image job', deadErr))
    }
  })

  previewWorker.on('failed', async (job, err) => {
    console.error('[worker] preview job failed', job?.id, err?.message || err)
    if (job) {
      await maybeDeadLetter(job, err || null).catch((deadErr) => console.error('[worker] failed to dead-letter preview job', deadErr))
    }
  })

  const shutdown = async (signal: string) => {
    console.log(`[worker] received ${signal}, shutting down`) 
    await Promise.allSettled([imageWorker.close(), previewWorker.close()])
    process.exit(0)
  }

  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
}

main().catch((err) => {
  console.error('[worker] fatal', err)
  process.exit(1)
})
