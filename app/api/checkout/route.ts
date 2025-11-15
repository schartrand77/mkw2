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
})

export async function POST(req: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Stripe is not configured' }, { status: 500 })
    }

    const json = await req.json()
    const parsed = payloadSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid cart payload' }, { status: 400 })
    }

    const items = parsed.data.items
    const shipping = parsed.data.shipping as ShippingSelection | undefined
    if (shipping?.method === 'ship') {
      const addr = shipping.address as ShippingSelection['address']
      if (!addr || !addr.name || !addr.line1 || !addr.city || !addr.postalCode || !addr.country) {
        return NextResponse.json({ error: 'Shipping address is incomplete' }, { status: 400 })
      }
    }
    const ids = Array.from(new Set(items.map(i => i.modelId)))
    const [models, cfg] = await Promise.all([
      prisma.model.findMany({
        where: { id: { in: ids } },
        select: { id: true, title: true, priceUsd: true, volumeMm3: true, material: true },
      }),
      prisma.siteConfig.findUnique({ where: { id: 'main' } }),
    ])
    const modelMap = new Map(models.map(m => [m.id, m]))
    if (modelMap.size !== ids.length) {
      return NextResponse.json({ error: 'One or more models are unavailable' }, { status: 404 })
    }
    const fallbackPrice = (() => {
      if (cfg?.minimumPriceUsd != null && !Number.isNaN(Number(cfg.minimumPriceUsd))) {
        return Math.max(1, Number(cfg.minimumPriceUsd))
      }
      const fromEnv = getCurrency() === 'CAD'
        ? parseFloat(process.env.MINIMUM_PRICE_CAD || process.env.MINIMUM_PRICE_USD || '1')
        : parseFloat(process.env.MINIMUM_PRICE_USD || '1')
      return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 1
    })()

    const lineItems: CheckoutLineItem[] = items.map((entry) => {
      const model = modelMap.get(entry.modelId)!
      const cm3 = model.volumeMm3 ? model.volumeMm3 / 1000 : null
      const materialChoice: MaterialType = entry.material || (model.material?.toUpperCase() === 'PETG' ? 'PETG' : 'PLA')
      const colors = normalizeColors(entry.colors)
      const basePrice = (cm3 != null ? estimatePrice({ cm3, material: materialChoice, cfg }) : null) ?? model.priceUsd ?? fallbackPrice
      if (!isFinite(basePrice) || basePrice <= 0) {
        throw new Error(`Model ${model.id} is missing pricing data`)
      }
      const clampedScale = clampScale(entry.scale)
      const colorMultiplier = getColorMultiplier(colors)
      const unitPrice = Number((basePrice * Math.pow(clampedScale, 3) * colorMultiplier).toFixed(2))
      const qty = entry.qty || 1
      const lineTotal = Number((unitPrice * qty).toFixed(2))
      return {
        modelId: model.id,
        title: model.title,
        qty,
        scale: clampedScale,
        unitPrice,
        lineTotal,
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

    const stripe = getStripe()
    const metadataItems = lineItems.slice(0, 20).map((item) => `${item.qty}x ${item.title}`).join(', ')
    const userId = await getUserIdFromCookie()
    const customerEmail = userId
      ? (await prisma.user.findUnique({ where: { id: userId }, select: { email: true } }))?.email
      : undefined

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

    try {
      await recordOrderWorksJob({
        paymentIntentId: intent.id,
        amountCents: amount,
        currency: currency.toUpperCase(),
        lineItems,
        shipping: shipping || { method: 'pickup' },
        userId,
        customerEmail,
        metadata: {
          cartItems: items,
          shipping,
        },
      })
    } catch (jobErr) {
      console.error('Failed to record OrderWorks job', jobErr)
    }

    return NextResponse.json({
      paymentIntentId: intent.id,
      clientSecret: intent.client_secret,
      currency: currency.toUpperCase(),
      amount,
      total: Number(total.toFixed(2)),
      lineItems,
      shipping: shipping || { method: 'pickup' },
    })
  } catch (err: any) {
    console.error('Stripe checkout error:', err)
    return NextResponse.json({ error: err.message || 'Checkout failed' }, { status: 500 })
  }
}
