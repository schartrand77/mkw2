import type { ReceiptItemLine, ReceiptLine, ReceiptViewModel } from './types'
import { classifyReceiptDocument } from './types'

type JsonRecord = Record<string, unknown>

function readRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function cents(value: unknown) {
  return Math.max(0, Math.round(Number(value || 0)))
}

function formatOrderNumber(value?: number | null) {
  return value && value > 0 ? `MW-${String(value).padStart(5, '0')}` : 'Order reference pending'
}

function normalizeCurrency(value?: string | null) {
  return String(value || 'USD').trim().toUpperCase()
}

function summarizeAddress(method?: string | null, raw?: unknown) {
  if (method !== 'ship') return 'Pickup'
  const address = readRecord(raw)
  if (!address) return 'Shipping address on file'
  return [
    readString(address.name),
    readString(address.line1),
    readString(address.line2),
    [readString(address.city), readString(address.state), readString(address.postalCode)].filter(Boolean).join(' '),
    readString(address.country),
  ].filter(Boolean).join(', ')
}

function buildItemDetail(item: any) {
  const colors = Array.isArray(item.colors)
    ? item.colors.filter((color: unknown): color is string => typeof color === 'string' && color.trim().length > 0).join(', ')
    : ''
  return [
    readString(item.partName),
    readString(item.material),
    colors || null,
    typeof item.infillPct === 'number' ? `Infill ${item.infillPct}%` : null,
    readString(item.finish) && readString(item.finish) !== 'standard' ? readString(item.finish) : null,
  ].filter(Boolean).join(' | ')
}

function buildNotes(args: { order: any; metadata: JsonRecord | null; contributionType: string }): ReceiptLine[] {
  const notes: ReceiptLine[] = []
  const stripe = readRecord(args.metadata?.stripe)
  const stripeInvoice = readRecord(args.metadata?.stripeInvoice)
  const paypal = readRecord(args.metadata?.paypal)
  const paymentIntentId = readString(args.order.stripePaymentIntentId)
    || readString(args.metadata?.paymentIntentId)
    || readString(stripe?.paymentIntentId)
  const chargeId = readString(args.order.stripeChargeId) || readString(stripe?.chargeId)
  const invoiceId = readString(args.order.stripeInvoiceId) || readString(stripeInvoice?.invoiceId)
  const paypalOrderId = readString(paypal?.orderId)
    || (String(args.order.paymentMethod || '').toLowerCase() === 'paypal' ? readString(args.metadata?.paymentIntentId) : null)

  if (paymentIntentId) notes.push({ label: 'Payment reference', value: paymentIntentId })
  if (chargeId) notes.push({ label: 'Card charge reference', value: chargeId })
  if (invoiceId) notes.push({ label: 'Invoice number', value: invoiceId })
  if (paypalOrderId) notes.push({ label: 'PayPal order reference', value: paypalOrderId })
  if (args.contributionType === 'donated' || args.contributionType === 'discounted') {
    notes.push({
      label: 'Contribution note',
      value: 'This document summarizes MakerWorks contributed production value. It is not a tax receipt unless separately issued by an authorized charity.',
    })
  }
  if (readString(args.order.notes)) notes.push({ label: 'Order notes', value: readString(args.order.notes)! })
  return notes
}

export function buildOrderReceiptModel(args: { order: any; generatedAt?: Date }): ReceiptViewModel {
  const order = args.order
  const metadata = readRecord(order.metadata)
  const paymentDetails = readRecord(metadata?.paymentDetails)
  const contributionType = String(order.contributionType || 'paid').toLowerCase()
  const classification = classifyReceiptDocument({
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    totalCents: order.totalCents,
    refundedCents: order.refundedCents,
    contributionType,
  })
  const items: ReceiptItemLine[] = Array.isArray(order.items)
    ? order.items.map((item: any) => ({
      title: readString(item.modelTitle) || 'Custom item',
      detail: buildItemDetail(item),
      quantity: Math.max(1, Math.round(Number(item.quantity || 1))),
      unitPriceCents: cents(item.unitPriceCents),
      totalCents: cents(item.totalCents),
    }))
    : []

  return {
    orderId: String(order.id || ''),
    orderNumber: formatOrderNumber(order.orderNumber),
    title: classification.title,
    kind: classification.kind,
    generatedAt: (args.generatedAt || new Date()).toISOString(),
    issuedAt: (order.createdAt || new Date()).toISOString(),
    customerName: readString(order.customerName) || 'Customer',
    customerEmail: readString(order.customerEmail) || '',
    organizationName: readString(order.organization?.name),
    currency: normalizeCurrency(order.currency),
    subtotalCents: cents(order.subtotalCents),
    discountPercent: typeof order.discountPercent === 'number' ? order.discountPercent : null,
    totalCents: cents(order.totalCents),
    refundedCents: cents(order.refundedCents),
    netPaidCents: Math.max(0, cents(order.totalCents) - cents(order.refundedCents)),
    paymentMethod: String(order.paymentMethod || 'card'),
    paymentStatus: String(order.paymentStatus || 'pending'),
    processorReference: readString(order.stripePaymentIntentId) || readString(metadata?.paymentIntentId),
    purchaseOrderNumber: readString(paymentDetails?.purchaseOrderNumber),
    billingEmail: readString(paymentDetails?.billingEmail),
    billingContact: readString(paymentDetails?.billingContact),
    contributionType,
    donatedAmountCents: cents(order.donatedAmountCents),
    materialCostCents: cents(order.materialCostCents),
    machineTimeMinutes: typeof order.machineTimeMinutes === 'number' ? order.machineTimeMinutes : null,
    contributionNotes: readString(order.contributionNotes),
    shippingSummary: summarizeAddress(order.shippingMethod, order.shippingAddress),
    items,
    notes: buildNotes({ order, metadata, contributionType }),
  }
}
