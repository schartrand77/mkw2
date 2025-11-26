"use client"
import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import type { StripePaymentElementOptions, PaymentIntent } from '@stripe/stripe-js'
import { useMemo, useState } from 'react'

type Props = {
  amount: number
  currency: string
  onSuccess: (intent: PaymentIntent) => Promise<void> | void
}

const paymentElementOptions: StripePaymentElementOptions = {
  layout: 'tabs',
}

export default function CheckoutForm({ amount, currency, onSuccess }: Props) {
  const stripe = useStripe()
  const elements = useElements()
  const [message, setMessage] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)

  const formattedTotal = useMemo(() => {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).format(amount / 100)
  }, [amount, currency])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setProcessing(true)
    setMessage(null)

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
      confirmParams: {
        return_url: typeof window !== 'undefined' ? window.location.href : undefined,
      },
    })

    if (error) {
      setMessage(error.message || 'Payment failed. Please try again.')
      setProcessing(false)
      return
    }

    if (paymentIntent) {
      const successStatuses = new Set(['succeeded', 'processing', 'requires_capture'])
      if (successStatuses.has(paymentIntent.status)) {
        try {
          await onSuccess(paymentIntent)
        } catch (err: any) {
          setMessage(err?.message || 'Payment completed but we could not finalize your order.')
          setProcessing(false)
          return
        }
        if (paymentIntent.status === 'processing') {
          setMessage('Your payment is processing. This page will update when it completes.')
        } else if (paymentIntent.status === 'requires_capture') {
          setMessage('Payment authorized! We will capture it shortly.')
        } else {
          setMessage('Payment successful! Thank you for your order.')
        }
      } else {
        setMessage(`Payment status: ${paymentIntent.status}`)
      }
    }
    setProcessing(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement options={paymentElementOptions} />
      <button
        type="submit"
        disabled={!stripe || processing}
        className="btn w-full justify-center disabled:opacity-60"
      >
        {processing ? 'Processing…' : `Pay ${formattedTotal}`}
      </button>
      {message && <div className="text-sm text-amber-300">{message}</div>}
    </form>
  )
}
