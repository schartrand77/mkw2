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
  const [user, config] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        discountPercent: true,
        friendsAndFamilyPercent: true,
        isFriendsAndFamily: true,
        isAdmin: true,
        role: true,
      },
    }),
    prisma.siteConfig.findUnique({
      where: { id: 'main' },
      select: { disableCustomerDiscounts: true },
    }),
  ])
  const isAdmin = Boolean(user?.isAdmin || user?.role === 'admin')
  return NextResponse.json(summarizeDiscount(user, {
    disableCustomerDiscounts: config?.disableCustomerDiscounts,
    isAdmin,
  }))
}
