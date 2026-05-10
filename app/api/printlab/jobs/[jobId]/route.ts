import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { deriveOrderStatusFromPrintLabStatus, mergePrintLabCallbackMetadata } from '@/lib/production'

const callbackSchema = z.object({
  job_id: z.string().min(1).optional(),
  status: z.string().min(1),
  printer_id: z.string().optional().nullable(),
  printer_name: z.string().optional().nullable(),
  queue_item_id: z.string().optional().nullable(),
  successful_gcode_id: z.string().optional().nullable(),
  idempotency_key: z.string().optional().nullable(),
  source_job_id: z.string().optional().nullable(),
  source_order_id: z.string().optional().nullable(),
  model_id: z.string().optional().nullable(),
  model_name: z.string().optional().nullable(),
  completed_at: z.string().optional().nullable(),
  started_at: z.string().optional().nullable(),
  updated_at: z.string().optional().nullable(),
  last_error: z.string().optional().nullable(),
  progress_percent: z.number().optional().nullable(),
  metadata: z.any().optional(),
}).passthrough()

type Params = { params: Promise<{ jobId: string }> }

function timingSafeEqual(a: string, b: string) {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

function callbackSecret() {
  return (process.env.PRINTLAB_WEBHOOK_SECRET || process.env.MAKERWORKS_INBOUND_SECRET || '').trim()
}

function verifyBearer(req: NextRequest, secret: string) {
  const auth = req.headers.get('authorization') || ''
  return auth.startsWith('Bearer ') && timingSafeEqual(auth.slice(7), secret)
}

function verifySignature(req: NextRequest, rawBody: string, secret: string) {
  const timestamp = req.headers.get('x-makerworks-timestamp') || ''
  const signature = req.headers.get('x-makerworks-signature') || ''
  if (!timestamp || !signature.startsWith('sha256=')) return false
  const parsedDate = new Date(timestamp)
  if (Number.isNaN(parsedDate.getTime())) return false
  if (Math.abs(Date.now() - parsedDate.getTime()) > 5 * 60 * 1000) return false
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')
  return timingSafeEqual(signature.slice('sha256='.length), expected)
}

function readOrderId(payload: z.infer<typeof callbackSchema>) {
  if (payload.source_order_id?.trim()) return payload.source_order_id.trim()
  if (payload.metadata && typeof payload.metadata === 'object' && !Array.isArray(payload.metadata)) {
    const raw = payload.metadata.order_id
    if (typeof raw === 'string' && raw.trim()) return raw.trim()
  }
  return null
}

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: Params) {
  const secret = callbackSecret()
  if (!secret) {
    return NextResponse.json({ error: 'PrintLab webhook secret is not configured.' }, { status: 500 })
  }

  const rawBody = await req.text()
  if (!verifyBearer(req, secret) && !verifySignature(req, rawBody, secret)) {
    return NextResponse.json({ error: 'Invalid PrintLab webhook signature.' }, { status: 401 })
  }

  let json: unknown
  try {
    json = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 })
  }

  const parsed = callbackSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed.', details: parsed.error.flatten() }, { status: 422 })
  }

  const { jobId } = await params
  const payload = { ...parsed.data, job_id: parsed.data.job_id || jobId }
  const orderId = readOrderId(payload)
  if (!orderId) {
    return NextResponse.json({ error: 'PrintLab callback is missing source_order_id.' }, { status: 422 })
  }

  const order = await prisma.printOrder.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, metadata: true },
  })
  if (!order) {
    return NextResponse.json({ error: 'Linked MakerWorks order was not found.' }, { status: 404 })
  }

  const metadata = mergePrintLabCallbackMetadata(order.metadata, payload)
  const status = deriveOrderStatusFromPrintLabStatus(payload.status, order.status)
  await prisma.printOrder.update({
    where: { id: order.id },
    data: {
      metadata: metadata as Prisma.InputJsonValue,
      ...(status !== order.status ? { status } : {}),
    },
  })

  return NextResponse.json({ ok: true, orderId: order.id, status })
}
