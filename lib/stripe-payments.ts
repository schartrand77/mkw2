import Stripe from 'stripe'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getStripe } from '@/lib/stripe'
import { normalizePaymentStatus } from '@/lib/orderworks-status'
import type { CheckoutLineItem } from '@/types/checkout'

type StripePaymentRecord = {
  paymentIntentId: string
  paymentStatus?: string | null
  chargeId?: string | null
  receiptUrl?: string | null
  customerId?: string | null
  refundedCents?: number | null
  eventType?: string | null
}

type StripeInvoiceRecord = {
  invoiceId: string
  invoiceStatus?: string | null
  paymentStatus?: string | null
  customerId?: string | null
  hostedInvoiceUrl?: string | null
  invoicePdfUrl?: string | null
  paymentIntentId?: string | null
  eventType?: string | null
}

type OrderLike = {
  stripePaymentIntentId?: string | null
  metadata?: unknown
}

type InvoiceLineItem = Pick<CheckoutLineItem, 'title' | 'partName' | 'qty' | 'lineTotal'>

export function normalizeStripePaymentStatus(status?: string | null) {
  if (!status) return null
  if (status === 'succeeded') return 'paid'
  if (status === 'processing') return 'processing'
  if (status === 'requires_capture') return 'authorized'
  if (status === 'requires_payment_method' || status === 'requires_action') return 'failed'
  if (status === 'canceled') return 'canceled'
  return normalizePaymentStatus(status) || status
}

export function resolvePaymentIntentIdFromOrder(order: OrderLike) {
  if (order.stripePaymentIntentId) return order.stripePaymentIntentId
  const metadata = order.metadata
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const record = metadata as Record<string, any>
  if (typeof record.paymentIntentId === 'string' && record.paymentIntentId.trim()) return record.paymentIntentId.trim()
  if (record.stripe && typeof record.stripe === 'object' && typeof record.stripe.paymentIntentId === 'string') {
    return record.stripe.paymentIntentId.trim() || null
  }
  return null
}

export function mergeStripePaymentMetadata(existing: unknown, stripe: StripePaymentRecord): Prisma.InputJsonValue {
  const base = existing && typeof existing === 'object' && !Array.isArray(existing)
    ? { ...(existing as Record<string, unknown>) }
    : {}
  const priorStripe = base.stripe && typeof base.stripe === 'object' && !Array.isArray(base.stripe)
    ? base.stripe as Record<string, unknown>
    : {}
  return {
    ...base,
    stripe: {
      ...priorStripe,
      paymentIntentId: stripe.paymentIntentId,
      paymentStatus: stripe.paymentStatus ?? priorStripe.paymentStatus ?? null,
      chargeId: stripe.chargeId ?? priorStripe.chargeId ?? null,
      receiptUrl: stripe.receiptUrl ?? priorStripe.receiptUrl ?? null,
      customerId: stripe.customerId ?? priorStripe.customerId ?? null,
      refundedCents: stripe.refundedCents ?? priorStripe.refundedCents ?? 0,
      lastEventType: stripe.eventType ?? priorStripe.lastEventType ?? null,
      syncedAt: new Date().toISOString(),
    },
  }
}

export function mergeStripePaymentIntentReference(existing: unknown, paymentIntentId: string): Prisma.InputJsonValue {
  const base = existing && typeof existing === 'object' && !Array.isArray(existing)
    ? { ...(existing as Record<string, unknown>) }
    : {}
  const priorStripe = base.stripe && typeof base.stripe === 'object' && !Array.isArray(base.stripe)
    ? base.stripe as Record<string, unknown>
    : {}
  return {
    ...base,
    paymentIntentId,
    stripe: {
      ...priorStripe,
      paymentIntentId,
    },
  }
}

export function mergeStripeInvoiceMetadata(existing: unknown, stripeInvoice: StripeInvoiceRecord): Prisma.InputJsonValue {
  const base = existing && typeof existing === 'object' && !Array.isArray(existing)
    ? { ...(existing as Record<string, unknown>) }
    : {}
  const priorInvoice = base.stripeInvoice && typeof base.stripeInvoice === 'object' && !Array.isArray(base.stripeInvoice)
    ? base.stripeInvoice as Record<string, unknown>
    : {}
  const priorStripe = base.stripe && typeof base.stripe === 'object' && !Array.isArray(base.stripe)
    ? base.stripe as Record<string, unknown>
    : {}
  return {
    ...base,
    stripe: {
      ...priorStripe,
      customerId: stripeInvoice.customerId ?? priorStripe.customerId ?? null,
      paymentIntentId: stripeInvoice.paymentIntentId ?? priorStripe.paymentIntentId ?? null,
      paymentStatus: stripeInvoice.paymentStatus ?? priorStripe.paymentStatus ?? null,
    },
    stripeInvoice: {
      ...priorInvoice,
      invoiceId: stripeInvoice.invoiceId,
      status: stripeInvoice.invoiceStatus ?? priorInvoice.status ?? null,
      paymentStatus: stripeInvoice.paymentStatus ?? priorInvoice.paymentStatus ?? null,
      hostedInvoiceUrl: stripeInvoice.hostedInvoiceUrl ?? priorInvoice.hostedInvoiceUrl ?? null,
      invoicePdfUrl: stripeInvoice.invoicePdfUrl ?? priorInvoice.invoicePdfUrl ?? null,
      paymentIntentId: stripeInvoice.paymentIntentId ?? priorInvoice.paymentIntentId ?? null,
      lastEventType: stripeInvoice.eventType ?? priorInvoice.lastEventType ?? null,
      syncedAt: new Date().toISOString(),
    },
  }
}

export async function getOrCreateStripeCustomer(params: {
  userId?: string | null
  email?: string | null
  name?: string | null
}) {
  const stripe = getStripe()
  if (params.userId) {
    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { id: true, email: true, name: true, stripeCustomerId: true },
    } as any)
    if (user?.stripeCustomerId) return user.stripeCustomerId
    if (user) {
      const customer = await stripe.customers.create({
        email: params.email || user.email || undefined,
        name: params.name || user.name || undefined,
        metadata: { makerworksUserId: user.id },
      })
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customer.id },
      } as any)
      return customer.id
    }
  }
  if (!params.email && !params.name) return null
  const customer = await stripe.customers.create({
    email: params.email || undefined,
    name: params.name || undefined,
    metadata: params.userId ? { makerworksUserId: params.userId } : undefined,
  })
  return customer.id
}

export async function createMakerWorksPaymentIntent(params: {
  amount: number
  currency: string
  checkoutId: string
  userId?: string | null
  customerEmail?: string | null
  customerName?: string | null
  metadata?: Record<string, string>
}) {
  const stripe = getStripe()
  const customer = await getOrCreateStripeCustomer({
    userId: params.userId,
    email: params.customerEmail,
    name: params.customerName,
  })
  return stripe.paymentIntents.create({
    amount: params.amount,
    currency: params.currency,
    automatic_payment_methods: { enabled: true },
    receipt_email: params.customerEmail || undefined,
    customer: customer || undefined,
    metadata: {
      checkoutId: params.checkoutId,
      ...(params.userId ? { makerworksUserId: params.userId } : {}),
      ...(params.metadata || {}),
    },
  }, {
    idempotencyKey: `makerworks:checkout:${params.checkoutId}`,
  })
}

export function resolveStripeInvoiceDaysUntilDue(raw?: string | null) {
  const parsed = Number(raw ?? process.env.STRIPE_INVOICE_DAYS_UNTIL_DUE ?? '14')
  if (!Number.isFinite(parsed)) return 14
  return Math.max(1, Math.min(365, Math.round(parsed)))
}

export function buildStripeInvoiceItemParams(params: {
  customerId: string
  currency: string
  lineItems: InvoiceLineItem[]
  metadata?: Record<string, string>
}): Stripe.InvoiceItemCreateParams[] {
  return params.lineItems.map((item) => {
    const name = `${item.title}${item.partName ? ` (${item.partName})` : ''} x${item.qty}`
    return {
      customer: params.customerId,
      amount: Math.max(0, Math.round(item.lineTotal * 100)),
      currency: params.currency.toLowerCase(),
      description: name,
      metadata: params.metadata,
    }
  }).filter((item) => item.amount > 0)
}

export function buildStripeInvoiceCreateParams(params: {
  customerId: string
  daysUntilDue: number
  description?: string | null
  metadata?: Record<string, string>
}): Stripe.InvoiceCreateParams {
  return {
    customer: params.customerId,
    collection_method: 'send_invoice',
    days_until_due: resolveStripeInvoiceDaysUntilDue(String(params.daysUntilDue)),
    auto_advance: true,
    description: params.description || undefined,
    metadata: params.metadata,
  }
}

export async function createAndSendStripeInvoice(params: {
  orderId: string
  orderNumber?: number | null
  amountCents: number
  currency: string
  lineItems: InvoiceLineItem[]
  userId?: string | null
  customerEmail?: string | null
  customerName?: string | null
  daysUntilDue?: number | null
}) {
  const stripe = getStripe()
  const customerId = await getOrCreateStripeCustomer({
    userId: params.userId,
    email: params.customerEmail,
    name: params.customerName,
  })
  if (!customerId) {
    throw Object.assign(new Error('Customer email or name is required to create a Stripe invoice'), { status: 400 })
  }
  const metadata = {
    makerworksOrderId: params.orderId,
    ...(params.orderNumber ? { makerworksOrderNumber: String(params.orderNumber) } : {}),
  }
  const invoiceItems = buildStripeInvoiceItemParams({
    customerId,
    currency: params.currency,
    lineItems: params.lineItems,
    metadata,
  })
  if (invoiceItems.length === 0 && params.amountCents > 0) {
    invoiceItems.push({
      customer: customerId,
      amount: params.amountCents,
      currency: params.currency.toLowerCase(),
      description: params.orderNumber ? `MakerWorks order MW-${String(params.orderNumber).padStart(5, '0')}` : 'MakerWorks order',
      metadata,
    })
  }
  for (const item of invoiceItems) {
    await stripe.invoiceItems.create(item)
  }
  const invoice = await stripe.invoices.create(
    buildStripeInvoiceCreateParams({
      customerId,
      daysUntilDue: params.daysUntilDue ?? resolveStripeInvoiceDaysUntilDue(),
      description: params.orderNumber ? `MakerWorks order MW-${String(params.orderNumber).padStart(5, '0')}` : 'MakerWorks order',
      metadata,
    }),
    { idempotencyKey: `makerworks:invoice:${params.orderId}` },
  )
  const sent = await stripe.invoices.sendInvoice(invoice.id)
  return {
    invoice: sent,
    customerId,
    invoiceId: sent.id,
    hostedInvoiceUrl: sent.hosted_invoice_url || null,
    invoicePdfUrl: sent.invoice_pdf || null,
    invoiceStatus: sent.status || null,
  }
}

function chargeFromIntent(intent: Stripe.PaymentIntent) {
  const latest = intent.latest_charge
  if (!latest || typeof latest === 'string') return { chargeId: typeof latest === 'string' ? latest : null, receiptUrl: null, refundedCents: 0 }
  return {
    chargeId: latest.id,
    receiptUrl: latest.receipt_url || null,
    refundedCents: latest.amount_refunded || 0,
  }
}

export async function syncStripePaymentIntent(paymentIntentId: string, eventType?: string | null) {
  const stripe = getStripe()
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ['latest_charge', 'customer'],
  })
  const charge = chargeFromIntent(intent)
  const paymentStatus = normalizeStripePaymentStatus(intent.status)
  const customerId = typeof intent.customer === 'string' ? intent.customer : intent.customer?.id || null
  const record: StripePaymentRecord = {
    paymentIntentId: intent.id,
    paymentStatus,
    chargeId: charge.chargeId,
    receiptUrl: charge.receiptUrl,
    customerId,
    refundedCents: charge.refundedCents,
    eventType,
  }

  await prisma.jobForm.updateMany({
    where: { paymentIntentId: intent.id },
    data: { paymentStatus: paymentStatus || undefined },
  })

  const orders = await prisma.printOrder.findMany({
    where: {
      OR: [
        { stripePaymentIntentId: intent.id } as any,
        { metadata: { path: ['paymentIntentId'], equals: intent.id } },
        { metadata: { path: ['stripe', 'paymentIntentId'], equals: intent.id } },
      ],
    },
    select: { id: true, metadata: true },
  } as any)

  for (const order of orders) {
    await prisma.printOrder.update({
      where: { id: order.id },
      data: {
        stripePaymentIntentId: intent.id,
        stripeChargeId: charge.chargeId || undefined,
        stripeCustomerId: customerId || undefined,
        paymentStatus: paymentStatus || undefined,
        refundedCents: charge.refundedCents,
        receiptUrl: charge.receiptUrl || undefined,
        metadata: mergeStripePaymentMetadata(order.metadata, record),
      },
    } as any)
  }

  return { intent, updatedOrders: orders.length, paymentStatus }
}

export const stripePaymentAdminOps = {
  syncStripePaymentIntent,
}

function invoicePaymentStatus(invoice: Stripe.Invoice) {
  if (invoice.status === 'paid') return 'paid'
  if (invoice.status === 'void') return 'canceled'
  if (invoice.status === 'uncollectible') return 'failed'
  return 'pending'
}

export async function syncStripeInvoice(invoiceId: string, eventType?: string | null) {
  const stripe = getStripe()
  const invoice = await stripe.invoices.retrieve(invoiceId, {
    expand: ['customer', 'payment_intent'],
  } as any)
  const paymentStatus = invoicePaymentStatus(invoice)
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id || null
  const paymentIntentId = typeof (invoice as any).payment_intent === 'string'
    ? (invoice as any).payment_intent
    : (invoice as any).payment_intent?.id || null
  const record: StripeInvoiceRecord = {
    invoiceId: invoice.id,
    invoiceStatus: invoice.status || null,
    paymentStatus,
    customerId,
    hostedInvoiceUrl: invoice.hosted_invoice_url || null,
    invoicePdfUrl: invoice.invoice_pdf || null,
    paymentIntentId,
    eventType,
  }
  const orders = await prisma.printOrder.findMany({
    where: {
      OR: [
        { stripeInvoiceId: invoice.id } as any,
        { metadata: { path: ['stripeInvoice', 'invoiceId'], equals: invoice.id } },
      ],
    },
    select: { id: true, metadata: true, status: true },
  } as any)

  for (const order of orders) {
    await prisma.printOrder.update({
      where: { id: order.id },
      data: {
        stripeInvoiceId: invoice.id,
        stripePaymentIntentId: paymentIntentId || undefined,
        stripeCustomerId: customerId || undefined,
        hostedInvoiceUrl: invoice.hosted_invoice_url || undefined,
        invoicePdfUrl: invoice.invoice_pdf || undefined,
        paymentStatus,
        status: paymentStatus === 'paid' && order.status === 'awaiting_payment' ? 'queued' : undefined,
        metadata: mergeStripeInvoiceMetadata(order.metadata, record),
      } as any,
    })
  }
  return { invoice, updatedOrders: orders.length, paymentStatus }
}

function eventPaymentIntentId(event: Stripe.Event) {
  const object = event.data.object as any
  if (!object) return null
  if (object.object === 'payment_intent') return object.id as string
  if (typeof object.payment_intent === 'string') return object.payment_intent
  if (object.payment_intent?.id) return object.payment_intent.id as string
  return null
}

function eventInvoiceId(event: Stripe.Event) {
  const object = event.data.object as any
  if (!object) return null
  if (object.object === 'invoice') return object.id as string
  if (typeof object.invoice === 'string') return object.invoice
  if (object.invoice?.id) return object.invoice.id as string
  return null
}

export async function handleStripeWebhookEvent(event: Stripe.Event) {
  const paymentIntentId = eventPaymentIntentId(event)
  const invoiceId = eventInvoiceId(event)
  try {
    await prisma.stripeEvent.create({
      data: {
        id: event.id,
        type: event.type,
        paymentIntentId,
        payload: event as unknown as Prisma.InputJsonValue,
      },
    } as any)
  } catch (err: any) {
    if (err?.code === 'P2002') return { duplicate: true, paymentIntentId }
    throw err
  }

  if (paymentIntentId && [
    'payment_intent.succeeded',
    'payment_intent.processing',
    'payment_intent.payment_failed',
    'payment_intent.canceled',
    'charge.refunded',
    'charge.refund.updated',
    'charge.dispute.created',
  ].includes(event.type)) {
    const synced = await syncStripePaymentIntent(paymentIntentId, event.type)
    return { duplicate: false, paymentIntentId, synced }
  }
  if (invoiceId && [
    'invoice.sent',
    'invoice.finalized',
    'invoice.updated',
    'invoice.paid',
    'invoice.payment_failed',
    'invoice.voided',
    'invoice.marked_uncollectible',
  ].includes(event.type)) {
    const synced = await syncStripeInvoice(invoiceId, event.type)
    return { duplicate: false, paymentIntentId, invoiceId, synced }
  }
  return { duplicate: false, paymentIntentId, invoiceId }
}

export async function refundStripeOrder(params: { orderId: string; amountCents?: number | null; reason?: Stripe.RefundCreateParams.Reason }) {
  const order = await prisma.printOrder.findUnique({
    where: { id: params.orderId },
    select: { id: true, totalCents: true, refundedCents: true, stripePaymentIntentId: true, metadata: true },
  } as any)
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 })
  const paymentIntentId = resolvePaymentIntentIdFromOrder(order)
  if (!paymentIntentId) throw Object.assign(new Error('Order does not have a Stripe payment intent'), { status: 400 })
  const remaining = Math.max(0, Number(order.totalCents || 0) - Number(order.refundedCents || 0))
  const amount = params.amountCents == null ? remaining : Math.max(0, Math.min(remaining, params.amountCents))
  if (amount <= 0) throw Object.assign(new Error('No refundable amount remains'), { status: 400 })
  const stripe = getStripe()
  const refund = await stripe.refunds.create({
    payment_intent: paymentIntentId,
    amount,
    reason: params.reason,
    metadata: { makerworksOrderId: order.id },
  }, {
    idempotencyKey: `makerworks:refund:${order.id}:${amount}`,
  })
  await syncStripePaymentIntent(paymentIntentId, 'refund.created')
  return refund
}

export function buildStripeCheckoutSessionParams(params: {
  currency: string
  lineItems: Array<{ name: string; amountCents: number; quantity: number }>
  successUrl: string
  cancelUrl: string
  customerEmail?: string | null
  customerId?: string | null
  collectShipping?: boolean
  automaticTax?: boolean
  metadata?: Record<string, string>
}): Stripe.Checkout.SessionCreateParams {
  return {
    mode: 'payment',
    customer: params.customerId || undefined,
    customer_email: params.customerId ? undefined : params.customerEmail || undefined,
    customer_creation: params.customerId ? undefined : 'always',
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    automatic_tax: { enabled: Boolean(params.automaticTax) },
    shipping_address_collection: params.collectShipping
      ? { allowed_countries: ['US', 'CA'] }
      : undefined,
    line_items: params.lineItems.map((item) => ({
      quantity: item.quantity,
      price_data: {
        currency: params.currency.toLowerCase(),
        unit_amount: item.amountCents,
        product_data: { name: item.name },
        tax_behavior: params.automaticTax ? 'exclusive' : undefined,
      },
    })),
    metadata: params.metadata,
  }
}
