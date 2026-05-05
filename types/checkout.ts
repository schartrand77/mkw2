import type { Currency } from '@/lib/currency'
import type { MaterialType } from '@/lib/cartPricing'
import type { DiscountSummary } from '@/lib/discounts'
import type { LeadTimeEstimate } from '@/lib/lead-time-estimator'
import type { PricingDetails } from '@/lib/pricing'

export type Dimensions = {
  x?: number | null
  y?: number | null
  z?: number | null
}

export type CheckoutItemInput = {
  modelId: string
  partId?: string | null
  productTemplateId?: string | null
  qty: number
  scale: number
  scaleX?: number | null
  scaleY?: number | null
  scaleZ?: number | null
  material: MaterialType
  colors?: string[] | null
  toleranceClass?: 'draft' | 'standard' | 'cosmetic' | 'fit_critical' | null
  finish?: string | null
  infillPct?: number | null
  customText?: string | null
  lockDimensions?: boolean | null
  targetDimensions?: Dimensions | null
  priceMultiplier?: number | null
}

export type ShippingAddress = {
  name: string
  line1: string
  line2?: string | null
  city: string
  state?: string | null
  postalCode?: string | null
  country?: string | null
}

export type ShippingSelection = {
  method: 'pickup' | 'ship'
  address?: ShippingAddress | null
}

export type CheckoutPaymentMethod = 'card' | 'paypal' | 'cash' | 'invoice' | 'po' | 'quote'

export type CheckoutLineItem = {
  modelId: string
  partId?: string | null
  productTemplateId?: string | null
  partName?: string | null
  title: string
  qty: number
  scale: number
  scaleX?: number
  scaleY?: number
  scaleZ?: number
  unitPrice: number
  lineTotal: number
  undiscountedLineTotal?: number
  discountPercent?: number
  material: MaterialType
  colors?: string[]
  toleranceClass?: 'draft' | 'standard' | 'cosmetic' | 'fit_critical' | null
  finish?: string
  infillPct?: number
  customText?: string
  targetDimensions?: Dimensions | null
  storagePath?: string | null
  storageUrl?: string | null
  pricingBreakdown?: {
    base: PricingDetails | null
    volumeMultiplier: number
    colorMultiplier: number
    discountMultiplier: number
    priceMultiplier?: number
    rawUnitPrice: number
    unitPrice: number
    batchDiscountPercent?: number
    rush?: boolean
    demandSurgeMultiplier?: number
    rushMultiplier?: number
  } | null
  leadTimeHours?: number | null
  leadTimeWindowHours?: { min: number; max: number } | null
  etaConfidenceScore?: number | null
  leadTimeSignals?: LeadTimeEstimate['signals'] | null
}

export type CheckoutShippingRate = {
  id: string
  label: string
  amount: number
  currency: Currency
}

export type CheckoutIntentResponse = {
  paymentIntentId: string
  clientSecret: string | null
  currency: Currency
  amount: number
  total: number
  estimatedTotal?: number
  lineItems: CheckoutLineItem[]
  shipping?: ShippingSelection
  shippingRate?: CheckoutShippingRate | null
  paymentMethod: CheckoutPaymentMethod
  committed: boolean
  discount?: DiscountSummary
  adminFreeCheckout?: boolean
  stripeInvoice?: {
    invoiceId: string
    customerId: string
    hostedInvoiceUrl: string | null
    invoicePdfUrl: string | null
    invoiceStatus: string | null
  } | null
  stripeInvoiceError?: string | null
}

export type CheckoutOrganization = {
  id: string
  name: string
  role: string
  billingEmail?: string | null
  billingContact?: string | null
  quoteApprovalRequired?: boolean
  requirePoAboveCents?: number | null
  procurementConfig?: {
    departments: Array<{ code: string; name: string; monthlyBudgetCents?: number | null }>
    approvalRouting: Array<{ thresholdCents: number; approverRole: string; label?: string | null }>
  }
}
