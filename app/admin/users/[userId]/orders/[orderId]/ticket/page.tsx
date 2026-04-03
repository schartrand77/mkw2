import Link from 'next/link'
import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { getOrderForUser } from '@/lib/orders'
import { getOrderProductionDetail } from '@/lib/production'
import { formatCurrency, type Currency } from '@/lib/currency'
import OrderStatusBadge from '@/components/orders/OrderStatusBadge'
import { resolveBaseUrl } from '@/lib/base-url'
import { generateQrDataUrl } from '@/lib/qr'
import PrintTicketButton from '@/components/admin/PrintTicketButton'

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

function ensureBaseUrl(base: string) {
  const trimmed = base.trim().replace(/\/+$/, '')
  return trimmed || (process.env.BASE_URL || 'http://localhost:3000').replace(/\/+$/, '')
}

type TicketPageProps = { params: Promise<{ userId: string; orderId: string }> }

export default async function AdminOrderTicketPage({ params }: TicketPageProps) {
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

  const baseUrl = ensureBaseUrl(await resolveBaseUrl())
  const orderUrl = `${baseUrl}/admin/users/${userId}/orders/${orderId}`
  const qrDataUrl = await generateQrDataUrl(orderUrl, { width: 220 })

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .ticket-sheet { box-shadow: none !important; border-color: #e5e7eb !important; }
          .ticket-muted { color: #4b5563 !important; }
        }
        @page {
          margin: 16mm;
        }
      `}</style>
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-sm">
          <Link href={`/admin/users/${userId}/orders/${orderId}`} className="text-slate-400 hover:text-white underline underline-offset-4">
            Back to order
          </Link>
          <span className="text-xs text-slate-500">Ticket generated {formatDate(new Date())}</span>
        </div>
        <PrintTicketButton />
      </div>

      <div className="ticket-sheet glass rounded-2xl border border-white/10 p-6 space-y-6 bg-black/30">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Job Ticket</p>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-semibold">{formatOrderNumber(order.orderNumber)}</h1>
              <OrderStatusBadge status={order.status} />
            </div>
            <p className="text-sm text-slate-300">Placed {formatDate(order.createdAt)}</p>
            <p className="text-sm text-slate-400">Customer: {user.name || user.email}</p>
            <p className="text-sm text-slate-400">Email: {user.email}</p>
          </div>
          <div className="text-center space-y-2">
            <img src={qrDataUrl} alt="QR code" className="h-[140px] w-[140px] mx-auto border border-white/10 rounded-md bg-white p-2" />
            <p className="text-xs text-slate-400">Scan to open order</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Items</h2>
            <div className="space-y-3">
              {order.items.map((item, idx) => (
                <div key={item.id} className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{idx + 1}. {item.quantity}x {item.modelTitle}</p>
                      {item.partName && <p className="text-xs text-slate-400">Part: {item.partName}</p>}
                    </div>
                    <p className="text-sm text-slate-200">{formatCurrency(item.totalCents / 100, order.currency as Currency)}</p>
                  </div>
                  <div className="text-xs text-slate-400 space-y-1">
                    <p>Material: {item.material}</p>
                    {Array.isArray(item.colors) && item.colors.length > 0 ? (
                      <p>Colors: {(item.colors as string[]).join(', ')}</p>
                    ) : null}
                    {typeof item.infillPct === 'number' ? <p>Infill: {item.infillPct}%</p> : null}
                    {item.finish ? <p>Finish: {item.finish}</p> : null}
                  </div>
                  {item.customNotes ? (
                    <p className="text-xs text-slate-300">Notes: {item.customNotes}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-2">
              <h2 className="text-lg font-semibold">Production</h2>
              <div className="grid grid-cols-2 gap-3 text-xs text-slate-300">
                <div>
                  <p className="text-slate-500">Queue position</p>
                  <p className="text-sm font-medium">{production?.queuePosition ?? '-'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Estimated hours</p>
                  <p className="text-sm font-medium">{production ? production.totalHours.toFixed(1) : '-'} hrs</p>
                </div>
                <div>
                  <p className="text-slate-500">OrderWorks</p>
                  <p className="text-sm font-medium capitalize">{production?.orderWorksStatus || 'pending'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Est. completion</p>
                  <p className="text-sm font-medium">
                    {production?.estimatedCompletionAt ? formatDate(new Date(production.estimatedCompletionAt)) : 'To be scheduled'}
                  </p>
                </div>
              </div>
              {production?.orderWorksLastError ? (
                <p className="text-xs text-rose-200">OrderWorks error: {production.orderWorksLastError}</p>
              ) : null}
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-2">
              <h2 className="text-lg font-semibold">Shipping</h2>
              <p className="capitalize text-sm text-slate-300">{order.shippingMethod}</p>
              {shippingAddress ? (
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
              ) : (
                <p className="text-sm text-slate-400">Pickup order</p>
              )}
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-2">
              <h2 className="text-lg font-semibold">Order Notes</h2>
              <p className="text-sm text-slate-300">{order.notes || 'No order notes.'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
