import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { listOrdersForUser } from '@/lib/orders'
import OrderStatusBadge from '@/components/orders/OrderStatusBadge'
import { formatCurrency, type Currency } from '@/lib/currency'

export const dynamic = 'force-dynamic'

async function requireAdminServer() {
  const cookieStore = await cookies()
  const token = cookieStore.get('mwv2_token')?.value
  const payload = token ? verifyToken(token) : null
  if (!payload?.sub) return null
  const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { isAdmin: true } })
  return user?.isAdmin ? payload.sub : null
}

function formatOrderNumber(orderNumber?: number | null) {
  if (!orderNumber || orderNumber <= 0) return 'Draft order'
  return `MW-${orderNumber.toString().padStart(5, '0')}`
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(value)
}

type AdminOrdersProps = { params: Promise<{ userId: string }> }

export default async function AdminUserOrdersPage({ params }: AdminOrdersProps) {
  const adminId = await requireAdminServer()
  if (!adminId) return redirect('/')

  const { userId } = await params
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  })
  if (!user) return redirect('/admin/users')

  const orders = await listOrdersForUser(userId, 50)

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Orders</h1>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <Link className="underline underline-offset-4 hover:text-white" href="/admin/users">Back to users</Link>
          </div>
        </div>
        <p className="text-slate-400">
          Viewing as admin: {user.name || user.email}
        </p>
        <p className="text-xs text-slate-500">{user.email}</p>
      </div>
      {orders.length === 0 ? (
        <div className="glass rounded-2xl border border-white/10 p-8 text-center space-y-2">
          <p className="text-slate-300">No orders yet for this user.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/admin/users/${user.id}/orders/${order.id}`}
              className="glass rounded-2xl border border-white/10 p-5 hover:border-white/20 transition"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{formatOrderNumber(order.orderNumber)}</p>
                  <p className="text-lg font-semibold">{formatCurrency(order.totalCents / 100, order.currency as Currency)}</p>
                </div>
                <OrderStatusBadge status={order.status} />
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-slate-300">
                <div className="truncate">
                  {order.items.map((item) => `${item.quantity}x ${item.modelTitle}`).join(' | ')}
                </div>
                <div className="text-xs text-slate-400">
                  {formatDate(order.createdAt)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
