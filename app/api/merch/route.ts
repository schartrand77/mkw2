import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const items = await prisma.merchItem.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
  })
  const normalized = items.map((item) => ({
    ...item,
    sizeOptions: Array.isArray((item as any).sizeOptions) ? (item as any).sizeOptions : null,
    colorOptions: Array.isArray((item as any).colorOptions) ? (item as any).colorOptions : null,
    galleryImageUrls: Array.isArray((item as any).galleryImageUrls) ? (item as any).galleryImageUrls : null,
  }))
  return NextResponse.json({ items: normalized })
}
