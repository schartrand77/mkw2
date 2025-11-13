"use client"
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Elements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import CheckoutForm from '@/components/checkout/CheckoutForm'
import OrderSummary from '@/components/checkout/OrderSummary'
import { useCart } from '@/components/cart/CartProvider'
import type { CheckoutIntentResponse, CheckoutItemInput } from '@/types/checkout'
import type { Appearance, PaymentIntent } from '@stripe/stripe-js'

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
const stripePromise = publishableKey ? loadStripe(publishableKey) : null

export default function CheckoutPage() {
  const { items, clear } = useCart()
  const [intent, setIntent] = useState<CheckoutIntentResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successIntent, setSuccessIntent] = useState<PaymentIntent | null>(null)

  const checkoutItems = useMemo<CheckoutItemInput[]>(() => (
    items.map((item) => ({
      modelId: item.modelId,
      qty: Math.max(1, item.options.qty || 1),
      scale: item.options.scale || 1,
      color: item.options.color || null,
      infillPct: item.options.infillPct ?? null,
      customText: item.options.customText || null,
    }))
  ), [items])

  const fetchIntent = useCallback(async () => {
    if (!checkoutItems.length) {
      setIntent(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: checkoutItems }),
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
  }, [checkoutItems])

  useEffect(() => {
    fetchIntent()
  }, [fetchIntent])

  const handleSuccess = (pi: PaymentIntent) => {
    setSuccessIntent(pi)
    clear()
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

  if (!stripePromise) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-semibold">Checkout</h1>
        <p className="text-sm text-amber-300">Stripe publishable key is not configured. Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to enable checkout.</p>
      </div>
    )
  }

  if (!items.length && !successIntent) {
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
        <h1 className="text-2xl font-semibold">Checkout</h1>
        {intent && (
          <OrderSummary items={intent.lineItems} currency={intent.currency} total={intent.total} />
        )}
        {loading && <p className="text-sm text-slate-400">Preparing secure payment…</p>}
        {error && <p className="text-sm text-amber-300">{error}</p>}
        {successIntent && (
          <div className="glass rounded-xl border border-emerald-500/30 p-4 text-sm">
            <p className="font-semibold text-emerald-300">Payment received!</p>
            <p>Confirmation: {successIntent.id}</p>
          </div>
        )}
      </div>
      <div className="glass rounded-2xl border border-white/10 p-6 space-y-4">
        {!intent && !loading && <p className="text-sm text-slate-400">Add items to your cart to start checkout.</p>}
        {intent?.clientSecret && stripePromise && !successIntent && (
          <Elements stripe={stripePromise} options={{ clientSecret: intent.clientSecret, appearance }}>
            <CheckoutForm amount={intent.amount} currency={intent.currency} onSuccess={handleSuccess} />
          </Elements>
        )}
        {successIntent && (
          <p className="text-sm text-slate-300">You can close this tab or continue browsing models.</p>
        )}
      </div>
    </div>
  )
}
