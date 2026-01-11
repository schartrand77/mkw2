import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAdmin } from '../_utils'

const printerSchema = z.object({
  name: z.string().min(1),
  status: z.string().min(1).default('available'),
  active: z.boolean().optional(),
  dailyCapacityHours: z.number().min(0).optional(),
  notes: z.string().optional(),
})

export async function GET() {
  try { await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  const printers = await prisma.printer.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json({ printers })
}

export async function POST(req: NextRequest) {
  try { await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  try {
    const payload = printerSchema.parse(await req.json())
    const printer = await prisma.printer.create({
      data: {
        name: payload.name.trim(),
        status: payload.status.trim(),
        active: payload.active ?? true,
        dailyCapacityHours: payload.dailyCapacityHours ?? 8,
        notes: payload.notes?.trim() || undefined,
      },
    })
    return NextResponse.json({ printer })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid request' }, { status: e.status || 400 })
  }
}
