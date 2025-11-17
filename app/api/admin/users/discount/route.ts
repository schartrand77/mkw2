import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAdmin } from '../../_utils'
import { summarizeDiscount } from '@/lib/discounts'

const payloadSchema = z.object({
  userId: z.string().min(1),
  discountPercent: z.number().min(0).max(95).optional(),
  isFriendsAndFamily: z.boolean().optional(),
  friendsAndFamilyPercent: z.number().min(0).max(95).optional(),
})

function clampPercent(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0
  return Math.min(95, Math.max(0, Number(value)))
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const body = await req.json()
    const parsed = payloadSchema.parse(body)
    const discountPercent = clampPercent(parsed.discountPercent)
    const friendsAndFamilyPercent = clampPercent(parsed.friendsAndFamilyPercent)
    const isFriendsAndFamily = Boolean(parsed.isFriendsAndFamily)

    const updated = await prisma.user.update({
      where: { id: parsed.userId },
      data: {
        discountPercent,
        friendsAndFamilyPercent,
        isFriendsAndFamily,
      },
      select: {
        id: true,
        discountPercent: true,
        friendsAndFamilyPercent: true,
        isFriendsAndFamily: true,
      },
    })

    return NextResponse.json({
      userId: updated.id,
      discount: summarizeDiscount(updated),
    })
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 400
    return NextResponse.json({ error: err?.message || 'Unable to update discount' }, { status })
  }
}
