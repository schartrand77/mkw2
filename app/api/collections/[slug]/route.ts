import { NextRequest, NextResponse } from 'next/server'
import { getCollectionBySlug, getCollectionModels } from '@/lib/collections'

export const dynamic = 'force-dynamic'

type RouteParams = { params: Promise<{ slug: string }> }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { slug } = await params
  const collection = await getCollectionBySlug(slug)
  if (!collection) return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
  const models = await getCollectionModels(collection, 36)
  return NextResponse.json({ collection, models })
}
