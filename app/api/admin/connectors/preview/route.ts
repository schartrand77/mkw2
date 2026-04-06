import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/app/api/admin/_utils'
import {
  buildShippingManifestPayload,
  buildShopifyDraftOrderPayload,
  type ConnectorBetaId,
} from '@/lib/connector-betas'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }

  const connectorId = req.nextUrl.searchParams.get('connectorId') as ConnectorBetaId | null
  const orderId = req.nextUrl.searchParams.get('orderId')
  if (!connectorId || !orderId) {
    return NextResponse.json({ error: 'connectorId and orderId are required.' }, { status: 400 })
  }

  const order = await prisma.printOrder.findUnique({
    where: { id: orderId },
    include: {
      organization: { select: { name: true } },
      items: {
        select: {
          modelTitle: true,
          partName: true,
          quantity: true,
          unitPriceCents: true,
          totalCents: true,
          material: true,
          finish: true,
        },
      },
    },
  })
  if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 })

  if (connectorId === 'shopify_draft_order') {
    return NextResponse.json({ connectorId, payload: buildShopifyDraftOrderPayload(order) })
  }
  if (connectorId === 'shipping_manifest') {
    return NextResponse.json({ connectorId, payload: buildShippingManifestPayload(order) })
  }
  return NextResponse.json({ error: 'Unknown connector.' }, { status: 400 })
}
