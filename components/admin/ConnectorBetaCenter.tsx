"use client"

import { useState } from 'react'
import type { ConnectorBetaStatus } from '@/lib/connector-betas'

type OrderOption = {
  id: string
  orderNumber: number | null
  status: string
  shippingMethod: string
}

type Props = {
  connectors: ConnectorBetaStatus[]
  orders: OrderOption[]
}

function orderLabel(order: OrderOption) {
  const ref = order.orderNumber ? `MW-${String(order.orderNumber).padStart(5, '0')}` : order.id
  return `${ref} · ${order.status.replaceAll('_', ' ')} · ${order.shippingMethod}`
}

export default function ConnectorBetaCenter({ connectors, orders }: Props) {
  const [selectedOrderId, setSelectedOrderId] = useState(orders[0]?.id || '')
  const [activeConnector, setActiveConnector] = useState<string>(connectors[0]?.id || '')
  const [payload, setPayload] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const preview = async () => {
    if (!selectedOrderId || !activeConnector) return
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ connectorId: activeConnector, orderId: selectedOrderId })
      const res = await fetch(`/api/admin/connectors/preview?${params.toString()}`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Unable to generate connector preview.')
      setPayload(JSON.stringify(data.payload, null, 2))
    } catch (err: any) {
      setError(err?.message || 'Unable to generate connector preview.')
      setPayload('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-2">
        {connectors.map((connector) => (
          <button
            key={connector.id}
            type="button"
            onClick={() => setActiveConnector(connector.id)}
            className={`rounded-2xl border p-5 text-left ${activeConnector === connector.id ? 'border-brand-400 bg-brand-500/10' : 'border-white/10 bg-black/20'}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-lg font-semibold">{connector.label}</div>
              <div className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-xs uppercase tracking-[0.2em] text-sky-200">beta</div>
            </div>
            <p className="mt-2 text-sm text-slate-400">{connector.summary}</p>
            <div className="mt-3 text-xs text-slate-500">
              {connector.eligible
                ? `Suggested order: ${connector.orderNumber ? `MW-${String(connector.orderNumber).padStart(5, '0')}` : connector.orderId}`
                : 'No eligible order found yet.'}
            </div>
          </button>
        ))}
      </section>

      <section className="rounded-2xl border border-white/10 bg-black/20 p-5 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Preview payload</h2>
          <p className="text-sm text-slate-400 mt-1">Generate the outbound beta payload from an existing order before wiring upstream delivery.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <select className="input" value={activeConnector} onChange={(e) => setActiveConnector(e.target.value)}>
            {connectors.map((connector) => (
              <option key={connector.id} value={connector.id}>{connector.label}</option>
            ))}
          </select>
          <select className="input" value={selectedOrderId} onChange={(e) => setSelectedOrderId(e.target.value)}>
            {orders.map((order) => (
              <option key={order.id} value={order.id}>{orderLabel(order)}</option>
            ))}
          </select>
          <button type="button" className="btn" disabled={loading || !selectedOrderId || !activeConnector} onClick={() => void preview()}>
            {loading ? 'Generating...' : 'Generate preview'}
          </button>
        </div>
        {error ? <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{error}</div> : null}
        <pre className="overflow-x-auto rounded-xl border border-white/10 bg-black/30 p-4 text-xs text-slate-200 whitespace-pre-wrap">
          {payload || 'Select a connector and order to generate a beta payload preview.'}
        </pre>
      </section>
    </div>
  )
}
