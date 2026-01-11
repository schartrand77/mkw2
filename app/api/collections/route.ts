import { NextResponse } from 'next/server'
import { listActiveCollections } from '@/lib/collections'

export const dynamic = 'force-dynamic'

export async function GET() {
  const collections = await listActiveCollections(20)
  return NextResponse.json({ collections })
}
