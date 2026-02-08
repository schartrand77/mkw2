import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserIdFromCookie } from '@/lib/auth'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const schema = z.object({
  name: z.string().min(1).max(80),
  data: z.any(),
})

export async function GET() {
  const userId = await getUserIdFromCookie()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const presets = await prisma.customerPreset.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, name: true, data: true, createdAt: true, updatedAt: true },
  })
  return NextResponse.json({ presets })
}

export async function POST(req: Request) {
  const userId = await getUserIdFromCookie()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const json = await req.json()
    const parsed = schema.parse(json)
    if (!parsed.data || typeof parsed.data !== 'object') {
      return NextResponse.json({ error: 'Preset data must be an object.' }, { status: 400 })
    }
    const preset = await prisma.customerPreset.create({
      data: {
        userId,
        name: parsed.name.trim(),
        data: parsed.data,
      },
    })
    return NextResponse.json({ preset })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid request' }, { status: 400 })
  }
}
