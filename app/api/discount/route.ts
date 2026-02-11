import { NextResponse } from 'next/server'
import { getUserIdFromCookie } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { summarizeDiscount } from '@/lib/discounts'

export const dynamic = 'force-dynamic'

export async function GET() {
  const userId = await getUserIdFromCookie()
  if (!userId) {
    return NextResponse.json(summarizeDiscount(null))
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      discountPercent: true,
      friendsAndFamilyPercent: true,
      isFriendsAndFamily: true,
    },
  })
  return NextResponse.json(summarizeDiscount(user))
}
