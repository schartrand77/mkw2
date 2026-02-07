import { NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/_utils'
import { prisma } from '@/lib/db'
import { stockworksJson, stockworksDisabledResponse } from '@/lib/stockworks-client'
import { buildConsumptionLinesForOrder, type InventoryItem } from '@/lib/stockworks-consumption'

export const dynamic = 'force-dynamic'

const QUEUE_STATUSES = new Set([
  'queued',
  'printing',
  'post_process',
  'failed',
  'awaiting_review',
  'awaiting_payment',
  'in_production',
  'ready',
])

export async function GET() {
  try { await requireAdmin() } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }

  try {
    const [cfg, inventory, orders] = await Promise.all([
      prisma.siteConfig.findUnique({ where: { id: 'main' } }),
      stockworksJson('/inventory') as Promise<InventoryItem[]>,
      prisma.printOrder.findMany({
        where: { status: { in: Array.from(QUEUE_STATUSES) } },
        include: { items: true },
        orderBy: { createdAt: 'asc' },
      }),
    ])

    const usageMap = new Map<number, number>()

    for (const order of orders) {
      const reference = order.orderNumber ? `MW-${String(order.orderNumber).padStart(5, '0')}` : order.id
      const { lines } = await buildConsumptionLinesForOrder(order, cfg, inventory, reference)
      for (const line of lines) {
        const current = usageMap.get(line.inventory_item_id) ?? 0
        usageMap.set(line.inventory_item_id, current + Math.abs(line.change_grams))
      }
    }

    const predicted = inventory.map((item) => {
      const projectedUsage = usageMap.get(item.id) ?? 0
      const projectedRemaining = Number(item.quantity_grams) - projectedUsage
      return {
        ...item,
        projectedUsage,
        projectedRemaining,
        projectedLow: projectedRemaining <= Number(item.reorder_level),
      }
    })

    return NextResponse.json({ enabled: true, inventory: predicted })
  } catch (err: any) {
    if (err?.message === 'StockWorks is not configured') return stockworksDisabledResponse()
    return NextResponse.json({ enabled: false, error: err?.message || 'StockWorks prediction failed' }, { status: err?.status || 502 })
  }
}
