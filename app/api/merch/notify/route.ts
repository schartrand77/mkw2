import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { upsertMerchNotifyRequest } from '@/lib/merch-notify'

export const dynamic = 'force-dynamic'

const schema = z.object({
  merchItemId: z.string().trim().min(1).max(64),
  email: z.string().trim().email().max(160),
  name: z.string().trim().max(120).optional().nullable(),
})

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.parse(await req.json())
    const merch = await prisma.merchItem.findUnique({
      where: { id: parsed.merchItemId },
      select: {
        id: true,
        isActive: true,
        availability: true,
      },
    })

    if (!merch || !merch.isActive) {
      return NextResponse.json({ error: 'Merch item not found.' }, { status: 404 })
    }
    if (merch.availability !== 'back_ordered') {
      return NextResponse.json({ error: 'Item is currently available.' }, { status: 409 })
    }

    await upsertMerchNotifyRequest({
      merchItemId: merch.id,
      email: parsed.email,
      name: parsed.name,
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid request' }, { status: 400 })
  }
}
