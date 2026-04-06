export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import ConnectorBetaCenter from '@/components/admin/ConnectorBetaCenter'
import { getConnectorBetaStatuses } from '@/lib/connector-betas'

export default async function AdminConnectorsPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('mwv2_token')?.value
  const payload = token ? verifyToken(token) : null
  if (!payload?.sub) redirect('/login')
  const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { isAdmin: true, role: true } })
  const role = user?.role || null
  if (!(user?.isAdmin || role === 'admin' || role === 'staff')) redirect('/')

  const orders = await prisma.printOrder.findMany({
    orderBy: { createdAt: 'desc' },
    take: 12,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      shippingMethod: true,
      customerName: true,
      customerEmail: true,
      subtotalCents: true,
      totalCents: true,
      currency: true,
      shippingAddress: true,
      metadata: true,
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

  const connectors = getConnectorBetaStatuses({ orders })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Connectors</h1>
          <p className="mt-1 text-sm text-slate-400">Beta outbound connectors built from real order and shipping data in MakerWorks.</p>
        </div>
        <Link href="/admin" className="text-xs text-brand-300 underline">Back to admin</Link>
      </div>

      <ConnectorBetaCenter
        connectors={connectors}
        orders={orders.map((order) => ({
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          shippingMethod: order.shippingMethod,
        }))}
      />
    </div>
  )
}
