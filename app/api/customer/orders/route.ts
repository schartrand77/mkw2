import { NextRequest, NextResponse } from 'next/server'
import { getUserIdFromCookie } from '@/lib/auth'
import { listOrdersForUser } from '@/lib/orders'

export async function GET(req: NextRequest) {
  const userId = await getUserIdFromCookie()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limitParam = Number(req.nextUrl.searchParams.get('limit') || 30)
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.trunc(limitParam), 1), 100) : 30
  const orders = await listOrdersForUser(userId, limit)

  return NextResponse.json({ orders, query: { limit } })
}
