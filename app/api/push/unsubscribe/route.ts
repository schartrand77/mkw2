import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/app/api/admin/_utils'

const payloadSchema = z.object({
  endpoint: z.string().url(),
})

export async function POST(req: Request) {
  let userId: string
  try {
    userId = await requireAdmin()
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unauthorized' }, { status: err.status || 401 })
  }
  const payload = await req.json().catch(() => null)
  const parsed = payloadSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 422 })
  }
  await prisma.pushSubscription.deleteMany({
    where: { endpoint: parsed.data.endpoint, userId },
  })
  return NextResponse.json({ ok: true })
}
