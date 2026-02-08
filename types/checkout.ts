import type { Currency } from '@/lib/currency'
import type { MaterialType } from '@/lib/cartPricing'
import type { DiscountSummary } from '@/lib/discounts'
import type { PricingDetails } from '@/lib/pricing'

export type Dimensions = {
  x?: number | null
  y?: number | null
  z?: number | null
}

export type CheckoutItemInput = {
  modelId: string
  partId?: string | null
  qty: number
  scale: number
  scaleX?: number | null
  scaleY?: number | null
  scaleZ?: number | null
  material: MaterialType
  colors?: string[] | null
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

export type CheckoutPaymentMethod = 'card' | 'cash' | 'invoice' | 'po' | 'quote'

export type CheckoutLineItem = {
  modelId: string
  partId?: string | null
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
  lineItems: CheckoutLineItem[]
  shipping?: ShippingSelection
  shippingRate?: CheckoutShippingRate | null
  paymentMethod: CheckoutPaymentMethod
  committed: boolean
  discount?: DiscountSummary
}
