import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getUserIdFromCookie } from '@/lib/auth'
import { getOrderForUser, type OrderDetail } from '@/lib/orders'
import { getOrderProductionDetail } from '@/lib/production'
import OrderStatusBadge from '@/components/orders/OrderStatusBadge'
import RequestReprintButton from '@/components/orders/RequestReprintButton'
import RevisionUploader from '@/components/orders/RevisionUploader'
import ApprovalRequests from '@/components/orders/ApprovalRequests'
import OrderMessageComposer from '@/components/orders/OrderMessageComposer'
import { formatCurrency, type Currency } from '@/lib/currency'
import { normalizeOrderStatus } from '@/lib/order-status'

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

type CustomerOrderDetailProps = { params: Promise<{ orderId: string }> }

export default async function CustomerOrderDetail({ params }: CustomerOrderDetailProps) {
  const { orderId } = await params
  const userId = await getUserIdFromCookie()
  if (!userId) return redirect('/login')
  const order = await getOrderForUser(orderId, userId)
  if (!order) return notFound()
  const shippingAddress = normalizeAddress(order.shippingAddress)
  const production = await getOrderProductionDetail({
    id: order.id,
    status: order.status,
    createdAt: order.createdAt,
    metadata: order.metadata,
    items: order.items,
  })
  const progress = buildProgress(order.status)
  const pendingApprovals = order.approvalRequests.filter((request) => request.status === 'pending')
  const timeline = buildTimeline(order)

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
              <h2 className="text-lg font-semibold">Production</h2>
              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Progress</span>
                    <span>{progress.label}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-brand-500" style={{ width: `${progress.percent}%` }} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs text-slate-300">
                  <div>
                    <p className="text-slate-500">OrderWorks sync</p>
                    <p className="text-sm font-medium capitalize">{production?.orderWorksStatus || 'pending'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Estimated completion</p>
                    <p className="text-sm font-medium">
                      {production?.estimatedCompletionAt ? formatDate(new Date(production.estimatedCompletionAt)) : 'To be scheduled'}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Estimated print hours</p>
                    <p className="text-sm font-medium">{production ? production.totalHours.toFixed(1) : 'ƒ?"'} hrs</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Queue position</p>
                    <p className="text-sm font-medium">{production?.queuePosition ?? 'ƒ?"'}</p>
                  </div>
                </div>
                {production?.orderWorksLastError ? (
                  <p className="text-xs text-rose-200">OrderWorks error: {production.orderWorksLastError}</p>
                ) : null}
              </div>
            </div>
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
          <div>
            <h2 className="text-xl font-semibold">Approvals & messages</h2>
            <p className="text-sm text-slate-400">Respond to change requests and keep the shop updated.</p>
          </div>
          <div className="space-y-4">
            {pendingApprovals.length > 0 ? (
              <ApprovalRequests orderId={order.id} requests={pendingApprovals} />
            ) : (
              <p className="text-sm text-slate-400">No approvals pending.</p>
            )}
            <div className="border-t border-white/10 pt-4 space-y-3">
              <h3 className="text-sm font-semibold text-slate-200">Message the shop</h3>
              <OrderMessageComposer orderId={order.id} />
            </div>
          </div>
        </div>
        <div className="glass rounded-2xl border border-white/10 p-6 space-y-4">
          <h2 className="text-xl font-semibold">Order timeline</h2>
          {timeline.length === 0 ? (
            <p className="text-sm text-slate-400">No updates yet.</p>
          ) : (
            <ul className="space-y-3">
              {timeline.map((entry) => (
                <li key={entry.id} className="rounded-lg border border-white/10 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{entry.title}</p>
                      {entry.actor && <p className="text-xs text-slate-400">{entry.actor}</p>}
                    </div>
                    <p className="text-xs text-slate-400">{formatDate(entry.createdAt)}</p>
                  </div>
                  {entry.detail && <p className="text-xs text-slate-300 mt-2">{entry.detail}</p>}
                  {entry.link ? (
                    <a
                      href={entry.link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-brand-400 hover:text-brand-300 underline underline-offset-4 mt-2 inline-block"
                    >
                      {entry.link.label}
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
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

function buildProgress(status: string) {
  const steps = [
    { key: 'queued', label: 'Queued' },
    { key: 'printing', label: 'Printing' },
    { key: 'post_process', label: 'Post-process' },
    { key: 'shipped', label: 'Shipped' },
    { key: 'completed', label: 'Completed' },
  ]
  const normalized = normalizeOrderStatus(status)
  const index = steps.findIndex((step) => step.key === normalized)
  const safeIndex = index >= 0 ? index : 0
  const percent = steps.length > 1 ? Math.round((safeIndex / (steps.length - 1)) * 100) : 0
  return { percent, label: steps[safeIndex]?.label ?? 'Queued' }
}

type TimelineEntry = {
  id: string
  title: string
  createdAt: Date
  actor?: string
  detail?: string
  link?: { href: string; label: string }
}

function buildTimeline(order: OrderDetail): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    {
      id: `order-${order.id}`,
      title: 'Order placed',
      createdAt: order.createdAt,
      actor: 'You',
    },
  ]

  order.messages.forEach((message) => {
    const isCustomer = message.senderRole === 'customer'
    entries.push({
      id: `message-${message.id}`,
      title: isCustomer ? 'Message sent' : 'Message received',
      createdAt: message.createdAt,
      actor: isCustomer ? 'You' : 'Shop',
      detail: message.body,
    })
  })

  order.approvalRequests.forEach((request) => {
    entries.push({
      id: `approval-request-${request.id}`,
      title: 'Change request',
      createdAt: request.createdAt,
      actor: 'Shop',
      detail: request.message,
    })
    if (request.respondedAt) {
      entries.push({
        id: `approval-response-${request.id}`,
        title: request.status === 'approved' ? 'Changes approved' : 'Changes requested',
        createdAt: request.respondedAt,
        actor: 'You',
        detail: request.responseNote || undefined,
      })
    }
  })

  order.revisions.forEach((revision) => {
    entries.push({
      id: `revision-${revision.id}`,
      title: `Revision v${revision.version} uploaded`,
      createdAt: revision.createdAt,
      actor: 'You',
      detail: revision.note || undefined,
      link: { href: buildFileHref(revision.filePath), label: 'Download file' },
    })
  })

  return entries.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
}
