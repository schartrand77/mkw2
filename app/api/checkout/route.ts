import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { estimatePrice } from '@/lib/pricing'
import { getCurrency } from '@/lib/currency'
import { getStripe } from '@/lib/stripe'
import { getUserIdFromCookie } from '@/lib/auth'
import { z } from 'zod'
import type { CheckoutLineItem } from '@/types/checkout'

export const dynamic = 'force-dynamic'

const itemSchema = z.object({
  modelId: z.string().min(1),
  qty: z.number().int().positive().max(50),
  scale: z.number().positive().max(5).default(1),
  color: z.string().max(64).optional().nullable(),
  infillPct: z.number().int().min(0).max(100).optional().nullable(),
  customText: z.string().max(140).optional().nullable(),
})

const payloadSchema = z.object({
  items: z.array(itemSchema).min(1),
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

    const lineItems: CheckoutLineItem[] = items.map((entry) => {
      const model = modelMap.get(entry.modelId)!
      const cm3 = model.volumeMm3 ? model.volumeMm3 / 1000 : null
      const basePrice = model.priceUsd ?? (cm3 != null ? estimatePrice({ cm3, material: model.material, cfg }) : null)
      if (basePrice == null || !isFinite(basePrice)) {
        throw new Error(`Model ${model.id} is missing pricing data`)
      }
      const clampedScale = Math.max(0.1, Math.min(5, entry.scale || 1))
      const unitPrice = Number((basePrice * Math.pow(clampedScale, 3)).toFixed(2))
      const qty = entry.qty || 1
      const lineTotal = Number((unitPrice * qty).toFixed(2))
      return {
        modelId: model.id,
        title: model.title,
        qty,
        scale: clampedScale,
        unitPrice,
        lineTotal,
        color: entry.color || undefined,
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
      },
    })

    return NextResponse.json({
      paymentIntentId: intent.id,
      clientSecret: intent.client_secret,
      currency: currency.toUpperCase(),
      amount,
      total: Number(total.toFixed(2)),
      lineItems,
    })
  } catch (err: any) {
    console.error('Stripe checkout error:', err)
    return NextResponse.json({ error: err.message || 'Checkout failed' }, { status: 500 })
  }
}
