export const ORDER_STATUS_FLOW = [
  { key: 'queued', label: 'Queued' },
  { key: 'printing', label: 'Printing' },
  { key: 'post_process', label: 'Post-process' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
] as const

export const LEGACY_ORDER_STATUSES = [
  { key: 'awaiting_review', label: 'Queued (legacy)' },
  { key: 'awaiting_payment', label: 'Payment pending (legacy)' },
  { key: 'in_production', label: 'Printing (legacy)' },
  { key: 'ready', label: 'Post-process (legacy)' },
] as const

export const ORDER_STATUSES = [
  ...ORDER_STATUS_FLOW,
  ...LEGACY_ORDER_STATUSES,
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]['key']

export function normalizeOrderStatus(status: string): (typeof ORDER_STATUS_FLOW)[number]['key'] {
  if (status === 'awaiting_review' || status === 'awaiting_payment') return 'queued'
  if (status === 'in_production') return 'printing'
  if (status === 'ready') return 'post_process'
  if (status === 'printing' || status === 'post_process' || status === 'queued' || status === 'shipped' || status === 'completed' || status === 'cancelled') {
    return status
  }
  return 'queued'
}
