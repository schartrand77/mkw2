export type CheckoutItemInput = {
  modelId: string
  qty: number
  scale: number
  color?: string | null
  infillPct?: number | null
  customText?: string | null
}

import type { Currency } from '@/lib/currency'

export type CheckoutLineItem = {
  modelId: string
  title: string
  qty: number
  scale: number
  unitPrice: number
  lineTotal: number
  color?: string
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
}
