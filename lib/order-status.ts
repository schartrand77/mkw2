export const ORDER_STATUSES = [
  { key: 'awaiting_review', label: 'Awaiting review' },
  { key: 'awaiting_payment', label: 'Awaiting payment' },
  { key: 'in_production', label: 'In production' },
  { key: 'ready', label: 'Ready for pickup' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]['key']
