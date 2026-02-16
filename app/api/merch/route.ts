import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const items = await prisma.merchItem.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
  })
  return NextResponse.json({ items })
}
