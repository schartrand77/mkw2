import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getUserIdFromCookie } from '@/lib/auth'
import { listOrdersForUser } from '@/lib/orders'
import OrderStatusBadge from '@/components/orders/OrderStatusBadge'
import { formatCurrency, type Currency } from '@/lib/currency'

function formatOrderNumber(orderNumber?: number | null) {
  if (!orderNumber || orderNumber <= 0) return 'Draft order'
  return `MW-${orderNumber.toString().padStart(5, '0')}`
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(value)
}

export const metadata = {
  title: 'My Orders',
}

export default async function CustomerOrdersPage() {
  const userId = await getUserIdFromCookie()
  if (!userId) return redirect('/login')
  const orders = await listOrdersForUser(userId, 30)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">My Orders</h1>
        <p className="text-slate-400">Track print jobs, submit revisions, and request reprints.</p>
      </div>
      {orders.length === 0 ? (
        <div className="glass rounded-2xl border border-white/10 p-8 text-center space-y-4">
          <p className="text-slate-300">No orders yet. Browse the catalog and configure your parts right from the cart.</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/discover" className="btn">Browse models</Link>
            <Link href="/cart" className="px-4 py-2 rounded-md border border-white/20 hover:border-white/40">Open cart configurator</Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {orders.map((order) => (
            <Link key={order.id} href={`/customer/orders/${order.id}`} className="glass rounded-2xl border border-white/10 p-5 hover:border-white/20 transition">
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
