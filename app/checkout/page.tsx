"use client"
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Elements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import CheckoutForm from '@/components/checkout/CheckoutForm'
import OrderSummary from '@/components/checkout/OrderSummary'
import TrustBadge from '@/components/checkout/TrustBadge'
import { pushSessionNotification } from '@/components/notifications/NotificationsProvider'
import { useCart } from '@/components/cart/CartProvider'
import type { CheckoutIntentResponse, CheckoutItemInput, ShippingAddress, CheckoutPaymentMethod, Dimensions } from '@/types/checkout'
import type { Appearance, PaymentIntent } from '@stripe/stripe-js'
import { DIMENSION_AXES, normalizeColors, resolveAxisScale, normalizeMaterialName } from '@/lib/cartPricing'
import { BRAND_LAB_NAME } from '@/lib/brand'

type ProfileResponse = {
  profile: {
    contactEmail?: string | null
    contactPhone?: string | null
    websiteUrl?: string | null
    socialTwitter?: string | null
    socialInstagram?: string | null
    socialTikTok?: string | null
    socialYoutube?: string | null
    socialBluesky?: string | null
    socialFacebook?: string | null
    shippingName?: string | null
    shippingAddress1?: string | null
    shippingAddress2?: string | null
    shippingCity?: string | null
    shippingState?: string | null
    shippingPostal?: string | null
    shippingCountry?: string | null
  }
  user: { name?: string | null, email: string }
}

type StockworksWarning = {
  status: 'in_stock' | 'limited' | 'out_of_stock'
  quantityGrams: number
  limitedThresholdGrams: number
  leadTimeDays?: number | null
}

type StockworksWarningResponse = {
  enabled: boolean
  materials: Record<string, StockworksWarning>
  updatedAt?: string
}

export default function CheckoutPage() {
  const { items, clear } = useCart()
  const [publishableKey, setPublishableKey] = useState<string>('')
  const stripePromise = useMemo(() => (publishableKey ? loadStripe(publishableKey) : null), [publishableKey])
  const cardPaymentAvailable = Boolean(stripePromise)
  const [checkoutItemsState, setCheckoutItemsState] = useState(items)
  const [intent, setIntent] = useState<CheckoutIntentResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successIntent, setSuccessIntent] = useState<PaymentIntent | null>(null)
  const [profile, setProfile] = useState<ProfileResponse | null>(null)
  const [shippingMethod, setShippingMethod] = useState<'pickup' | 'ship'>('pickup')
  const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMethod>(cardPaymentAvailable ? 'card' : 'cash')
  const [cashConfirmationId, setCashConfirmationId] = useState<string | null>(null)
  const [cashProcessing, setCashProcessing] = useState(false)
  const [finalizingJob, setFinalizingJob] = useState(false)
  const [applePayAvailable, setApplePayAvailable] = useState(false)
  const [materialWarnings, setMaterialWarnings] = useState<StockworksWarningResponse | null>(null)

  useEffect(() => {
    setCheckoutItemsState(items)
  }, [items])

  const checkoutItems = useMemo<CheckoutItemInput[]>(() => (
    checkoutItemsState.map((item) => {
      const locked = item.options.lockDimensions !== false
      const overrides = locked ? null : item.options.dimensionOverrides
      const axisScales = DIMENSION_AXES.reduce((acc, axis) => {
        acc[axis] = resolveAxisScale(item.options.scale, overrides, axis)
        return acc
      }, {} as Record<(typeof DIMENSION_AXES)[number], number>)
      const targetDimensions: Dimensions | null = (() => {
        const dims: Dimensions = {}
        for (const axis of DIMENSION_AXES) {
          const base = item.size?.[axis]
          if (typeof base !== 'number' || Number.isNaN(base) || base <= 0) continue
          dims[axis] = Number((base * axisScales[axis]).toFixed(1))
        }
        return Object.keys(dims).length ? dims : null
      })()
      const uniformScale = Math.cbrt(axisScales.x * axisScales.y * axisScales.z)
      return {
        modelId: item.modelId,
        partId: item.partId || undefined,
        qty: Math.max(1, item.options.qty || 1),
        scale: uniformScale,
        scaleX: axisScales.x,
        scaleY: axisScales.y,
        scaleZ: axisScales.z,
        material: item.options.material || 'PLA',
        colors: normalizeColors(item.options.colors),
        finish: item.options.finish || null,
        infillPct: item.options.infillPct ?? null,
        customText: item.options.customText || null,
        lockDimensions: locked,
        targetDimensions,
      }
    })
  ), [checkoutItemsState])
  const missingColorItems = useMemo(
    () => checkoutItemsState.filter((item) => normalizeColors(item.options.colors).length === 0),
    [checkoutItemsState],
  )
  const hasMissingColors = missingColorItems.length > 0

  const checkoutMaterials = useMemo(() => {
    const unique = new Set<string>()
    for (const item of checkoutItems) {
      const key = normalizeMaterialName(item.material || 'PLA')
      if (key) unique.add(key)
    }
    return Array.from(unique)
  }, [checkoutItems])

  useEffect(() => {
    let active = true
    if (checkoutMaterials.length === 0) {
      setMaterialWarnings(null)
      return () => { active = false }
    }
    const qs = checkoutMaterials.join(',')
    fetch(`/api/stockworks/material-warnings?materials=${encodeURIComponent(qs)}`, { cache: 'no-store' })
      .then(async (res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data?.enabled) return
        setMaterialWarnings(data)
      })
      .catch(() => {})
    return () => { active = false }
  }, [checkoutMaterials])

  const shippingAddress: ShippingAddress | null = useMemo(() => {
    const data = profile?.profile
    if (!data) return null
    if (!data.shippingAddress1 || !data.shippingCity || !data.shippingPostal || !data.shippingCountry) return null
    return {
      name: data.shippingName || profile?.user.name || '',
      line1: data.shippingAddress1,
      line2: data.shippingAddress2 || undefined,
      city: data.shippingCity,
      state: data.shippingState || undefined,
      postalCode: data.shippingPostal || undefined,
      country: data.shippingCountry || undefined,
    }
  }, [profile])

  const shippingSelection = useMemo(() => ({
    method: shippingMethod,
    address: shippingMethod === 'ship' && shippingAddress ? shippingAddress : undefined,
  }), [shippingMethod, shippingAddress])

  useEffect(() => {
    if (shippingMethod === 'ship' && paymentMethod === 'cash') {
      setPaymentMethod('card')
    }
  }, [shippingMethod, paymentMethod])

  useEffect(() => {
    let cancelled = false
    const loadKey = async () => {
      try {
        const res = await fetch('/api/public-config', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json().catch(() => null) as { stripePublishableKey?: string } | null
        const runtimeKey = data?.stripePublishableKey || ''
        if (cancelled || !runtimeKey || runtimeKey === publishableKey) return
        setPublishableKey(runtimeKey)
        setPaymentMethod((current) => (current === 'cash' ? 'card' : current))
      } catch {}
    }
    loadKey()
    return () => { cancelled = true }
  }, [publishableKey])

  useEffect(() => {
    if (checkoutItemsState.length > 0 && cashConfirmationId) {
      setCashConfirmationId(null)
    }
  }, [checkoutItemsState.length, cashConfirmationId])

  useEffect(() => {
    let mounted = true
    fetch('/api/profile', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) return
        const data = await res.json()
        if (mounted) setProfile(data)
      })
      .catch(() => {})
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const session = (window as any).ApplePaySession
    if (!session || typeof session.canMakePayments !== 'function') {
      setApplePayAvailable(false)
      return
    }
    try {
      setApplePayAvailable(Boolean(session.canMakePayments()))
    } catch {
      setApplePayAvailable(false)
    }
  }, [])

  const fetchIntent = useCallback(async () => {
    if (!checkoutItems.length) {
      setIntent(null)
      return
    }
    if (hasMissingColors) {
      setError('Choose at least one filament color for every item before checking out.')
      setIntent(null)
      return
    }
    if (shippingMethod === 'ship' && !shippingAddress) {
      setError('Add a shipping address under Settings → Profile before selecting shipping.')
      setIntent(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: checkoutItems,
          shipping: shippingSelection,
          paymentMethod,
          commit: false,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Unable to start checkout.')
      }
      const data = await res.json() as CheckoutIntentResponse
      setIntent(data)
    } catch (err: any) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }, [checkoutItems, hasMissingColors, shippingSelection, shippingAddress, shippingMethod, paymentMethod])

  useEffect(() => {
    fetchIntent()
  }, [fetchIntent])

  const finalizeJob = useCallback(async ({ paymentIntentId, method }: { paymentIntentId?: string; method: CheckoutPaymentMethod }) => {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: checkoutItems,
        shipping: shippingSelection,
        paymentMethod: method,
        commit: true,
        paymentIntentId,
      }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || 'Unable to finalize checkout.')
    }
    return res.json() as Promise<CheckoutIntentResponse>
  }, [checkoutItems, shippingSelection])

  const handleSuccess = useCallback(async (pi: PaymentIntent) => {
    setFinalizingJob(true)
    setCashConfirmationId(null)
    try {
      await finalizeJob({ paymentIntentId: pi.id, method: 'card' })
      setSuccessIntent(pi)
      pushSessionNotification({
        type: 'success',
        title: 'Payment received',
        message: `Confirmation: ${pi.id}`,
      })
    } catch (err: any) {
      console.error('Payment succeeded but OrderWorks job failed', err)
      const msg = err?.message || 'Payment completed but we could not queue your job. Contact support.'
      setError(msg)
      pushSessionNotification({ type: 'error', title: 'Order finalization failed', message: msg })
      setSuccessIntent(pi)
    } finally {
      setIntent(null)
      clear()
      setFinalizingJob(false)
    }
  }, [clear, finalizeJob])

  const handleCashConfirm = async () => {
    if (!checkoutItems.length || paymentMethod !== 'cash') return
    setCashProcessing(true)
    setFinalizingJob(true)
    setError(null)
    try {
      const data = await finalizeJob({ method: 'cash' })
      setCashConfirmationId(data.paymentIntentId)
      setSuccessIntent(null)
      setIntent(null)
      clear()
      pushSessionNotification({
        type: 'success',
        title: 'Cash order placed',
        message: `Confirmation: ${data.paymentIntentId}`,
      })
    } catch (err: any) {
      const msg = err.message || 'Unable to place cash order.'
      setError(msg)
      pushSessionNotification({ type: 'error', title: 'Cash order failed', message: msg })
    } finally {
      setCashProcessing(false)
      setFinalizingJob(false)
    }
  }

  const appearance: Appearance = useMemo(() => ({
    theme: 'night',
    variables: {
      colorPrimary: '#3f76ff',
      colorBackground: '#04060a',
      colorText: '#ffffff',
      colorDanger: '#f87171',
    },
  }), [])

  const trustBadgeProviders = paymentMethod === 'card' && cardPaymentAvailable
    ? (applePayAvailable ? ['Stripe', 'Apple Pay'] : ['Stripe'])
    : []
  const trustBadgeNote = paymentMethod === 'cash'
    ? 'No card details are required for cash orders.'
    : 'Card details are encrypted and handled by the payment processor.'

  if (!checkoutItemsState.length && !successIntent && !cashConfirmationId) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-semibold">Checkout</h1>
        <p className="text-slate-400">Your cart is empty. Add models before checking out.</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto grid gap-6 md:grid-cols-2">
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold">Checkout</h1>
            <Link href="/cart" className="text-sm text-brand-400 hover:text-brand-300 underline underline-offset-4">Edit cart</Link>
          </div>
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500 mt-1">Secure checkout</p>
        </div>
      {checkoutItemsState.length > 0 && (
        <div className="glass rounded-xl border border-white/10">
            <div className="flex items-center justify-between px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-400">
              <span>Cart Items</span>
              <span>Remove</span>
            </div>
            <div className="divide-y divide-white/10">
              {checkoutItemsState.map((item) => (
                <div key={`${item.modelId}-${item.partId || 'whole'}`} className="px-4 py-3 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium">
                      {item.title}
                      {item.partName && <span className="text-xs text-slate-400 ml-2">(Part: {item.partName})</span>}
                    </div>
                    <div className="text-xs text-slate-400 space-y-0.5">
                      <div>Qty {item.options.qty} {'\u00b7'} Scale {(item.options.scale || 1).toFixed(2)}</div>
                      <div>
                        Material {item.options.material || 'PLA'}
                        {(() => {
                          const itemColors = normalizeColors(item.options.colors)
                          if (itemColors.length > 0) {
                            return <> {'\u00b7'} Colors: {itemColors.join(', ')}</>
                          }
                          return <> {'\u00b7'} <span className="text-amber-300">Colors required</span></>
                        })()}
                        {item.options.finish && item.options.finish !== 'standard' && (
                          <> {'\u00b7'} Finish: {item.options.finish}</>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCheckoutItemsState((prev) => prev.filter((entry) => !(entry.modelId === item.modelId && (entry.partId || null) === (item.partId || null))))}
                    className="text-xs text-amber-300 hover:text-amber-200"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
        </div>
      )}
      {hasMissingColors && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm space-y-2">
          <p className="font-semibold text-amber-200">Filament color required</p>
          <p className="text-xs text-amber-100">Choose at least one filament color for every item before checking out.</p>
          <Link href="/cart" className="text-xs text-brand-200 hover:text-brand-100 underline underline-offset-4">
            Edit cart to pick colors
          </Link>
        </div>
      )}
      {materialWarnings?.enabled && (() => {
        const warnings = Object.entries(materialWarnings.materials || {}).filter(([, warning]) => warning.status !== 'in_stock')
        if (warnings.length === 0) return null
        return (
          <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm space-y-2">
            <p className="font-semibold text-amber-200">Material availability notice</p>
            {warnings.map(([material, warning]) => (
              <div key={material} className="text-xs text-amber-100">
                <span className="uppercase tracking-[0.2em]">{material}</span>
                {warning.status === 'limited' && (
                  <span> limited stock available. We may follow up if substitutions are needed.</span>
                )}
                {warning.status === 'out_of_stock' && (
                  <span> currently out of stock. Estimated lead time {warning.leadTimeDays ?? 'TBD'} days.</span>
                )}
              </div>
            ))}
          </div>
        )
      })()}
        <div className="glass rounded-xl border border-white/10 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Shipping</h2>
            <Link href="/settings/profile" className="text-xs text-brand-400 hover:text-brand-300 underline underline-offset-4">Edit profile</Link>
          </div>
          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="shipping"
                value="pickup"
                checked={shippingMethod === 'pickup'}
                onChange={() => setShippingMethod('pickup')}
              />
              Local pickup ({BRAND_LAB_NAME})
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="shipping"
                value="ship"
                checked={shippingMethod === 'ship'}
                onChange={() => setShippingMethod('ship')}
                disabled={!shippingAddress || !cardPaymentAvailable}
              />
              Ship to saved address
            </label>
          </div>
          {shippingMethod === 'ship' && (
            shippingAddress ? (
              <div className="text-xs text-slate-300 space-y-0.5">
                <div className="font-semibold text-sm">{shippingAddress.name}</div>
                <div>{shippingAddress.line1}</div>
                {shippingAddress.line2 && <div>{shippingAddress.line2}</div>}
                <div>{shippingAddress.city}{shippingAddress.state ? `, ${shippingAddress.state}` : ''}</div>
                <div>{shippingAddress.postalCode}{shippingAddress.country ? ` - ${shippingAddress.country}` : ''}</div>
              </div>
            ) : (
              <p className="text-xs text-amber-300">Add your shipping address under Settings {'->'} Profile to enable shipping.</p>
            )
          )}
        </div>
        <div className="glass rounded-xl border border-white/10 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Payment</h2>
            {!cardPaymentAvailable && (
              <span className="text-xs text-amber-300">Stripe key missing</span>
            )}
          </div>
          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="payment"
                value="card"
                checked={paymentMethod === 'card'}
                onChange={() => setPaymentMethod('card')}
                disabled={!cardPaymentAvailable}
              />
              Pay now (card)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="payment"
                value="cash"
                checked={paymentMethod === 'cash'}
                onChange={() => setPaymentMethod('cash')}
                disabled={shippingMethod !== 'pickup'}
              />
              Pay cash at pickup
            </label>
          </div>
          {shippingMethod !== 'pickup' && (
            <p className="text-xs text-slate-400">Switch to local pickup to enable cash payments.</p>
          )}
          {paymentMethod === 'card' && !cardPaymentAvailable && (
            <p className="text-xs text-amber-300">Stripe publishable key is not configured. Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to enable card payments.</p>
          )}
          {paymentMethod === 'card' && cardPaymentAvailable && (
            <p className="text-xs text-slate-400">
              Card details are handled securely by the payment processor.
            </p>
          )}
        </div>
        {intent && (
          <OrderSummary
            items={intent.lineItems}
            currency={intent.currency}
            total={intent.total}
            discount={intent.discount}
          />
        )}
        {(loading || finalizingJob) && (
          <p className="text-sm text-slate-400">
            {finalizingJob
              ? 'Wrapping up your order...'
              : paymentMethod === 'cash'
                ? 'Calculating total...'
                : 'Preparing secure payment...'}
          </p>
        )}
        {error && <p className="text-sm text-amber-300">{error}</p>}
        {(successIntent || cashConfirmationId) && (
          <div className="glass rounded-xl border border-emerald-500/30 p-4 text-sm">
            <p className="font-semibold text-emerald-300">
              {successIntent ? 'Payment received!' : 'Cash order placed!'}
            </p>
            <p>Confirmation: {successIntent ? successIntent.id : cashConfirmationId}</p>
          </div>
        )}
      </div>
      <div className="glass rounded-2xl border border-white/10 p-6 space-y-4">
        <TrustBadge
          providers={trustBadgeProviders}
          note={trustBadgeNote}
        />
        {!intent && !loading && !successIntent && !cashConfirmationId && (
          <p className="text-sm text-slate-400">Add items to your cart to start checkout.</p>
        )}
        {paymentMethod === 'card' && intent?.clientSecret && stripePromise && !successIntent && (
          <Elements stripe={stripePromise} options={{ clientSecret: intent.clientSecret, appearance }}>
            <CheckoutForm amount={intent.amount} currency={intent.currency} clientSecret={intent.clientSecret} onSuccess={handleSuccess} />
          </Elements>
        )}
        {paymentMethod === 'card' && (!stripePromise || !cardPaymentAvailable) && (
          <p className="text-sm text-amber-300">Stripe publishable key is not configured. Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to enable card payments.</p>
        )}
        {paymentMethod === 'cash' && intent && !cashConfirmationId && (
          <div className="space-y-3 text-sm text-slate-300">
            <p>Bring exact cash to {BRAND_LAB_NAME} when you pick up your order. We will email you once printing is complete.</p>
            <button
              type="button"
              onClick={handleCashConfirm}
              disabled={cashProcessing || finalizingJob}
              className="btn w-full justify-center disabled:opacity-60"
            >
              {cashProcessing ? 'Placing order...' : 'Confirm cash order'}
            </button>
          </div>
        )}
        {(successIntent || cashConfirmationId) && (
          <p className="text-sm text-slate-300">You can close this tab or continue browsing models.</p>
        )}
      </div>
    </div>
  )
}

