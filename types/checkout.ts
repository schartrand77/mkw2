import type { Currency } from '@/lib/currency'
import type { MaterialType } from '@/lib/cartPricing'

export type CheckoutItemInput = {
  modelId: string
  qty: number
  scale: number
  material: MaterialType
  colors?: string[] | null
  infillPct?: number | null
  customText?: string | null
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

export type CheckoutPaymentMethod = 'card' | 'cash'

export type CheckoutLineItem = {
  modelId: string
  title: string
  qty: number
  scale: number
  unitPrice: number
  lineTotal: number
  material: MaterialType
  colors?: string[]
  infillPct?: number
  customText?: string
}

export type CheckoutIntentResponse = {
  paymentIntentId: string
  clientSecret: string | null
  currency: Currency
  amount: number
  total: number
  lineItems: CheckoutLineItem[]
  shipping?: ShippingSelection
  paymentMethod: CheckoutPaymentMethod
  committed: boolean
}
