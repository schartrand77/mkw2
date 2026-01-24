import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { estimatePricingDetails, type PricingDetails } from '@/lib/pricing'
import { formatCurrency, getCurrency, type Currency } from '@/lib/currency'
import { getStripe } from '@/lib/stripe'
import { getUserIdFromCookie } from '@/lib/auth'
import { z } from 'zod'
import type { CheckoutLineItem, ShippingSelection } from '@/types/checkout'
import { getColorMultiplier, normalizeColors, normalizeMaterialName, resolveScaleFromDimensions, type MaterialType, MAX_CART_COLORS } from '@/lib/cartPricing'
import { recordOrderWorksJob } from '@/lib/orderworks'
import { summarizeDiscount, getDiscountMultiplier } from '@/lib/discounts'
import { recordCustomerOrder } from '@/lib/orders'
import { sendAdminDiscordNotification } from '@/lib/discord'
import { sendAdminPushNotification } from '@/lib/push'

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

const dimensionSchema = z.object({
  x: z.number().positive().max(5000).optional(),
  y: z.number().positive().max(5000).optional(),
  z: z.number().positive().max(5000).optional(),
}).partial()

const itemSchema = z.object({
  modelId: z.string().min(1),
  partId: z.string().min(1).optional(),
  qty: z.number().int().positive().max(50),
  scale: z.number().positive().max(5).default(1),
  scaleX: z.number().positive().max(5).optional(),
  scaleY: z.number().positive().max(5).optional(),
  scaleZ: z.number().positive().max(5).optional(),
  lockDimensions: z.boolean().optional(),
  targetDimensions: dimensionSchema.optional(),
  material: z.string().max(40).optional().default('PLA'),
  colors: z.array(z.string().max(64)).max(MAX_CART_COLORS).optional(),
  finish: z.string().max(40).optional(),
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

function sanitizeBaseUrl(raw?: string | null) {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    url.hash = ''
    url.search = ''
    const base = `${url.origin}${url.pathname}`.replace(/\/+$/, '')
    return base || null
  } catch {
    const cleaned = trimmed.replace(/\/+$/, '')
    return cleaned || null
  }
}

function resolvePublicBaseUrl(req: NextRequest) {
  return sanitizeBaseUrl(process.env.BASE_URL) || sanitizeBaseUrl(req.nextUrl?.origin || '')
}

function normalizeStoragePath(pathValue?: string | null) {
  if (!pathValue) return null
  const trimmed = String(pathValue).trim()
  if (!trimmed) return null
  return `/${trimmed.replace(/^\/+/, '')}`
}

function normalizePaymentStatusForQueue(paymentMethod: string, status: string | null) {
  if (!status) return status
  if (paymentMethod === 'card' && status === 'succeeded') return 'paid'
  return status
}

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

    const items = parsed.data.items
    const shipping = parsed.data.shipping as ShippingSelection | undefined
    if (isCash && shipping && shipping.method !== 'pickup') {
      return NextResponse.json({ error: 'Cash payments are only available for local pickup' }, { status: 400 })
    }
    for (const entry of items) {
      if (normalizeColors(entry.colors).length === 0) {
        return NextResponse.json({ error: 'Select at least one filament color for each item.' }, { status: 400 })
      }
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
        where: { id: { in: ids }, visibility: 'public' },
        select: {
          id: true,
          title: true,
          priceUsd: true,
          salePriceUsd: true,
          volumeMm3: true,
          material: true,
          sizeXmm: true,
          sizeYmm: true,
          sizeZmm: true,
          supportRatio: true,
          filePath: true,
          viewerFilePath: true,
          _count: { select: { parts: true } },
        },
      }),
      prisma.siteConfig.findUnique({ where: { id: 'main' } }),
      partIds.length > 0
        ? prisma.modelPart.findMany({
            where: { id: { in: partIds }, model: { visibility: 'public' } },
            select: {
              id: true,
              modelId: true,
              name: true,
              priceUsd: true,
              volumeMm3: true,
              supportRatio: true,
              filePath: true,
              previewFilePath: true,
            },
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
          name: true,
          email: true,
          discountPercent: true,
          friendsAndFamilyPercent: true,
          isFriendsAndFamily: true,
        },
      })
      : null
    const discountSummary = summarizeDiscount(userForCheckout)
    const discountMultiplier = getDiscountMultiplier(discountSummary)

    const publicBaseUrl = resolvePublicBaseUrl(req)
    const checkoutId = randomUUID()

    const lineItems: CheckoutLineItem[] = items.map((entry) => {
      const model = modelMap.get(entry.modelId)!
      const cm3 = model.volumeMm3 ? model.volumeMm3 / 1000 : null
      const materialChoice: MaterialType = normalizeMaterialName(entry.material || model.material || 'PLA')
      const colors = normalizeColors(entry.colors)
      const finishChoice = entry.finish ? String(entry.finish) : null
      const part = entry.partId ? partMap.get(entry.partId) || null : null
      const isMultipart = (model._count?.parts || 0) > 1
      if (entry.partId && (!part || part.modelId !== model.id)) {
        throw new Error('Invalid part specified for model')
      }
      let pricingDetails: PricingDetails | null = null
      const basePrice = (() => {
        if (part) {
          if (isMultipart && model.volumeMm3 != null && Number.isFinite(Number(model.volumeMm3)) && part.volumeMm3 != null && Number.isFinite(Number(part.volumeMm3)) && Number(model.volumeMm3) > 0) {
            const totalPricing = estimatePricingDetails({
              cm3: Number(model.volumeMm3) / 1000,
              material: materialChoice,
              infillPct: entry.infillPct ?? null,
              finish: finishChoice,
              supportRatio: model.supportRatio ?? null,
              colorCount: colors.length,
              cfg,
              applyMinimum: true,
            })
            pricingDetails = totalPricing
            return Number(((totalPricing.price * Number(part.volumeMm3)) / Number(model.volumeMm3)).toFixed(2))
          }
          if (part.priceUsd != null && Number.isFinite(Number(part.priceUsd))) {
            return Number(part.priceUsd)
          }
          if (part.volumeMm3 != null && Number.isFinite(Number(part.volumeMm3))) {
            pricingDetails = estimatePricingDetails({
              cm3: Number(part.volumeMm3) / 1000,
              material: materialChoice,
              infillPct: entry.infillPct ?? null,
              finish: finishChoice,
              supportRatio: part.supportRatio ?? null,
              colorCount: colors.length,
              cfg,
            })
            return pricingDetails.price
          }
          throw new Error(`Part ${part.id} is missing pricing data`)
        }
        if (model.salePriceUsd != null && Number.isFinite(Number(model.salePriceUsd)) && Number(model.salePriceUsd) > 0) {
          return Number(model.salePriceUsd)
        }
        if (cm3 != null) {
          pricingDetails = estimatePricingDetails({
            cm3,
            material: materialChoice,
            infillPct: entry.infillPct ?? null,
            finish: finishChoice,
            supportRatio: model.supportRatio ?? null,
            colorCount: colors.length,
            cfg,
          })
          return pricingDetails.price
        }
        if (model.priceUsd != null && Number.isFinite(Number(model.priceUsd))) {
          return Number(model.priceUsd)
        }
        throw new Error(`Model ${model.id} is missing pricing data`)
      })()
      if (!isFinite(basePrice) || basePrice <= 0) {
        throw new Error(`Model ${model.id} is missing pricing data`)
      }
      const { scaleX, scaleY, scaleZ, uniformScale } = resolveScaleFromDimensions({
        size: { x: model.sizeXmm ?? null, y: model.sizeYmm ?? null, z: model.sizeZmm ?? null },
        target: entry.targetDimensions ?? null,
        scale: entry.scale ?? 1,
        scaleX: entry.scaleX ?? null,
        scaleY: entry.scaleY ?? null,
        scaleZ: entry.scaleZ ?? null,
        lockDimensions: entry.lockDimensions ?? null,
      })
      const volumeMultiplier = scaleX * scaleY * scaleZ
      const colorMultiplier = getColorMultiplier(colors)
      const rawUnitPrice = Number((basePrice * volumeMultiplier * colorMultiplier).toFixed(2))
      const unitPrice = Number((rawUnitPrice * discountMultiplier).toFixed(2))
      const qty = entry.qty || 1
      const undiscountedLineTotal = Number((rawUnitPrice * qty).toFixed(2))
      const lineTotal = Number((unitPrice * qty).toFixed(2))
      const storagePath = normalizeStoragePath(
        part?.filePath ||
          model.filePath ||
          part?.previewFilePath ||
          model.viewerFilePath ||
          null,
      )
      const storageUrl = storagePath && publicBaseUrl ? `${publicBaseUrl}/files${storagePath}` : null
      return {
        modelId: model.id,
        partId: part?.id || undefined,
        partName: part?.name || undefined,
        title: model.title,
        qty,
        scale: uniformScale,
        scaleX,
        scaleY,
        scaleZ,
        unitPrice,
        lineTotal,
        undiscountedLineTotal,
        discountPercent: discountSummary.totalPercent || undefined,
        material: materialChoice,
        colors,
        finish: finishChoice || undefined,
        infillPct: entry.infillPct ?? undefined,
        customText: entry.customText || undefined,
        targetDimensions: entry.targetDimensions || undefined,
        storagePath,
        storageUrl,
        pricingBreakdown: {
          base: pricingDetails,
          volumeMultiplier,
          colorMultiplier,
          discountMultiplier,
          rawUnitPrice,
          unitPrice,
        },
      }
    })

    const total = lineItems.reduce((sum, item) => sum + item.lineTotal, 0)
    if (!isFinite(total) || total < 0) {
      return NextResponse.json({ error: 'Cart total cannot be negative' }, { status: 400 })
    }
    const isFreeOrder = total === 0
    const amount = Math.max(0, Math.round(total * 100))
    const currency = getCurrency().toLowerCase()

    if (!isFreeOrder && paymentMethod !== 'cash' && !process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Stripe is not configured' }, { status: 500 })
    }

    const shippingPayload: ShippingSelection = shipping || { method: 'pickup' }
    const metadataItems = lineItems.slice(0, 20).map((item) => `${item.qty}x ${item.title}${item.partName ? ` (${item.partName})` : ''}`).join(', ')
    const customerEmail = userForCheckout?.email || undefined
    const customerName = userForCheckout?.name || shippingPayload.address?.name || undefined
    const currencyCode = currency.toUpperCase()

    let paymentIntentId: string | null = providedPaymentIntentId || null
    let clientSecret: string | null = null
    let finalizedPaymentStatus: string | null = null

    if (isFreeOrder) {
      if (!commit) {
        paymentIntentId = `free_preview_${randomUUID()}`
      } else {
        paymentIntentId = paymentIntentId || `free_${randomUUID()}`
        finalizedPaymentStatus = 'free'
      }
    } else if (paymentMethod === 'card') {
      if (!commit) {
        const stripe = getStripe()
        const intent = await stripe.paymentIntents.create({
          amount,
          currency,
          automatic_payment_methods: { enabled: true },
          receipt_email: customerEmail || undefined,
          metadata: {
            checkoutId,
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
        finalizedPaymentStatus = normalizePaymentStatusForQueue(paymentMethod, intent.status || null)
      }
    } else if (!commit) {
      paymentIntentId = `cash_preview_${randomUUID()}`
    } else {
      paymentIntentId = paymentIntentId || `cash_${randomUUID()}`
      finalizedPaymentStatus = 'pending'
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
          paymentMethod,
          paymentStatus: finalizedPaymentStatus || (paymentMethod === 'cash' ? 'pending' : null),
          fulfillmentStatus: 'pending',
        })
      } catch (jobErr) {
        console.error('Failed to record OrderWorks job', jobErr)
        return NextResponse.json(
          {
            error: 'Failed to submit the job to OrderWorks. Please try again once the connection is restored.',
          },
          { status: 502 },
        )
      }
      let order: Awaited<ReturnType<typeof recordCustomerOrder>> | null = null
      try {
        order = await recordCustomerOrder({
          paymentIntentId: paymentIntentId!,
          amountCents: amount,
          currency: currencyCode,
          lineItems,
          shipping: shippingPayload,
          paymentMethod,
          userId,
          customerEmail,
          customerName,
          discountPercent: discountSummary.totalPercent ?? null,
          metadata: {
            cartItems: items,
            shipping,
            paymentMethod,
          },
        })
      } catch (err) {
        console.error('Failed to persist customer order', err)
      }
      try {
        const itemLines = lineItems.slice(0, 4).map((item) => `${item.qty}x ${item.title}${item.partName ? ` (${item.partName})` : ''}`)
        if (lineItems.length > itemLines.length) {
          itemLines.push(`+${lineItems.length - itemLines.length} more`)
        }
        const totalLabel = formatCurrency(amount / 100, currencyCode as Currency)
        const orderUrl = order && publicBaseUrl ? `${publicBaseUrl}/customer/orders/${order.id}` : undefined
        await sendAdminDiscordNotification({
          title: paymentMethod === 'cash' ? 'New cash order' : 'New paid order',
          body: [
            `Total: ${totalLabel}`,
            `Fulfillment: ${shippingPayload.method === 'pickup' ? 'pickup' : 'ship'}`,
            `Payment: ${paymentMethod}${finalizedPaymentStatus ? ` (${finalizedPaymentStatus})` : ''}`,
            customerName ? `Customer: ${customerName}` : null,
            customerEmail ? `Email: ${customerEmail}` : null,
            itemLines.length ? `Items: ${itemLines.join(', ')}` : null,
            orderUrl || null,
          ],
          meta: {
            orderId: order?.id,
            orderNumber: order?.orderNumber ?? undefined,
            paymentIntentId,
          },
        })
      } catch (notifyErr) {
        console.error('Admin Discord notification failed for checkout:', notifyErr)
      }
      try {
        const totalLabel = formatCurrency(amount / 100, currencyCode as Currency)
        const isPromise = paymentMethod === 'cash' || finalizedPaymentStatus === 'pending'
        const baseUrl = publicBaseUrl || (process.env.BASE_URL || 'http://localhost:3000').replace(/\/+$/, '')
        await sendAdminPushNotification({
          title: isPromise ? 'Payment promise received' : 'Payment received',
          body: `${totalLabel} · ${shippingPayload.method === 'pickup' ? 'pickup' : 'ship'}`,
          url: `${baseUrl}/admin/jobs`,
          tag: `payment:${paymentIntentId}`,
          data: { paymentIntentId, paymentMethod, paymentStatus: finalizedPaymentStatus || undefined },
        })
      } catch (notifyErr) {
        console.error('Admin push notification failed for checkout:', notifyErr)
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
