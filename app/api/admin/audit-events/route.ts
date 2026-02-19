import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '../_utils'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }
  const searchParams = req.nextUrl.searchParams
  const take = Math.max(1, Math.min(200, Number.parseInt(searchParams.get('take') || '100', 10) || 100))
  const events = await prisma.adminAuditEvent.findMany({
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take,
  })
  return NextResponse.json({ events })
}
