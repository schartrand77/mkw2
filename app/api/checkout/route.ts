import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { estimatePrice } from '@/lib/pricing'
import { getCurrency } from '@/lib/currency'
import { getStripe } from '@/lib/stripe'
import { getUserIdFromCookie } from '@/lib/auth'
import { z } from 'zod'
import type { CheckoutLineItem, ShippingSelection } from '@/types/checkout'
import { clampScale, getColorMultiplier, normalizeColors, type MaterialType, MAX_CART_COLORS } from '@/lib/cartPricing'
import { recordOrderWorksJob } from '@/lib/orderworks'
import { summarizeDiscount, getDiscountMultiplier } from '@/lib/discounts'

export const dynamic = 'force-dynamic'

const shippingSchema = z.object({
  method: z.enum(['pickup', 'ship']),
  address: z.object({
    name: z.string().max(120).optional(),
    line1: z.string().max(200).optional(),
    line2: z.string().max(200).optional(),
    city: z.string().max(120).optional(),
    state: z.string().max(120).optional(),
    postalCode: z.string().max(40).optional(),
    country: z.string().max(120).optional(),
  }).optional(),
}).optional()

const itemSchema = z.object({
  modelId: z.string().min(1),
  partId: z.string().min(1).optional(),
  qty: z.number().int().positive().max(50),
  scale: z.number().positive().max(5).default(1),
  material: z.enum(['PLA', 'PETG']).optional().default('PLA'),
  colors: z.array(z.string().max(64)).max(MAX_CART_COLORS).optional(),
  infillPct: z.number().int().min(0).max(100).optional().nullable(),
  customText: z.string().max(140).optional().nullable(),
})

const payloadSchema = z.object({
  items: z.array(itemSchema).min(1),
  shipping: shippingSchema,
  paymentMethod: z.enum(['card', 'cash']).default('card'),
  commit: z.boolean().optional(),
  paymentIntentId: z.string().max(200).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const json = await req.json()
    const parsed = payloadSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid cart payload' }, { status: 400 })
    }

    const paymentMethod = parsed.data.paymentMethod || 'card'
    const commit = Boolean(parsed.data.commit)
    const isCash = paymentMethod === 'cash'
    const providedPaymentIntentId = (parsed.data.paymentIntentId || '').trim()

    if (paymentMethod !== 'cash' && !process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Stripe is not configured' }, { status: 500 })
    }

    const items = parsed.data.items
    const shipping = parsed.data.shipping as ShippingSelection | undefined
    if (isCash && shipping && shipping.method !== 'pickup') {
      return NextResponse.json({ error: 'Cash payments are only available for local pickup' }, { status: 400 })
    }
    if (shipping?.method === 'ship') {
      const addr = shipping.address as ShippingSelection['address']
      if (!addr || !addr.name || !addr.line1 || !addr.city || !addr.postalCode || !addr.country) {
        return NextResponse.json({ error: 'Shipping address is incomplete' }, { status: 400 })
      }
    }
    const ids = Array.from(new Set(items.map(i => i.modelId)))
    const partIds = Array.from(new Set(items.map(i => i.partId).filter((id): id is string => typeof id === 'string' && id.length > 0)))
    const [models, cfg, parts] = await Promise.all([
      prisma.model.findMany({
        where: { id: { in: ids } },
        select: { id: true, title: true, priceUsd: true, salePriceUsd: true, volumeMm3: true, material: true },
      }),
      prisma.siteConfig.findUnique({ where: { id: 'main' } }),
      partIds.length > 0
        ? prisma.modelPart.findMany({
            where: { id: { in: partIds } },
            select: { id: true, modelId: true, name: true, priceUsd: true, volumeMm3: true },
          })
        : Promise.resolve([]),
    ])
    const modelMap = new Map(models.map(m => [m.id, m]))
    if (modelMap.size !== ids.length) {
      return NextResponse.json({ error: 'One or more models are unavailable' }, { status: 404 })
    }
    const partMap = new Map(parts.map((p) => [p.id, p]))
    const fallbackPrice = (() => {
      if (cfg?.minimumPriceUsd != null && !Number.isNaN(Number(cfg.minimumPriceUsd))) {
        return Math.max(1, Number(cfg.minimumPriceUsd))
      }
      const fromEnv = getCurrency() === 'CAD'
        ? parseFloat(process.env.MINIMUM_PRICE_CAD || process.env.MINIMUM_PRICE_USD || '1')
        : parseFloat(process.env.MINIMUM_PRICE_USD || '1')
      return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 1
    })()

    const userId = await getUserIdFromCookie()
    const userForCheckout = userId
      ? await prisma.user.findUnique({
        where: { id: userId },
        select: {
          email: true,
          discountPercent: true,
          friendsAndFamilyPercent: true,
          isFriendsAndFamily: true,
        },
      })
      : null
    const discountSummary = summarizeDiscount(userForCheckout)
    const discountMultiplier = getDiscountMultiplier(discountSummary)

    const lineItems: CheckoutLineItem[] = items.map((entry) => {
      const model = modelMap.get(entry.modelId)!
      const cm3 = model.volumeMm3 ? model.volumeMm3 / 1000 : null
      const materialChoice: MaterialType = entry.material || (model.material?.toUpperCase() === 'PETG' ? 'PETG' : 'PLA')
      const colors = normalizeColors(entry.colors)
      const part = entry.partId ? partMap.get(entry.partId) || null : null
      if (entry.partId && (!part || part.modelId !== model.id)) {
        throw new Error('Invalid part specified for model')
      }
      const basePrice = (() => {
        if (part) {
          if (part.priceUsd != null && Number.isFinite(Number(part.priceUsd))) {
            return Number(part.priceUsd)
          }
          if (part.volumeMm3 != null && Number.isFinite(Number(part.volumeMm3))) {
            return estimatePrice({ cm3: Number(part.volumeMm3) / 1000, material: materialChoice, cfg })
          }
          throw new Error(`Part ${part.id} is missing pricing data`)
        }
        if (model.salePriceUsd != null && Number.isFinite(Number(model.salePriceUsd)) && Number(model.salePriceUsd) > 0) {
          return Number(model.salePriceUsd)
        }
        if (cm3 != null) {
          return estimatePrice({ cm3, material: materialChoice, cfg })
        }
        return model.priceUsd ?? fallbackPrice
      })()
      if (!isFinite(basePrice) || basePrice <= 0) {
        throw new Error(`Model ${model.id} is missing pricing data`)
      }
      const clampedScale = clampScale(entry.scale)
      const colorMultiplier = getColorMultiplier(colors)
      const rawUnitPrice = Number((basePrice * Math.pow(clampedScale, 3) * colorMultiplier).toFixed(2))
      const unitPrice = Number((rawUnitPrice * discountMultiplier).toFixed(2))
      const qty = entry.qty || 1
      const undiscountedLineTotal = Number((rawUnitPrice * qty).toFixed(2))
      const lineTotal = Number((unitPrice * qty).toFixed(2))
      return {
        modelId: model.id,
        partId: part?.id || undefined,
        partName: part?.name || undefined,
        title: model.title,
        qty,
        scale: clampedScale,
        unitPrice,
        lineTotal,
        undiscountedLineTotal,
        discountPercent: discountSummary.totalPercent || undefined,
        material: materialChoice,
        colors,
        infillPct: entry.infillPct ?? undefined,
        customText: entry.customText || undefined,
      }
    })

    const total = lineItems.reduce((sum, item) => sum + item.lineTotal, 0)
    if (!isFinite(total) || total <= 0) {
      return NextResponse.json({ error: 'Cart total must be greater than zero' }, { status: 400 })
    }
    const amount = Math.max(1, Math.round(total * 100))
    const currency = getCurrency().toLowerCase()

    const shippingPayload: ShippingSelection = shipping || { method: 'pickup' }
    const metadataItems = lineItems.slice(0, 20).map((item) => `${item.qty}x ${item.title}${item.partName ? ` (${item.partName})` : ''}`).join(', ')
    const customerEmail = userForCheckout?.email || undefined
    const currencyCode = currency.toUpperCase()

    let paymentIntentId: string | null = providedPaymentIntentId || null
    let clientSecret: string | null = null

    if (paymentMethod === 'card') {
      if (!commit) {
        const stripe = getStripe()
        const intent = await stripe.paymentIntents.create({
          amount,
          currency,
          automatic_payment_methods: { enabled: true },
          receipt_email: customerEmail || undefined,
          metadata: {
            cart: metadataItems.slice(0, 500),
            userId: userId || '',
            shippingMethod: shipping?.method || 'pickup',
            shippingAddress: shipping?.method === 'ship' && shipping.address
              ? `${shipping.address.name || ''} | ${shipping.address.line1 || ''} ${shipping.address.line2 || ''}, ${shipping.address.city || ''}, ${shipping.address.state || ''} ${shipping.address.postalCode || ''}, ${shipping.address.country || ''}`
              : '',
          },
        })
        paymentIntentId = intent.id
        clientSecret = intent.client_secret
      } else {
        if (!paymentIntentId) {
          return NextResponse.json({ error: 'paymentIntentId is required to finalize checkout.' }, { status: 400 })
        }
        const stripe = getStripe()
        const intent = await stripe.paymentIntents.retrieve(paymentIntentId)
        if (!intent) {
          return NextResponse.json({ error: 'Payment intent not found.' }, { status: 404 })
        }
        const allowedStatuses = new Set(['succeeded', 'processing', 'requires_capture'])
        if (!allowedStatuses.has(intent.status)) {
          return NextResponse.json({ error: `Payment not completed (${intent.status}).` }, { status: 400 })
        }
        clientSecret = intent.client_secret || null
      }
    } else if (!commit) {
      paymentIntentId = `cash_preview_${randomUUID()}`
    } else {
      paymentIntentId = paymentIntentId || `cash_${randomUUID()}`
    }

    if (commit) {
      try {
        await recordOrderWorksJob({
          paymentIntentId: paymentIntentId!,
          amountCents: amount,
          currency: currencyCode,
          lineItems,
          shipping: shippingPayload,
          userId,
          customerEmail,
          metadata: {
            cartItems: items,
            shipping,
            paymentMethod,
          },
        })
      } catch (jobErr) {
        console.error('Failed to record OrderWorks job', jobErr)
      }
    }

    return NextResponse.json({
      paymentIntentId: paymentIntentId!,
      clientSecret,
      currency: currencyCode,
      amount,
      total: Number(total.toFixed(2)),
      lineItems,
      shipping: shippingPayload,
      paymentMethod,
      committed: commit,
      discount: discountSummary,
    })
  } catch (err: any) {
    console.error('Stripe checkout error:', err)
    return NextResponse.json({ error: err.message || 'Checkout failed' }, { status: 500 })
  }
}
