import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/_utils'
import { prisma } from '@/lib/db'
import { saveBuffer } from '@/lib/storage'
import path from 'path'
import { randomUUID } from 'crypto'

function extractPaymentIntentId(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const raw = (metadata as { paymentIntentId?: unknown }).paymentIntentId
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null
}

function mergeMetadata(base: any, patch: Record<string, any>) {
  if (base && typeof base === 'object' && !Array.isArray(base)) {
    return { ...(base as Record<string, any>), ...patch }
  }
  return { ...patch }
}

type RouteParams = { params: Promise<{ orderId: string }> }

export async function POST(req: NextRequest, { params }: RouteParams) {
  try { await requireAdmin() } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }

  const { orderId } = await params
  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'Invalid form payload' }, { status: 400 })
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'File is required' }, { status: 400 })
  }

  const order = await prisma.printOrder.findUnique({ where: { id: orderId }, select: { id: true, metadata: true } })
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const paymentIntentId = extractPaymentIntentId(order.metadata)
  if (!paymentIntentId) {
    return NextResponse.json({ error: 'Order is missing payment intent metadata' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  if (buffer.length === 0) return NextResponse.json({ error: 'File is empty' }, { status: 400 })
  const sanitizedName = file.name.replace(/[^a-z0-9_.-]+/gi, '-').toLowerCase()
  const relDir = path.posix.join('orders', orderId, 'slicer-profile')
  const relPath = path.posix.join(relDir, `${Date.now()}-${randomUUID()}-${sanitizedName || 'profile'}`)
  await saveBuffer(relPath, buffer)

  const profilePayload = {
    slicerProfilePath: relPath,
    slicerProfileName: file.name || 'profile',
    slicerProfileUploadedAt: new Date().toISOString(),
  }

  const jobForm = await prisma.jobForm.findUnique({ where: { paymentIntentId }, select: { id: true, metadata: true } })
  if (!jobForm) return NextResponse.json({ error: 'Job form not found' }, { status: 404 })

  await prisma.jobForm.update({
    where: { id: jobForm.id },
    data: { metadata: mergeMetadata(jobForm.metadata, profilePayload) },
  })

  await prisma.printOrder.update({
    where: { id: orderId },
    data: { metadata: mergeMetadata(order.metadata, profilePayload) },
  })

  return NextResponse.json({ ok: true, profile: profilePayload })
}