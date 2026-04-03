import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { handlePrintLabCallback } from '@/lib/printlab-jobs'
import { incrementMetric } from '@/lib/observability-metrics'
import { withRequestObservability } from '@/lib/request-observability'

const callbackPayloadSchema = z.object({
  job_id: z.string().min(1),
  status: z.enum(['queued', 'started', 'completed', 'failed', 'cancelled', 'submit_failed']),
  printer_id: z.string().optional().nullable(),
  printer_name: z.string().optional().nullable(),
  queue_item_id: z.string().optional().nullable(),
  successful_gcode_id: z.string().optional().nullable(),
  idempotency_key: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  source_job_id: z.string().optional().nullable(),
  source_order_id: z.string().optional().nullable(),
  model_id: z.string().optional().nullable(),
  model_name: z.string().optional().nullable(),
  model_url: z.string().optional().nullable(),
  download_url: z.string().optional().nullable(),
  file_path: z.string().optional().nullable(),
  file_name: z.string().optional().nullable(),
  plate_gcode: z.string().optional().nullable(),
  start_at: z.string().optional().nullable(),
  started_at: z.string().optional().nullable(),
  completed_at: z.string().optional().nullable(),
  last_error: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
  history: z.array(z.unknown()).optional(),
  updated_at: z.string().optional().nullable(),
  created_at: z.string().optional().nullable(),
})

type Params = { params: Promise<{ jobId: string }> }

function timingSafeEqual(a: string, b: string) {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

function getSecret() {
  return (process.env.PRINTLAB_WEBHOOK_SECRET || process.env.MAKERWORKS_INBOUND_SECRET || '').trim() || null
}

function verifyBearerSecret(req: NextRequest, secret: string) {
  const auth = req.headers.get('authorization') || ''
  if (auth.startsWith('Bearer ')) {
    const token = auth.slice(7)
    if (timingSafeEqual(token, secret)) return true
  }
  const headers = [
    req.headers.get('x-printlab-secret'),
    req.headers.get('x-makerworks-secret'),
  ]
  for (const header of headers) {
    if (header && timingSafeEqual(header, secret)) return true
  }
  const queryToken = req.nextUrl.searchParams.get('secret')
  return Boolean(queryToken && timingSafeEqual(queryToken, secret))
}

function parseSignature(headerValue: string | null) {
  if (!headerValue) return null
  const parts = headerValue.split(',').map((entry) => entry.trim())
  const payload: Record<string, string> = {}
  for (const part of parts) {
    const [key, value] = part.split('=')
    if (key && value) payload[key] = value
  }
  if (!payload.t || !payload.v1) return null
  const timestamp = Number(payload.t)
  if (!Number.isFinite(timestamp)) return null
  return { timestamp, signature: payload.v1 }
}

function verifySignatureHeaders(req: NextRequest, body: string, secret: string) {
  const header = req.headers.get('x-printlab-signature-v1')
    || req.headers.get('printlab-signature-v1')
    || req.headers.get('x-makerworks-signature-v1')
  const parsed = parseSignature(header)
  if (!parsed) return false
  const now = Date.now()
  const toleranceMs = 5 * 60 * 1000
  if (Math.abs(now - parsed.timestamp * 1000) > toleranceMs) return false
  const canonicalPayload = `${parsed.timestamp}.${body}`
  const expected = crypto.createHmac('sha256', secret).update(canonicalPayload).digest('hex')
  return timingSafeEqual(expected, parsed.signature)
}

export const dynamic = 'force-dynamic'

async function handlePost(req: NextRequest, { params }: Params) {
  const secret = getSecret()
  if (!secret) {
    incrementMetric('job_webhook_failure_total', 1, { reason: 'printlab_secret_missing' })
    return NextResponse.json({ error: 'PrintLab webhook secret not configured' }, { status: 500 })
  }
  const rawBody = await req.text()
  if (!(verifyBearerSecret(req, secret) || verifySignatureHeaders(req, rawBody, secret))) {
    incrementMetric('job_webhook_failure_total', 1, { reason: 'printlab_invalid_signature' })
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 })
  }

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(rawBody)
  } catch {
    incrementMetric('job_webhook_failure_total', 1, { reason: 'printlab_invalid_json' })
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const parsed = callbackPayloadSchema.safeParse(parsedJson)
  if (!parsed.success) {
    incrementMetric('job_webhook_failure_total', 1, { reason: 'printlab_validation_failed' })
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 })
  }
  if (parsed.data.source && parsed.data.source !== 'makerworks') {
    return NextResponse.json({ error: 'Unexpected callback source' }, { status: 422 })
  }

  const { jobId } = await params
  const updated = await handlePrintLabCallback(jobId, parsed.data)
  if (!updated) {
    incrementMetric('job_webhook_failure_total', 1, { reason: 'printlab_job_not_found' })
    return NextResponse.json({ error: 'PrintLab job not found' }, { status: 404 })
  }

  incrementMetric('job_webhook_success_total', 1, { source: 'printlab' })
  return NextResponse.json({ ok: true, jobId: updated.id, printLabJobId: updated.printLabJobId, status: updated.status })
}

export const POST = withRequestObservability(handlePost, { routeName: '/api/printlab/jobs/[jobId]' })
