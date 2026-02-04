import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/app/api/admin/_utils'
import { ORDER_STATUSES } from '@/lib/order-status'

const orderStatusKeys = ORDER_STATUSES.map((entry) => entry.key) as [string, ...string[]]

const addressSchema = z.object({
  name: z.string().min(1),
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
})

const itemSchema = z.object({
  modelTitle: z.string().min(1),
  material: z.string().min(1),
  quantity: z.number().int().min(1).max(1000),
  unitPriceCents: z.number().int().min(0),
  totalCents: z.number().int().min(0).optional(),
  colors: z.array(z.string().min(1)).optional(),
  finish: z.string().optional(),
  infillPct: z.number().int().min(0).max(100).optional(),
  customNotes: z.string().optional(),
  modelId: z.string().optional(),
  partId: z.string().optional(),
  partName: z.string().optional(),
  thumbnailPath: z.string().optional(),
  viewerPath: z.string().optional(),
})

const payloadSchema = z.object({
  userId: z.string().min(1),
  customerName: z.string().optional(),
  customerEmail: z.string().email().optional(),
  status: z.enum(orderStatusKeys).optional(),
  paymentMethod: z.enum(['card', 'cash']).optional(),
  shippingMethod: z.enum(['pickup', 'ship']).optional(),
  shippingAddress: addressSchema.optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
  currency: z.string().min(1).optional(),
  items: z.array(itemSchema).min(1),
}).refine((data) => data.shippingMethod !== 'ship' || data.shippingAddress, {
  message: 'Shipping address is required for shipping orders.',
  path: ['shippingAddress'],
})

export async function POST(req: NextRequest) {
  let adminId: string
  try { adminId = await requireAdmin() } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }

  try {
    const payload = payloadSchema.parse(await req.json())
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, name: true },
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 })
    }

    const items = payload.items.map((item) => {
      const totalCents = item.totalCents ?? item.unitPriceCents * item.quantity
      return {
        modelId: item.modelId || undefined,
        modelTitle: item.modelTitle,
        partId: item.partId || undefined,
        partName: item.partName || undefined,
        material: item.material,
        colors: item.colors && item.colors.length ? item.colors : undefined,
        infillPct: item.infillPct ?? undefined,
        finish: item.finish || undefined,
        customNotes: item.customNotes || undefined,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        totalCents,
        thumbnailPath: item.thumbnailPath || undefined,
        viewerPath: item.viewerPath || undefined,
      }
    })

    const subtotalCents = items.reduce((sum, item) => sum + item.totalCents, 0)
    const discountPercent = payload.discountPercent ?? undefined
    const totalCents = discountPercent
      ? Math.max(0, Math.round(subtotalCents * (1 - discountPercent / 100)))
      : subtotalCents

    const order = await prisma.printOrder.create({
      data: {
        userId: user.id,
        customerEmail: payload.customerEmail || user.email || undefined,
        customerName: payload.customerName || user.name || undefined,
        status: payload.status ?? 'awaiting_review',
        paymentMethod: payload.paymentMethod ?? 'cash',
        shippingMethod: payload.shippingMethod ?? 'pickup',
        shippingAddress: payload.shippingMethod === 'ship' ? payload.shippingAddress : undefined,
        subtotalCents,
        discountPercent,
        totalCents,
        currency: payload.currency?.toUpperCase() || 'USD',
        notes: payload.notes || undefined,
        metadata: {
          adminCreatedAt: new Date().toISOString(),
          adminCreatedBy: adminId,
        },
        items: { create: items },
      },
      select: { id: true, orderNumber: true, status: true },
    })

    return NextResponse.json({ order })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid request.' }, { status: 400 })
  }
}
