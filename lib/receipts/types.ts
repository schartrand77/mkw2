export type ReceiptDocumentKind =
  | 'payment_receipt'
  | 'cash_receipt'
  | 'invoice_acknowledgement'
  | 'purchase_order_acknowledgement'
  | 'quote_request'
  | 'complimentary_receipt'
  | 'community_contribution'

export type ReceiptClassificationInput = {
  paymentMethod?: string | null
  paymentStatus?: string | null
  totalCents?: number | null
  refundedCents?: number | null
  contributionType?: string | null
}

export type ReceiptClassification = {
  kind: ReceiptDocumentKind
  title: string
  refunded: boolean
}

function normalize(value?: string | null) {
  return String(value || '').trim().toLowerCase()
}

export function classifyReceiptDocument(input: ReceiptClassificationInput): ReceiptClassification {
  const method = normalize(input.paymentMethod)
  const contributionType = normalize(input.contributionType)
  const totalCents = Math.max(0, Math.round(Number(input.totalCents || 0)))
  const refunded = Math.max(0, Math.round(Number(input.refundedCents || 0))) > 0

  if (contributionType === 'donated' || contributionType === 'discounted') {
    return { kind: 'community_contribution', title: 'Community Contribution Receipt', refunded }
  }
  if (totalCents === 0) {
    return { kind: 'complimentary_receipt', title: 'Complimentary Order Receipt', refunded }
  }
  if (method === 'cash') return { kind: 'cash_receipt', title: 'Cash Pickup Receipt', refunded }
  if (method === 'invoice') return { kind: 'invoice_acknowledgement', title: 'Invoice Acknowledgement', refunded }
  if (method === 'po') return { kind: 'purchase_order_acknowledgement', title: 'Purchase Order Acknowledgement', refunded }
  if (method === 'quote') return { kind: 'quote_request', title: 'Quote Request', refunded }
  return { kind: 'payment_receipt', title: 'Payment Receipt', refunded }
}

export type ReceiptLine = {
  label: string
  value: string
}

export type ReceiptItemLine = {
  title: string
  detail: string
  quantity: number
  unitPriceCents: number
  totalCents: number
}

export type ReceiptViewModel = {
  orderId: string
  orderNumber: string
  title: string
  kind: ReceiptDocumentKind
  generatedAt: string
  issuedAt: string
  customerName: string
  customerEmail: string
  organizationName: string | null
  currency: string
  subtotalCents: number
  discountPercent: number | null
  totalCents: number
  refundedCents: number
  netPaidCents: number
  paymentMethod: string
  paymentStatus: string
  processorReference: string | null
  purchaseOrderNumber: string | null
  billingEmail: string | null
  billingContact: string | null
  contributionType: string
  donatedAmountCents: number
  materialCostCents: number
  machineTimeMinutes: number | null
  contributionNotes: string | null
  shippingSummary: string
  items: ReceiptItemLine[]
  notes: ReceiptLine[]
}
