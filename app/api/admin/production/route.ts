import { NextResponse } from 'next/server'
import { requireAdmin } from '../_utils'
import { getProductionSnapshot } from '@/lib/production'

export async function GET() {
  try { await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  const snapshot = await getProductionSnapshot({ includeCustomer: true })
  return NextResponse.json({
    ...snapshot,
    generatedAt: snapshot.generatedAt.toISOString(),
    printers: snapshot.printers.map((printer) => ({
      ...printer,
      lastSeenAt: printer.lastSeenAt ? printer.lastSeenAt.toISOString() : null,
    })),
    orders: snapshot.orders.map((order) => ({
      ...order,
      createdAt: order.createdAt.toISOString(),
      estimatedCompletionAt: order.estimatedCompletionAt ? order.estimatedCompletionAt.toISOString() : null,
      failedAt: order.failedAt ? order.failedAt.toISOString() : null,
    })),
  })
}
