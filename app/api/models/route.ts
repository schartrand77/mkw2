import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() || undefined

  let where: Prisma.ModelWhereInput = { visibility: 'public' }
  if (q) {
    where = {
      visibility: 'public',
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ],
    }
  }
  const models = await prisma.model.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 60,
    select: {
      id: true,
      title: true,
      coverImagePath: true,
      priceUsd: true,
    }
  })
  return NextResponse.json({ models })
}
