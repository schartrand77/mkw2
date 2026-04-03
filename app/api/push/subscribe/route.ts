import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/app/api/admin/_utils'

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
})

export async function POST(req: Request) {
  let userId: string
  try {
    userId = await requireAdmin()
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unauthorized' }, { status: err.status || 401 })
  }
  const payload = await req.json().catch(() => null)
  const parsed = subscriptionSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid subscription payload' }, { status: 422 })
  }
  const { endpoint, keys } = parsed.data
  const userAgent = req.headers.get('user-agent') || null
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent,
      userId,
    },
    update: {
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent,
      userId,
    },
  })
  return NextResponse.json({ ok: true })
}
