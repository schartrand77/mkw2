import type { CheckoutPaymentMethod } from '@/types/checkout'
import type { FulfillmentStatus } from '@prisma/client'

export type OrderWorksJobStatus = 'pending' | 'sent'

export const ORDERWORKS_JOB_STATUS_OPTIONS: Array<{ value: OrderWorksJobStatus; label: string }> = [
  { value: 'pending', label: 'Pending' },
  { value: 'sent', label: 'Sent' },
]

export const FULFILLMENT_STATUS_OPTIONS: Array<{ value: FulfillmentStatus; label: string }> = [
  { value: 'pending', label: 'Pending' },
  { value: 'ready', label: 'Ready for pickup' },
  { value: 'picked_up', label: 'Picked up' },
  { value: 'shipped', label: 'Shipped' },
]

export const PAYMENT_METHOD_OPTIONS: Array<{ value: CheckoutPaymentMethod; label: string }> = [
  { value: 'card', label: 'Card' },
  { value: 'cash', label: 'Cash' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'po', label: 'Purchase order' },
  { value: 'quote', label: 'Quote request' },
]

export const PAYMENT_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'requires_capture', label: 'Authorized (capture required)' },
  { value: 'paid', label: 'Paid' },
  { value: 'quote', label: 'Quote requested' },
  { value: 'free', label: 'No payment required' },
  { value: 'failed', label: 'Failed' },
  { value: 'canceled', label: 'Canceled' },
  { value: 'refunded', label: 'Refunded' },
]

const PAYMENT_METHOD_LABELS = new Map(PAYMENT_METHOD_OPTIONS.map((entry) => [entry.value, entry.label]))
const PAYMENT_STATUS_LABELS = new Map(PAYMENT_STATUS_OPTIONS.map((entry) => [entry.value, entry.label]))

export function normalizePaymentMethod(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  const normalized = value.trim().toLowerCase()
  if (!normalized) return null
  if (normalized === 'purchase_order' || normalized === 'purchase order' || normalized === 'p.o.' || normalized === 'p/o') return 'po'
  if (normalized === 'credit_card' || normalized === 'credit card' || normalized === 'stripe') return 'card'
  if (normalized === 'quotation' || normalized === 'rfq') return 'quote'
  return normalized
}

export function normalizePaymentStatus(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  const normalized = value.trim().toLowerCase()
  if (!normalized) return null
  if (normalized === 'success' || normalized === 'succeeded') return 'paid'
  if (normalized === 'cancelled') return 'canceled'
  if (normalized === 'authorized') return 'requires_capture'
  return normalized
}

export function formatPaymentMethod(value?: string | null) {
  if (!value) return 'N/A'
  return PAYMENT_METHOD_LABELS.get(value as CheckoutPaymentMethod) || value
}

export function formatPaymentStatus(value?: string | null) {
  if (!value) return 'N/A'
  return PAYMENT_STATUS_LABELS.get(value) || value
}

export function isPaidPaymentStatus(paymentStatus?: string | null) {
  const normalized = normalizePaymentStatus(paymentStatus)
  if (!normalized) return false
  return normalized === 'paid'
    || normalized === 'free'
    || normalized === 'processing'
    || normalized === 'requires_capture'
}

export function isPaymentPromise(paymentMethod?: string | null, paymentStatus?: string | null) {
  const method = normalizePaymentMethod(paymentMethod)
  const status = normalizePaymentStatus(paymentStatus)
  return method === 'cash' || status === 'pending'
}
