import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/app/api/admin/_utils'

const entrySchema = z.object({
  material: z.string().min(1).max(80),
  grams: z.number().positive(),
  colors: z.array(z.string().min(1).max(80)).optional(),
})

const payloadSchema = z.object({
  materials: z.array(entrySchema).optional(),
  printHours: z.number().positive().optional(),
})

type RouteParams = { params: Promise<{ orderId: string }> }

function normalizeMetadata(raw: unknown): Record<string, any> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  return { ...(raw as Record<string, any>) }
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
    return NextResponse.json({ slicerStats: metadata.slicerStats || null })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to load slicer stats' }, { status: 400 })
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  try { await requireAdmin() } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }
  try {
    const { orderId } = await params
    const payload = payloadSchema.parse(await req.json())
    if ((!payload.materials || payload.materials.length === 0) && payload.printHours == null) {
      return NextResponse.json({ error: 'Missing slicer stats data' }, { status: 400 })
    }
    const order = await prisma.printOrder.findUnique({
      where: { id: orderId },
      select: {
        metadata: true,
        items: {
          select: {
            quantity: true,
            configuration: true,
          },
        },
      },
    })
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    const metadata = normalizeMetadata(order.metadata)
    metadata.slicerStats = {
      updatedAt: new Date().toISOString(),
      printHours: payload.printHours != null && Number.isFinite(Number(payload.printHours)) ? Number(payload.printHours) : undefined,
      materials: (payload.materials || []).map((entry) => ({
        material: entry.material.trim(),
        grams: Number(entry.grams),
        colors: Array.isArray(entry.colors) ? entry.colors.map((c) => c.trim()).filter(Boolean) : [],
      })),
    }
    const estimatedPrintHours = order.items.reduce((sum, item) => {
      if (!item.configuration || typeof item.configuration !== 'object' || Array.isArray(item.configuration)) return sum
      const value = Number((item.configuration as Record<string, unknown>).leadTimeHours)
      if (!Number.isFinite(value) || value <= 0) return sum
      return sum + value
    }, 0)
    const actualPrintHours = payload.printHours != null && Number.isFinite(Number(payload.printHours)) ? Number(payload.printHours) : null
    metadata.estimateFeedback = {
      updatedAt: new Date().toISOString(),
      estimatedPrintHours: estimatedPrintHours > 0 ? Number(estimatedPrintHours.toFixed(2)) : null,
      actualPrintHours,
      printHoursDelta: estimatedPrintHours > 0 && actualPrintHours != null
        ? Number((actualPrintHours - estimatedPrintHours).toFixed(2))
        : null,
      actualMaterialGrams: (payload.materials || []).reduce((sum, entry) => sum + Number(entry.grams || 0), 0),
    }
    await prisma.printOrder.update({
      where: { id: orderId },
      data: { metadata: JSON.parse(JSON.stringify(metadata)) },
    })
    return NextResponse.json({ slicerStats: metadata.slicerStats })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to update slicer stats' }, { status: 400 })
  }
}
