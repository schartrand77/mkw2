import Link from 'next/link'
import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { getOrderForUser, type OrderDetail } from '@/lib/orders'
import { getOrderProductionDetail } from '@/lib/production'
import OrderStatusBadge from '@/components/orders/OrderStatusBadge'
import { formatCurrency, type Currency } from '@/lib/currency'
import { normalizeOrderStatus } from '@/lib/order-status'
import OrderStatusControl from '@/components/admin/OrderStatusControl'
import SlicerProfileUploader from '@/components/admin/SlicerProfileUploader'
import PrinterAssignmentPanel from '@/components/admin/PrinterAssignmentPanel'
import PackingChecklist from '@/components/admin/PackingChecklist'
import ShippingTrackingForm from '@/components/admin/ShippingTrackingForm'
import SlicerStatsForm from '@/components/admin/SlicerStatsForm'
import OrderItemQuantityControl from '@/components/admin/OrderItemQuantityControl'
import StripePaymentPanel from '@/components/admin/StripePaymentPanel'
import PrintLabSubmitButton from '@/components/admin/PrintLabSubmitButton'
import PrintLabLinkPanel from '@/components/admin/PrintLabLinkPanel'

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

type AdminOrderDetailProps = { params: Promise<{ userId: string; orderId: string }> }

export default async function AdminOrderDetailPage({ params }: AdminOrderDetailProps) {
  const adminId = await requireAdminServer()
  if (!adminId) return redirect('/')

  const { userId, orderId } = await params
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  })
  if (!user) return redirect('/admin/users')

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
  const timeline = buildTimeline(order)
  const metadata = order.metadata && typeof order.metadata === 'object' && !Array.isArray(order.metadata)
    ? (order.metadata as Record<string, any>)
    : null
  const amsTrayMap = Array.isArray(metadata?.amsTrayMap) ? metadata?.amsTrayMap : null
  const packingChecklist = Array.isArray(metadata?.packingChecklist?.items) ? metadata?.packingChecklist?.items : []
  const slicerStats = metadata?.slicerStats && typeof metadata.slicerStats === 'object' && !Array.isArray(metadata.slicerStats)
    ? (metadata.slicerStats as Record<string, any>)
    : null
  const slicerPrintHours = slicerStats?.printHours != null && Number.isFinite(Number(slicerStats.printHours))
    ? Number(slicerStats.printHours)
    : null
  const shippingInfo = metadata?.shippingInfo && typeof metadata.shippingInfo === 'object' && !Array.isArray(metadata.shippingInfo)
    ? (metadata.shippingInfo as Record<string, any>)
    : null
  const orderColors = Array.from(
    new Set(
      order.items
        .flatMap((item) => Array.isArray(item.colors) ? (item.colors as string[]) : [])
        .map((color) => color?.trim())
        .filter((color): color is string => Boolean(color)),
    ),
  )
  const stripeMetadata = metadata?.stripe && typeof metadata.stripe === 'object' && !Array.isArray(metadata.stripe)
    ? metadata.stripe as Record<string, any>
    : null
  const stripeInvoiceMetadata = metadata?.stripeInvoice && typeof metadata.stripeInvoice === 'object' && !Array.isArray(metadata.stripeInvoice)
    ? metadata.stripeInvoice as Record<string, any>
    : null
  const lastPrintLabSubmission = metadata?.lastPrintLabSubmission && typeof metadata.lastPrintLabSubmission === 'object' && !Array.isArray(metadata.lastPrintLabSubmission)
    ? metadata.lastPrintLabSubmission as Record<string, any>
    : null
  const paymentIntentId = order.stripePaymentIntentId
    || (typeof metadata?.paymentIntentId === 'string' ? metadata.paymentIntentId : null)
    || (typeof stripeMetadata?.paymentIntentId === 'string' ? stripeMetadata.paymentIntentId : null)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link href={`/admin/users/${userId}/orders`} className="text-slate-400 hover:text-white underline underline-offset-4">
          Back to user orders
        </Link>
        <span className="text-xs text-slate-500">Order created {formatDate(order.createdAt)}</span>
      </div>
      <div className="text-sm text-slate-400">
        Viewing as admin: {user.name || user.email}
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
                  <OrderItemQuantityControl orderId={order.id} itemId={item.id} quantity={item.quantity} />
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
                    <p className="text-sm font-medium">{production ? production.totalHours.toFixed(1) : '--'} hrs</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Actual print hours</p>
                    <p className="text-sm font-medium">{slicerPrintHours != null ? slicerPrintHours.toFixed(1) : '--'} hrs</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Queue position</p>
                    <p className="text-sm font-medium">{production?.queuePosition ?? '--'}</p>
                  </div>
                </div>
                {production?.orderWorksLastError ? (
                  <p className="text-xs text-rose-200">OrderWorks error: {production.orderWorksLastError}</p>
                ) : null}
                {order.failedAt ? (
                  <p className="text-xs text-rose-200">
                    Failed {formatDate(order.failedAt)}
                    {order.failureNote ? ` - ${order.failureNote}` : ''}
                  </p>
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
              <ShippingTrackingForm orderId={order.id} initial={shippingInfo} />
            </div>
            <StripePaymentPanel
              orderId={order.id}
              paymentIntentId={paymentIntentId}
              paymentStatus={order.paymentStatus || (typeof stripeMetadata?.paymentStatus === 'string' ? stripeMetadata.paymentStatus : null)}
              chargeId={order.stripeChargeId || (typeof stripeMetadata?.chargeId === 'string' ? stripeMetadata.chargeId : null)}
              customerId={order.stripeCustomerId || (typeof stripeMetadata?.customerId === 'string' ? stripeMetadata.customerId : null)}
              receiptUrl={order.receiptUrl || (typeof stripeMetadata?.receiptUrl === 'string' ? stripeMetadata.receiptUrl : null)}
              invoiceId={(order as any).stripeInvoiceId || (typeof stripeInvoiceMetadata?.invoiceId === 'string' ? stripeInvoiceMetadata.invoiceId : null)}
              hostedInvoiceUrl={(order as any).hostedInvoiceUrl || (typeof stripeInvoiceMetadata?.hostedInvoiceUrl === 'string' ? stripeInvoiceMetadata.hostedInvoiceUrl : null)}
              invoicePdfUrl={(order as any).invoicePdfUrl || (typeof stripeInvoiceMetadata?.invoicePdfUrl === 'string' ? stripeInvoiceMetadata.invoicePdfUrl : null)}
              totalCents={order.totalCents}
              refundedCents={order.refundedCents}
              currency={order.currency}
            />
            <div className="rounded-xl border border-white/10 p-4 bg-black/20 space-y-2">
              <h2 className="text-lg font-semibold">Actions</h2>
              <p className="text-sm text-slate-400">Customer actions are disabled in admin view.</p>
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Update status</p>
                <OrderStatusControl orderId={order.id} status={order.status} failureNote={order.failureNote} />
              </div>
              <div className="space-y-2">
                <PrinterAssignmentPanel
                  orderId={order.id}
                  initialPrinterId={order.printerId}
                  colors={orderColors}
                  initialTrayMap={amsTrayMap}
                />
              </div>
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Slicer profile</p>
                <SlicerProfileUploader
                  orderId={order.id}
                  existingName={metadata?.slicerProfileName}
                  existingPath={metadata?.slicerProfilePath}
                />
              </div>
              <div className="space-y-2">
                <PackingChecklist orderId={order.id} initialItems={packingChecklist} />
              </div>
              <div className="space-y-2">
                <SlicerStatsForm orderId={order.id} initial={slicerStats} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <PrintLabSubmitButton orderId={order.id} />
                <Link
                  href={`/admin/users/${userId}/orders/${orderId}/ticket`}
                  className="text-sm px-3 py-1.5 rounded-md border border-white/10 hover:border-white/30"
                >
                  Print job ticket
                </Link>
                <Link
                  href={`/api/admin/orders/${order.id}/receipt`}
                  className="text-sm px-3 py-1.5 rounded-md border border-white/10 hover:border-white/30"
                >
                  Download receipt PDF
                </Link>
              </div>
              {lastPrintLabSubmission ? (
                <p className={`text-xs ${lastPrintLabSubmission.status === 'failed' ? 'text-rose-200' : 'text-emerald-300'}`}>
                  PrintLab: {String(lastPrintLabSubmission.status || 'submitted')}
                  {lastPrintLabSubmission.printerName ? ` - ${lastPrintLabSubmission.printerName}` : ''}
                  {lastPrintLabSubmission.error ? ` - ${lastPrintLabSubmission.error}` : ''}
                </p>
              ) : (
                <p className="text-xs text-slate-500">PrintLab: not submitted yet.</p>
              )}
              <PrintLabLinkPanel
                orderId={order.id}
                current={lastPrintLabSubmission ? {
                  status: typeof lastPrintLabSubmission.status === 'string' ? lastPrintLabSubmission.status : null,
                  printerName: typeof lastPrintLabSubmission.printerName === 'string' ? lastPrintLabSubmission.printerName : null,
                  printLabJobId: typeof lastPrintLabSubmission.printLabJobId === 'string' ? lastPrintLabSubmission.printLabJobId : null,
                  error: typeof lastPrintLabSubmission.error === 'string' ? lastPrintLabSubmission.error : null,
                } : null}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glass rounded-2xl border border-white/10 p-6 space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Approvals</h2>
            <p className="text-sm text-slate-400">Review change requests and responses.</p>
          </div>
          {order.approvalRequests.length === 0 ? (
            <p className="text-sm text-slate-400">No approvals yet.</p>
          ) : (
            <ul className="space-y-3">
              {order.approvalRequests.map((req) => (
                <li key={req.id} className="rounded-lg border border-white/10 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{req.message}</p>
                      <p className="text-xs text-slate-400">Status: {req.status}</p>
                    </div>
                    <p className="text-xs text-slate-400">{formatDate(req.createdAt)}</p>
                  </div>
                  {req.responseNote && (
                    <p className="text-xs text-slate-300 mt-2">Response: {req.responseNote}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="glass rounded-2xl border border-white/10 p-6 space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Messages</h2>
            <p className="text-sm text-slate-400">Conversation between customer and shop.</p>
          </div>
          {order.messages.length === 0 ? (
            <p className="text-sm text-slate-400">No messages yet.</p>
          ) : (
            <ul className="space-y-3">
              {order.messages.map((msg) => (
                <li key={msg.id} className="rounded-lg border border-white/10 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{msg.senderRole === 'customer' ? 'Customer' : 'Shop'}</p>
                      <p className="text-xs text-slate-400">
                        {msg.user?.name || msg.user?.email || 'Unknown'}
                      </p>
                    </div>
                    <p className="text-xs text-slate-400">{formatDate(msg.createdAt)}</p>
                  </div>
                  <p className="text-xs text-slate-300 mt-2">{msg.body}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
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
      </div>
    </div>
  )
}

function buildProgress(status: string) {
  const steps = [
    { key: 'queued', label: 'Queued' },
    { key: 'printing', label: 'Printing' },
    { key: 'failed', label: 'Failed' },
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
      actor: 'Customer',
    },
  ]

  order.messages.forEach((message) => {
    const isCustomer = message.senderRole === 'customer'
    entries.push({
      id: `message-${message.id}`,
      title: isCustomer ? 'Message sent' : 'Message received',
      createdAt: message.createdAt,
      actor: isCustomer ? 'Customer' : 'Shop',
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
        actor: 'Customer',
        detail: request.responseNote || undefined,
      })
    }
  })

  order.revisions.forEach((revision) => {
    entries.push({
      id: `revision-${revision.id}`,
      title: `Revision v${revision.version} uploaded`,
      createdAt: revision.createdAt,
      actor: 'Customer',
      detail: revision.note || undefined,
      link: { href: buildFileHref(revision.filePath), label: 'Download file' },
    })
  })

  return entries.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
}
