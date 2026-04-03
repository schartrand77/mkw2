'use client'

import { useState } from 'react'
import { pushSessionNotification } from '@/components/notifications/NotificationsProvider'

type ShippingInfo = {
  carrier?: string | null
  service?: string | null
  trackingNumber?: string | null
  trackingUrl?: string | null
  labelUrl?: string | null
  shippedAt?: string | null
}

type Props = {
  orderId: string
  initial?: ShippingInfo | null
}

function normalize(value?: string | null) {
  return value ?? ''
}

function toInputDate(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 16)
}

export default function ShippingTrackingForm({ orderId, initial }: Props) {
  const [carrier, setCarrier] = useState(normalize(initial?.carrier))
  const [service, setService] = useState(normalize(initial?.service))
  const [trackingNumber, setTrackingNumber] = useState(normalize(initial?.trackingNumber))
  const [trackingUrl, setTrackingUrl] = useState(normalize(initial?.trackingUrl))
  const [labelUrl, setLabelUrl] = useState(normalize(initial?.labelUrl))
  const [shippedAt, setShippedAt] = useState(toInputDate(initial?.shippedAt))
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (saving) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/shipping`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carrier: carrier || null,
          service: service || null,
          trackingNumber: trackingNumber || null,
          trackingUrl: trackingUrl || null,
          labelUrl: labelUrl || null,
          shippedAt: shippedAt ? new Date(shippedAt).toISOString() : null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to save shipping info')
      pushSessionNotification({
        type: 'success',
        title: 'Shipping updated',
        message: 'Tracking details saved.',
      })
    } catch (err: any) {
      pushSessionNotification({ type: 'error', title: 'Shipping update failed', message: err?.message || 'Unable to save shipping info.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Shipping label + tracking</p>
      <div className="grid gap-2 text-sm">
        <label className="space-y-1">
          <span className="text-xs text-slate-400">Carrier</span>
          <input className="input" value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="UPS, USPS, FedEx" />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-slate-400">Service</span>
          <input className="input" value={service} onChange={(e) => setService(e.target.value)} placeholder="Ground, Priority, etc." />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-slate-400">Tracking number</span>
          <input className="input" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-slate-400">Tracking URL</span>
          <input className="input" value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} placeholder="https://..." />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-slate-400">Label URL</span>
          <input className="input" value={labelUrl} onChange={(e) => setLabelUrl(e.target.value)} placeholder="https://..." />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-slate-400">Shipped at</span>
          <input className="input" type="datetime-local" value={shippedAt} onChange={(e) => setShippedAt(e.target.value)} />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="px-3 py-1.5 rounded-md border border-white/10 hover:border-white/30 text-sm disabled:opacity-60"
          onClick={save}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save shipping'}
        </button>
        {trackingUrl ? (
          <a
            className="px-3 py-1.5 rounded-md border border-white/10 hover:border-white/30 text-sm"
            href={trackingUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open tracking
          </a>
        ) : null}
        {labelUrl ? (
          <a
            className="px-3 py-1.5 rounded-md border border-white/10 hover:border-white/30 text-sm"
            href={labelUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open label
          </a>
        ) : null}
      </div>
    </div>
  )
}
