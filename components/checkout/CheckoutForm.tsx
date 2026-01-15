"use client"
import { PaymentElement, PaymentRequestButtonElement, useElements, useStripe } from '@stripe/react-stripe-js'
import type { StripePaymentElementOptions, PaymentIntent, StripePaymentRequest } from '@stripe/stripe-js'
import { useEffect, useMemo, useState } from 'react'

type Props = {
  amount: number
  currency: string
  clientSecret: string
  onSuccess: (intent: PaymentIntent) => Promise<void> | void
}

const paymentElementOptions: StripePaymentElementOptions = {
  layout: 'tabs',
}

function resolveCountryForCurrency(currencyCode: string) {
  switch (currencyCode.toUpperCase()) {
    case 'CAD':
      return 'CA'
    case 'GBP':
      return 'GB'
    case 'AUD':
      return 'AU'
    case 'NZD':
      return 'NZ'
    case 'EUR':
      return 'DE'
    case 'USD':
    default:
      return 'US'
  }
}

export default function CheckoutForm({ amount, currency, clientSecret, onSuccess }: Props) {
  const stripe = useStripe()
  const elements = useElements()
  const [message, setMessage] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [paymentRequest, setPaymentRequest] = useState<StripePaymentRequest | null>(null)

  const formattedTotal = useMemo(() => {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).format(amount / 100)
  }, [amount, currency])

  useEffect(() => {
    if (!stripe) return
    const request = stripe.paymentRequest({
      country: resolveCountryForCurrency(currency),
      currency: currency.toLowerCase(),
      total: {
        label: 'Total',
        amount,
      },
      requestPayerName: true,
      requestPayerEmail: true,
    })
    request.canMakePayment().then((result) => {
      if (result?.googlePay) {
        setPaymentRequest(request)
      } else {
        setPaymentRequest(null)
      }
    }).catch(() => {
      setPaymentRequest(null)
    })
    const handlePaymentMethod = async (event: any) => {
      if (!stripe) return
      setProcessing(true)
      setMessage(null)
      const { error, paymentIntent } = await stripe.confirmCardPayment(
        clientSecret,
        { payment_method: event.paymentMethod.id },
        { handleActions: false },
      )
      if (error) {
        event.complete('fail')
        setMessage(error.message || 'Payment failed. Please try again.')
        setProcessing(false)
        return
      }
      event.complete('success')
      if (paymentIntent?.status === 'requires_action') {
        const { error: actionError, paymentIntent: resolvedIntent } = await stripe.confirmCardPayment(clientSecret)
        if (actionError) {
          setMessage(actionError.message || 'Payment failed. Please try again.')
          setProcessing(false)
          return
        }
        if (resolvedIntent) {
          await onSuccess(resolvedIntent)
        }
      } else if (paymentIntent) {
        await onSuccess(paymentIntent)
      }
      setProcessing(false)
    }
    request.on('paymentmethod', handlePaymentMethod)
    return () => {
      request.off('paymentmethod', handlePaymentMethod)
    }
  }, [stripe, amount, currency, clientSecret, onSuccess])

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
      {paymentRequest && (
        <PaymentRequestButtonElement
          options={{ paymentRequest }}
        />
      )}
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
