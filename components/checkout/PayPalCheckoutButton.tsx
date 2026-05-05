"use client"

import { useEffect, useRef, useState } from 'react'
import { pushSessionNotification } from '@/components/notifications/NotificationsProvider'

type Props = {
  clientId: string
  currency: string
  orderId: string
  disabled?: boolean
  onApprove: (orderId: string) => Promise<void> | void
}

function loadPayPalSdk(clientId: string, currency: string) {
  const sdkUrl = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${encodeURIComponent(currency.toUpperCase())}&intent=capture`
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${sdkUrl}"]`)
  if (existing) {
    return new Promise<void>((resolve, reject) => {
      if ((window as any).paypal?.Buttons) resolve()
      else {
        existing.addEventListener('load', () => resolve(), { once: true })
        existing.addEventListener('error', () => reject(new Error('Unable to load PayPal checkout.')), { once: true })
      }
    })
  }
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = sdkUrl
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Unable to load PayPal checkout.'))
    document.head.appendChild(script)
  })
}

export default function PayPalCheckoutButton({ clientId, currency, orderId, disabled, onApprove }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const buttonsRef = useRef<{ close?: () => void } | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setMessage(null)
    if (!clientId || !currency || !orderId || disabled) return
    loadPayPalSdk(clientId, currency)
      .then(() => {
        if (cancelled || !containerRef.current) return
        containerRef.current.innerHTML = ''
        const paypal = (window as any).paypal
        if (!paypal?.Buttons) throw new Error('PayPal checkout is unavailable.')
        const buttons = paypal.Buttons({
          style: {
            layout: 'vertical',
            shape: 'rect',
            label: 'paypal',
          },
          createOrder: () => orderId,
          onApprove: async (data: { orderID?: string }) => {
            const approvedOrderId = data.orderID || orderId
            try {
              await onApprove(approvedOrderId)
            } catch (err: any) {
              const msg = err?.message || 'PayPal payment completed but the order could not be finalized.'
              setMessage(msg)
              pushSessionNotification({ type: 'error', title: 'Order finalization failed', message: msg })
            }
          },
          onError: (err: unknown) => {
            console.error('PayPal checkout error', err)
            const msg = 'PayPal checkout failed. Please try again.'
            setMessage(msg)
            pushSessionNotification({ type: 'error', title: 'PayPal checkout failed', message: msg })
          },
        })
        buttonsRef.current = buttons
        buttons.render(containerRef.current)
      })
      .catch((err: any) => {
        if (cancelled) return
        setMessage(err?.message || 'Unable to load PayPal checkout.')
      })
    return () => {
      cancelled = true
      buttonsRef.current?.close?.()
      buttonsRef.current = null
    }
  }, [clientId, currency, disabled, onApprove, orderId])

  return (
    <div className="space-y-3">
      <div ref={containerRef} className={disabled ? 'pointer-events-none opacity-60' : undefined} />
      {message && <div className="text-sm text-amber-300">{message}</div>}
    </div>
  )
}
