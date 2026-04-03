import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/app/api/admin/_utils'

const payloadSchema = z.object({
  carrier: z.string().max(120).optional().nullable(),
  service: z.string().max(120).optional().nullable(),
  trackingNumber: z.string().max(200).optional().nullable(),
  trackingUrl: z.string().max(500).optional().nullable(),
  labelUrl: z.string().max(500).optional().nullable(),
  shippedAt: z.string().datetime().optional().nullable(),
}).strict()

type RouteParams = { params: Promise<{ orderId: string }> }

function normalizeMetadata(raw: unknown): Record<string, any> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  return { ...(raw as Record<string, any>) }
}

function normalizeOptional(value?: string | null) {
  if (value === undefined) return undefined
  if (value === null) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try { await requireAdmin() } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }
  try {
    const { orderId } = await params
    const payload = payloadSchema.parse(await req.json())
    const order = await prisma.printOrder.findUnique({ where: { id: orderId }, select: { metadata: true } })
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    const metadata = normalizeMetadata(order.metadata)
    const shippingInfo = {
      carrier: normalizeOptional(payload.carrier),
      service: normalizeOptional(payload.service),
      trackingNumber: normalizeOptional(payload.trackingNumber),
      trackingUrl: normalizeOptional(payload.trackingUrl),
      labelUrl: normalizeOptional(payload.labelUrl),
      shippedAt: payload.shippedAt === undefined
        ? undefined
        : payload.shippedAt
          ? new Date(payload.shippedAt).toISOString()
          : null,
      updatedAt: new Date().toISOString(),
    }

    metadata.shippingInfo = {
      ...(metadata.shippingInfo && typeof metadata.shippingInfo === 'object' && !Array.isArray(metadata.shippingInfo)
        ? metadata.shippingInfo
        : {}),
      ...shippingInfo,
    }

    await prisma.printOrder.update({
      where: { id: orderId },
      data: { metadata: JSON.parse(JSON.stringify(metadata)) },
    })

    return NextResponse.json({ shippingInfo: metadata.shippingInfo })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to update shipping info' }, { status: 400 })
  }
}
