"use client"
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Elements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import CheckoutForm from '@/components/checkout/CheckoutForm'
import OrderSummary from '@/components/checkout/OrderSummary'
import { useCart } from '@/components/cart/CartProvider'
import type { CheckoutIntentResponse, CheckoutItemInput, ShippingAddress, CheckoutPaymentMethod } from '@/types/checkout'
import type { Appearance, PaymentIntent } from '@stripe/stripe-js'
import { normalizeColors } from '@/lib/cartPricing'

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

export default function CheckoutPage() {
  const { items, clear } = useCart()
  const [publishableKey, setPublishableKey] = useState<string>(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '')
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

  useEffect(() => {
    setCheckoutItemsState(items)
  }, [items])

  const checkoutItems = useMemo<CheckoutItemInput[]>(() => (
    checkoutItemsState.map((item) => ({
      modelId: item.modelId,
      qty: Math.max(1, item.options.qty || 1),
      scale: item.options.scale || 1,
      material: item.options.material || 'PLA',
      colors: normalizeColors(item.options.colors),
      infillPct: item.options.infillPct ?? null,
      customText: item.options.customText || null,
    }))
  ), [checkoutItemsState])

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

  const fetchIntent = useCallback(async () => {
    if (!checkoutItems.length) {
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
          commit: paymentMethod === 'card',
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
  }, [checkoutItems, shippingSelection, shippingAddress, shippingMethod, paymentMethod])

  useEffect(() => {
    fetchIntent()
  }, [fetchIntent])

  const handleSuccess = (pi: PaymentIntent) => {
    setSuccessIntent(pi)
    setCashConfirmationId(null)
    clear()
  }

  const handleCashConfirm = async () => {
    if (!checkoutItems.length || paymentMethod !== 'cash') return
    setCashProcessing(true)
    setError(null)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: checkoutItems,
          shipping: shippingSelection,
          paymentMethod: 'cash',
          commit: true,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Unable to place cash order.')
      }
      const data = await res.json() as CheckoutIntentResponse
      setCashConfirmationId(data.paymentIntentId)
      setSuccessIntent(null)
      setIntent(null)
      clear()
    } catch (err: any) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setCashProcessing(false)
    }
  }

  const appearance: Appearance = useMemo(() => ({
    theme: 'night',
    variables: {
      colorPrimary: '#f97316',
      colorBackground: '#050505',
      colorText: '#ffffff',
      colorDanger: '#f87171',
    },
  }), [])

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
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500 mt-1">Securely processed via Stripe</p>
        </div>
        {checkoutItemsState.length > 0 && (
          <div className="glass rounded-xl border border-white/10">
            <div className="flex items-center justify-between px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-400">
              <span>Cart Items</span>
              <span>Remove</span>
            </div>
            <div className="divide-y divide-white/10">
              {checkoutItemsState.map((item) => (
                <div key={item.modelId} className="px-4 py-3 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium">{item.title}</div>
                    <div className="text-xs text-slate-400 space-y-0.5">
                      <div>Qty {item.options.qty} {'\u00b7'} Scale {(item.options.scale || 1).toFixed(2)}</div>
                      <div>
                        Material {item.options.material || 'PLA'}
                        {normalizeColors(item.options.colors).length > 0 && (
                          <> {'\u00b7'} Colors: {normalizeColors(item.options.colors).join(', ')}</>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCheckoutItemsState((prev) => prev.filter((entry) => entry.modelId !== item.modelId))}
                    className="text-xs text-amber-300 hover:text-amber-200"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
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
              Local pickup (MakerWorks lab)
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
              Pay now (credit/debit)
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
        </div>
        {intent && (
          <OrderSummary
            items={intent.lineItems}
            currency={intent.currency}
            total={intent.total}
            discount={intent.discount}
          />
        )}
        {loading && (
          <p className="text-sm text-slate-400">
            {paymentMethod === 'cash' ? 'Calculating total...' : 'Preparing secure payment...'}
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
        {!intent && !loading && !successIntent && !cashConfirmationId && (
          <p className="text-sm text-slate-400">Add items to your cart to start checkout.</p>
        )}
        {paymentMethod === 'card' && intent?.clientSecret && stripePromise && !successIntent && (
          <Elements stripe={stripePromise} options={{ clientSecret: intent.clientSecret, appearance }}>
            <CheckoutForm amount={intent.amount} currency={intent.currency} onSuccess={handleSuccess} />
          </Elements>
        )}
        {paymentMethod === 'card' && (!stripePromise || !cardPaymentAvailable) && (
          <p className="text-sm text-amber-300">Stripe publishable key is not configured. Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to enable card payments.</p>
        )}
        {paymentMethod === 'cash' && intent && !cashConfirmationId && (
          <div className="space-y-3 text-sm text-slate-300">
            <p>Bring exact cash to MakerWorks lab when you pick up your order. We will email you once printing is complete.</p>
            <button
              type="button"
              onClick={handleCashConfirm}
              disabled={cashProcessing}
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

