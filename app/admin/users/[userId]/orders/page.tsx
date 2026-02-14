import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { listOrdersForUser } from '@/lib/orders'
import OrderStatusBadge from '@/components/orders/OrderStatusBadge'
import { formatCurrency, type Currency } from '@/lib/currency'
import UserOrderJobControls from '@/components/admin/UserOrderJobControls'
import DeleteOrderButton from '@/components/admin/DeleteOrderButton'
import { normalizePaymentMethod, normalizePaymentStatus } from '@/lib/orderworks-status'

export const dynamic = 'force-dynamic'

async function requireAdminServer() {
  const cookieStore = await cookies()
  const token = cookieStore.get('mwv2_token')?.value
  const payload = token ? verifyToken(token) : null
  if (!payload?.sub) return null
  const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { isAdmin: true, role: true } })
  const role = user?.role || null
  return (user?.isAdmin || role === 'admin' || role === 'staff') ? payload.sub : null
}

function formatOrderNumber(orderNumber?: number | null) {
  if (!orderNumber || orderNumber <= 0) return 'Draft order'
  return `MW-${orderNumber.toString().padStart(5, '0')}`
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(value)
}

function extractPaymentIntentId(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const raw = (metadata as { paymentIntentId?: unknown }).paymentIntentId
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null
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
  const paymentIntentIds = Array.from(
    new Set(
      orders
        .map((order) => extractPaymentIntentId(order.metadata))
        .filter((value): value is string => Boolean(value)),
    ),
  )
  const linkedJobs = paymentIntentIds.length > 0
    ? await prisma.jobForm.findMany({
      where: { paymentIntentId: { in: paymentIntentIds } },
      select: {
        id: true,
        paymentIntentId: true,
        status: true,
        fulfillmentStatus: true,
        paymentMethod: true,
        paymentStatus: true,
      },
    })
    : []
  const jobsByPaymentIntentId = new Map(linkedJobs.map((job) => [job.paymentIntentId, job]))

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
          {orders.map((order) => {
            const paymentIntentId = extractPaymentIntentId(order.metadata)
            const linkedJob = paymentIntentId ? jobsByPaymentIntentId.get(paymentIntentId) : undefined
            return (
              <div
                key={order.id}
                className="glass rounded-2xl border border-white/10 p-5 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{formatOrderNumber(order.orderNumber)}</p>
                    <p className="text-lg font-semibold">{formatCurrency(order.totalCents / 100, order.currency as Currency)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <OrderStatusBadge status={order.status} />
                    <Link
                      href={`/admin/users/${user.id}/orders/${order.id}`}
                      className="text-xs px-2 py-1 rounded-md border border-white/20 hover:border-white/40"
                    >
                      Open order
                    </Link>
                    <DeleteOrderButton orderId={order.id} orderNumber={order.orderNumber} />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-slate-300">
                  <div className="truncate">
                    {order.items.map((item) => `${item.quantity}x ${item.modelTitle}`).join(' | ')}
                  </div>
                  <div className="text-xs text-slate-400">
                    {formatDate(order.createdAt)}
                  </div>
                </div>
                <div>
                  {linkedJob ? (
                    <UserOrderJobControls
                      jobId={linkedJob.id}
                      paymentIntentId={linkedJob.paymentIntentId}
                      initialStatus={linkedJob.status === 'sent' ? 'sent' : 'pending'}
                      initialFulfillmentStatus={linkedJob.fulfillmentStatus}
                      initialPaymentMethod={normalizePaymentMethod(linkedJob.paymentMethod) || ''}
                      initialPaymentStatus={normalizePaymentStatus(linkedJob.paymentStatus) || ''}
                    />
                  ) : (
                    <p className="text-xs text-slate-500">No linked OrderWorks job found for this order.</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
