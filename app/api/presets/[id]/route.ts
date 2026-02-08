import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import { getUserIdFromCookie } from '@/lib/auth'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const schema = z.object({
  name: z.string().min(1).max(80).optional(),
  data: z.any().optional(),
})

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Params) {
  const userId = await getUserIdFromCookie()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  try {
    const json = await req.json()
    const parsed = schema.parse(json)
    const existing = await prisma.customerPreset.findFirst({ where: { id, userId } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const updateData: { name?: string; data?: Prisma.InputJsonValue } = {}
    if (parsed.name) updateData.name = parsed.name.trim()
    if (parsed.data !== undefined) {
      if (!parsed.data || typeof parsed.data !== 'object') {
        return NextResponse.json({ error: 'Preset data must be an object.' }, { status: 400 })
      }
      updateData.data = parsed.data as Prisma.InputJsonValue
    }
    const preset = await prisma.customerPreset.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, data: true, createdAt: true, updatedAt: true },
    })
    return NextResponse.json({ preset })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid request' }, { status: 400 })
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const userId = await getUserIdFromCookie()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  try {
    const existing = await prisma.customerPreset.findFirst({ where: { id, userId } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await prisma.customerPreset.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Delete failed' }, { status: 400 })
  }
}
