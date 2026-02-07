import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '../_utils'

export const dynamic = 'force-dynamic'

export async function GET() {
  try { await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  const logs = await prisma.configChangeLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      admin: { select: { id: true, name: true, email: true } },
    },
  })
  return NextResponse.json({ logs })
}
