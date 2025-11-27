import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getUserIdFromCookie } from '@/lib/auth'
import { getOrderForUser } from '@/lib/orders'
import OrderStatusBadge from '@/components/orders/OrderStatusBadge'
import RequestReprintButton from '@/components/orders/RequestReprintButton'
import RevisionUploader from '@/components/orders/RevisionUploader'
import { formatCurrency, type Currency } from '@/lib/currency'

function formatOrderNumber(orderNumber?: number | null) {
  if (!orderNumber || orderNumber <= 0) return 'Draft order'
  return `MW-${orderNumber.toString().padStart(5, '0')}`
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(value)
}

function normalizeAddress(data: any) {
  if (!data || typeof data !== 'object') return null
  return {
    name: typeof (data as any).name === 'string' ? (data as any).name : undefined,
    line1: typeof (data as any).line1 === 'string' ? (data as any).line1 : undefined,
    line2: typeof (data as any).line2 === 'string' ? (data as any).line2 : undefined,
    city: typeof (data as any).city === 'string' ? (data as any).city : undefined,
    state: typeof (data as any).state === 'string' ? (data as any).state : undefined,
    postalCode: typeof (data as any).postalCode === 'string' ? (data as any).postalCode : undefined,
    country: typeof (data as any).country === 'string' ? (data as any).country : undefined,
  }
}

function buildFileHref(path: string) {
  if (!path) return '#'
  const normalized = path.startsWith('/files/') ? path : `/files/${path}`
  return normalized.replace(/\\/g, '/').replace(/\/+/g, '/')
}

export default async function CustomerOrderDetail({ params }: { params: { orderId: string } }) {
  const userId = await getUserIdFromCookie()
  if (!userId) return redirect('/login')
  const order = await getOrderForUser(params.orderId, userId)
  if (!order) return notFound()
  const shippingAddress = normalizeAddress(order.shippingAddress)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/customer/orders" className="text-sm text-slate-400 hover:text-white underline underline-offset-4">Back to orders</Link>
        <span className="text-xs text-slate-500">Order created {formatDate(order.createdAt)}</span>
      </div>
      <div className="glass rounded-2xl border border-white/10 p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{formatOrderNumber(order.orderNumber)}</p>
            <h1 className="text-3xl font-semibold">{formatCurrency(order.totalCents / 100, order.currency as Currency)}</h1>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Items</h2>
            <div className="space-y-3">
              {order.items.map((item) => (
                <div key={item.id} className="rounded-xl border border-white/10 p-4 bg-black/20">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{item.quantity}x {item.modelTitle}</p>
                      {item.partName && <p className="text-xs text-slate-400">Part: {item.partName}</p>}
                    </div>
                    <p className="text-sm text-slate-200">{formatCurrency(item.totalCents / 100, order.currency as Currency)}</p>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    Material {item.material}
                    {Array.isArray(item.colors) && item.colors.length > 0 ? ` - Colors: ${(item.colors as string[]).join(', ')}` : ''}
                    {typeof item.infillPct === 'number' ? ` - Infill ${item.infillPct}%` : ''}
                  </p>
                  {item.customNotes && <p className="text-xs text-slate-400 mt-1">Notes: {item.customNotes}</p>}
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-6">
            <div className="rounded-xl border border-white/10 p-4 bg-black/20 space-y-3">
              <h2 className="text-lg font-semibold">Shipping</h2>
              <p className="capitalize text-sm text-slate-300">{order.shippingMethod}</p>
              {shippingAddress && (
                <div className="text-sm text-slate-300 space-y-1">
                  {shippingAddress.name && <p className="font-medium">{shippingAddress.name}</p>}
                  {shippingAddress.line1 && <p>{shippingAddress.line1}</p>}
                  {shippingAddress.line2 && <p>{shippingAddress.line2}</p>}
                  <p>
                    {[shippingAddress.city, shippingAddress.state].filter(Boolean).join(', ')}
                    {shippingAddress.postalCode ? ` ${shippingAddress.postalCode}` : ''}
                  </p>
                  {shippingAddress.country && <p>{shippingAddress.country}</p>}
                </div>
              )}
            </div>
            <div className="rounded-xl border border-white/10 p-4 bg-black/20 space-y-3">
              <h2 className="text-lg font-semibold">Actions</h2>
              <RequestReprintButton orderId={order.id} />
            </div>
          </div>
        </div>
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glass rounded-2xl border border-white/10 p-6 space-y-4">
          <h2 className="text-xl font-semibold">Revisions</h2>
          {order.revisions.length === 0 ? (
            <p className="text-sm text-slate-400">No revisions uploaded yet.</p>
          ) : (
            <ul className="space-y-3">
              {order.revisions.map((rev) => (
                <li key={rev.id} className="rounded-lg border border-white/10 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-sm">v{rev.version} - {rev.label}</p>
                      <p className="text-xs text-slate-400">Uploaded {formatDate(rev.createdAt)}</p>
                    </div>
                    <a href={buildFileHref(rev.filePath)} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-400 hover:text-brand-300 underline underline-offset-4">
                      Download
                    </a>
                  </div>
                  {rev.note && <p className="text-xs text-slate-300 mt-2">{rev.note}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="glass rounded-2xl border border-white/10 p-6">
          <h2 className="text-xl font-semibold mb-4">Upload a revision</h2>
          <RevisionUploader orderId={order.id} />
        </div>
      </div>
    </div>
  )
}
