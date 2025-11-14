import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function GET() {
  const items = await prisma.featuredModel.findMany({
    where: { model: { visibility: 'public' } },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    include: { model: true },
    take: 24,
  })
  const models = items.map((i) => i.model)
  return NextResponse.json({ models })
}
