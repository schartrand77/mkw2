import { NextRequest, NextResponse } from 'next/server'
import { getMaterialAvailabilitySnapshot } from '@/lib/material-availability'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const filterParam = searchParams.get('materials') || ''
  const filter = filterParam.split(',').map((entry) => entry.trim()).filter(Boolean)
  return NextResponse.json(await getMaterialAvailabilitySnapshot(filter))
}
