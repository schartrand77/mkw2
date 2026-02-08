import Link from 'next/link'
import { prisma } from '@/lib/db'
import { getUserIdFromCookie } from '@/lib/auth'
import { listOrdersForUser } from '@/lib/orders'
import UploadForm from '@/app/upload/UploadForm'
import CustomerPresetsPanel from '@/components/customer/CustomerPresetsPanel'
import { formatCurrency } from '@/lib/currency'

export const dynamic = 'force-dynamic'

export default async function CustomerPortalPage() {
  const userId = await getUserIdFromCookie()
  if (!userId) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <h1 className="text-2xl font-semibold">Customer Portal</h1>
        <p className="text-slate-400 text-sm">
          Please <Link href="/login" className="text-brand-300 underline underline-offset-4">sign in</Link> to access your portal.
        </p>
      </div>
    )
  }

  const [cfg, orders] = await Promise.all([
    prisma.siteConfig.findUnique({ where: { id: 'main' }, select: { directUploadUrl: true } }),
    listOrdersForUser(userId, 6),
  ])
  const fallback = process.env.DIRECT_UPLOAD_URL || null
  const directUploadUrl = cfg?.directUploadUrl || fallback

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold">Customer Portal</h1>
        <p className="text-sm text-slate-400">Upload models, track orders, and save print presets.</p>
      </div>

      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6">
        <div className="space-y-4">
          <div className="glass rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-semibold">Upload for instant estimate</h2>
            <p className="text-sm text-slate-400 mt-1">
              Upload your model to see an instant estimate and configure materials before checkout.
            </p>
            <div className="mt-4">
              <UploadForm directUploadUrl={directUploadUrl} />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="glass rounded-2xl border border-white/10 p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Recent orders</h2>
              <Link href="/customer/orders" className="text-xs text-brand-300 underline underline-offset-4">View all</Link>
            </div>
            {orders.length === 0 ? (
              <p className="text-sm text-slate-400">No orders yet.</p>
            ) : (
              <div className="space-y-2">
                {orders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/customer/orders/${order.id}`}
                    className="block rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm hover:border-white/30"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Order #{order.orderNumber}</span>
                      <span className="text-xs text-slate-400">{new Date(order.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="text-xs text-slate-400">
                      {formatCurrency(order.totalCents / 100)} · {order.items.length} item{order.items.length === 1 ? '' : 's'}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <CustomerPresetsPanel />
        </div>
      </div>
    </div>
  )
}
