import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/app/api/admin/_utils'

const statusSchema = z.enum(['pending', 'packed', 'missing'])
const itemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  qty: z.number().int().min(1),
  status: statusSchema,
})

const updateSchema = z.object({
  items: z.array(itemSchema).min(1),
})

type RouteParams = { params: Promise<{ orderId: string }> }

type ChecklistItem = z.infer<typeof itemSchema>

function normalizeMetadata(raw: unknown): Record<string, any> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  return { ...(raw as Record<string, any>) }
}

function buildItemLabel(item: { modelTitle: string; partName?: string | null; material?: string | null; colors?: any }) {
  const colors = Array.isArray(item.colors) ? (item.colors as string[]).filter(Boolean) : []
  const parts = [
    item.modelTitle,
    item.partName ? `Part: ${item.partName}` : null,
    item.material ? `Material: ${item.material}` : null,
    colors.length ? `Colors: ${colors.join(', ')}` : null,
  ].filter(Boolean)
  return parts.join(' · ')
}

async function generateChecklist(orderId: string): Promise<ChecklistItem[]> {
  const order = await prisma.printOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      items: { select: { modelTitle: true, partName: true, material: true, colors: true, quantity: true } },
    },
  })
  if (!order) throw new Error('Order not found')
  const items: ChecklistItem[] = order.items.map((item) => ({
    id: randomUUID(),
    label: buildItemLabel(item),
    qty: Math.max(1, item.quantity || 1),
    status: 'pending',
  }))
  return items
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try { await requireAdmin() } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }
  try {
    const { orderId } = await params
    const order = await prisma.printOrder.findUnique({ where: { id: orderId }, select: { metadata: true } })
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    const metadata = normalizeMetadata(order.metadata)
    const checklist = metadata.packingChecklist?.items
    return NextResponse.json({ checklist: Array.isArray(checklist) ? checklist : [] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to load checklist' }, { status: 400 })
  }
}

export async function POST(_req: NextRequest, { params }: RouteParams) {
  try { await requireAdmin() } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }
  try {
    const { orderId } = await params
    const items = await generateChecklist(orderId)
    const order = await prisma.printOrder.findUnique({ where: { id: orderId }, select: { metadata: true } })
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    const metadata = normalizeMetadata(order.metadata)
    metadata.packingChecklist = { updatedAt: new Date().toISOString(), items }
    await prisma.printOrder.update({
      where: { id: orderId },
      data: { metadata: JSON.parse(JSON.stringify(metadata)) },
    })
    return NextResponse.json({ checklist: items })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to generate checklist' }, { status: 400 })
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try { await requireAdmin() } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }
  try {
    const { orderId } = await params
    const payload = updateSchema.parse(await req.json())
    const order = await prisma.printOrder.findUnique({ where: { id: orderId }, select: { metadata: true } })
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    const metadata = normalizeMetadata(order.metadata)
    metadata.packingChecklist = { updatedAt: new Date().toISOString(), items: payload.items }
    await prisma.printOrder.update({
      where: { id: orderId },
      data: { metadata: JSON.parse(JSON.stringify(metadata)) },
    })
    return NextResponse.json({ checklist: payload.items })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to update checklist' }, { status: 400 })
  }
}
