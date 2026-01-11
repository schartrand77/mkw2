import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAdmin } from '../../_utils'

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
  active: z.boolean().optional(),
  dailyCapacityHours: z.number().min(0).optional(),
  notes: z.string().nullable().optional(),
})

type RouteParams = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try { await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  try {
    const { id } = await params
    const payload = updateSchema.parse(await req.json())
    const printer = await prisma.printer.update({
      where: { id },
      data: {
        name: payload.name?.trim(),
        status: payload.status?.trim(),
        active: payload.active,
        dailyCapacityHours: payload.dailyCapacityHours,
        notes: payload.notes === null ? null : payload.notes?.trim(),
      },
    })
    return NextResponse.json({ printer })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid request' }, { status: e.status || 400 })
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try { await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  try {
    const { id } = await params
    await prisma.printer.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid request' }, { status: e.status || 400 })
  }
}
