'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { MATERIAL_OPTIONS, FINISH_OPTIONS } from '@/lib/cartPricing'
import { ORDER_STATUS_FLOW, type OrderStatus } from '@/lib/order-status'
import { pushSessionNotification } from '@/components/notifications/NotificationsProvider'
import { PAYMENT_METHOD_OPTIONS } from '@/lib/orderworks-status'
import type { CheckoutPaymentMethod } from '@/types/checkout'

type LineItemDraft = {
  id: string
  modelTitle: string
  material: string
  quantity: number
  unitPrice: string
  colors: string
  finish: string
  infillPct: string
  customNotes: string
}

type Props = {
  userId: string
  userEmail?: string | null
  userName?: string | null
}

const SHIPPING_METHODS = [
  { value: 'pickup', label: 'Pickup' },
  { value: 'ship', label: 'Ship' },
] as const

function createItem(): LineItemDraft {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `item-${Date.now()}-${Math.random().toString(16).slice(2)}`
  return {
    id,
    modelTitle: '',
    material: MATERIAL_OPTIONS[0] ?? 'PLA',
    quantity: 1,
    unitPrice: '',
    colors: '',
    finish: '',
    infillPct: '',
    customNotes: '',
  }
}

function toCents(value: string) {
  if (!value.trim()) return null
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric < 0) return null
  return Math.round(numeric * 100)
}

export default function UserOrderCreator({ userId, userEmail, userName }: Props) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<LineItemDraft[]>([createItem()])
  const [customerName, setCustomerName] = useState(userName || '')
  const [customerEmail, setCustomerEmail] = useState(userEmail || '')
  const [status, setStatus] = useState<OrderStatus>(ORDER_STATUS_FLOW[0]?.key ?? 'queued')
  const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMethod>('cash')
  const [shippingMethod, setShippingMethod] = useState<(typeof SHIPPING_METHODS)[number]['value']>('pickup')
  const [shippingName, setShippingName] = useState('')
  const [shippingLine1, setShippingLine1] = useState('')
  const [shippingLine2, setShippingLine2] = useState('')
  const [shippingCity, setShippingCity] = useState('')
  const [shippingState, setShippingState] = useState('')
  const [shippingPostal, setShippingPostal] = useState('')
  const [shippingCountry, setShippingCountry] = useState('')
  const [discountPercent, setDiscountPercent] = useState('')
  const [contributionType, setContributionType] = useState('paid')
  const [donatedAmount, setDonatedAmount] = useState('')
  const [materialCost, setMaterialCost] = useState('')
  const [machineTimeMinutes, setMachineTimeMinutes] = useState('')
  const [receiptStatus, setReceiptStatus] = useState('none')
  const [contributionNotes, setContributionNotes] = useState('')
  const [notes, setNotes] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const subtotalCents = useMemo(() => items.reduce((sum, item) => {
    const unit = toCents(item.unitPrice)
    if (unit == null) return sum
    return sum + unit * Math.max(1, Math.round(item.quantity || 1))
  }, 0), [items])

  const totalCents = useMemo(() => {
    const discount = Number(discountPercent)
    if (!Number.isFinite(discount) || discount <= 0) return subtotalCents
    const multiplier = Math.max(0, 1 - discount / 100)
    return Math.max(0, Math.round(subtotalCents * multiplier))
  }, [subtotalCents, discountPercent])

  const updateItem = (id: string, patch: Partial<LineItemDraft>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  const resetForm = () => {
    setItems([createItem()])
    setCustomerName(userName || '')
    setCustomerEmail(userEmail || '')
    setStatus(ORDER_STATUS_FLOW[0]?.key ?? 'queued')
    setPaymentMethod('cash')
    setShippingMethod('pickup')
    setShippingName('')
    setShippingLine1('')
    setShippingLine2('')
    setShippingCity('')
    setShippingState('')
    setShippingPostal('')
    setShippingCountry('')
    setDiscountPercent('')
    setContributionType('paid')
    setDonatedAmount('')
    setMaterialCost('')
    setMachineTimeMinutes('')
    setReceiptStatus('none')
    setContributionNotes('')
    setNotes('')
  }

  const submitOrder = async (event: FormEvent) => {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setError(null)
    try {
      const payloadItems = items.map((item) => {
        const unitPriceCents = toCents(item.unitPrice)
        if (unitPriceCents == null) throw new Error('Unit price must be a valid amount.')
        if (!item.modelTitle.trim()) throw new Error('Each line item needs a title.')
        const qty = Math.max(1, Math.round(item.quantity || 1))
        const colors = item.colors
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean)
        const infill = item.infillPct.trim() ? Number(item.infillPct) : null
        if (infill != null && (!Number.isFinite(infill) || infill < 0 || infill > 100)) {
          throw new Error('Infill must be between 0 and 100.')
        }
        return {
          modelTitle: item.modelTitle.trim(),
          material: item.material.trim() || 'PLA',
          quantity: qty,
          unitPriceCents,
          colors: colors.length ? colors : undefined,
          finish: item.finish.trim() || undefined,
          infillPct: infill == null ? undefined : Math.round(infill),
          customNotes: item.customNotes.trim() || undefined,
        }
      })

      const discount = discountPercent.trim() ? Number(discountPercent) : undefined
      if (discount != null && (!Number.isFinite(discount) || discount < 0 || discount > 100)) {
        throw new Error('Discount percent must be between 0 and 100.')
      }
      const donatedAmountCents = toCents(donatedAmount)
      const materialCostCents = toCents(materialCost)
      const machineMinutes = machineTimeMinutes.trim() ? Number(machineTimeMinutes) : undefined
      if (donatedAmount.trim() && donatedAmountCents == null) throw new Error('Donated amount must be a valid amount.')
      if (materialCost.trim() && materialCostCents == null) throw new Error('Material cost must be a valid amount.')
      if (machineMinutes != null && (!Number.isFinite(machineMinutes) || machineMinutes < 0)) {
        throw new Error('Machine time must be a positive number of minutes.')
      }

      if (shippingMethod === 'ship') {
        if (!shippingName.trim() || !shippingLine1.trim() || !shippingCity.trim()) {
          throw new Error('Shipping name, address line 1, and city are required for shipping orders.')
        }
      }

      const res = await fetch('/api/admin/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          customerName: customerName.trim() || undefined,
          customerEmail: customerEmail.trim() || undefined,
          status,
          paymentMethod,
          shippingMethod,
          shippingAddress: shippingMethod === 'ship'
            ? {
              name: shippingName.trim(),
              line1: shippingLine1.trim(),
              line2: shippingLine2.trim() || undefined,
              city: shippingCity.trim(),
              state: shippingState.trim() || undefined,
              postalCode: shippingPostal.trim() || undefined,
              country: shippingCountry.trim() || undefined,
            }
            : undefined,
          discountPercent: discount == null ? undefined : discount,
          contributionType,
          donatedAmountCents: donatedAmountCents == null ? undefined : donatedAmountCents,
          materialCostCents: materialCostCents == null ? undefined : materialCostCents,
          machineTimeMinutes: machineMinutes == null ? undefined : Math.round(machineMinutes),
          receiptStatus,
          contributionNotes: contributionNotes.trim() || undefined,
          notes: notes.trim() || undefined,
          items: payloadItems,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to create order.')
      pushSessionNotification({
        type: 'success',
        title: 'Order created',
        message: data?.order?.orderNumber
          ? `Created MW-${String(data.order.orderNumber).padStart(5, '0')}.`
          : 'Order created successfully.',
      })
      resetForm()
      setOpen(false)
    } catch (err: any) {
      const message = err?.message || 'Unable to create order.'
      setError(message)
      pushSessionNotification({ type: 'error', title: 'Create failed', message })
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Create order</p>
          <p className="text-xs text-slate-400">Start a manual order for this customer.</p>
        </div>
        <button
          type="button"
          className="rounded-md border border-white/10 px-3 py-1.5 text-xs hover:border-white/30"
          onClick={() => setOpen((prev) => !prev)}
        >
          {open ? 'Hide' : 'New order'}
        </button>
      </div>
      {open ? (
        <form onSubmit={submitOrder} className="mt-4 space-y-4">
          {error ? (
            <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              {error}
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-xs text-slate-400">
              <span>Customer name</span>
              <input
                className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder={userName || 'Optional'}
                disabled={pending}
              />
            </label>
            <label className="space-y-1 text-xs text-slate-400">
              <span>Customer email</span>
              <input
                className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder={userEmail || 'Optional'}
                disabled={pending}
              />
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <label className="space-y-1 text-xs text-slate-400">
              <span>Status</span>
              <select
                className="w-full rounded-md border border-white/10 bg-black/40 px-2 py-2 text-sm text-white"
                value={status}
                onChange={(e) => setStatus(e.target.value as OrderStatus)}
                disabled={pending}
              >
                {ORDER_STATUS_FLOW.map((entry) => (
                  <option key={entry.key} value={entry.key}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs text-slate-400">
              <span>Payment</span>
              <select
                className="w-full rounded-md border border-white/10 bg-black/40 px-2 py-2 text-sm text-white"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}
                disabled={pending}
              >
                {PAYMENT_METHOD_OPTIONS.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs text-slate-400">
              <span>Shipping</span>
              <select
                className="w-full rounded-md border border-white/10 bg-black/40 px-2 py-2 text-sm text-white"
                value={shippingMethod}
                onChange={(e) => setShippingMethod(e.target.value as typeof shippingMethod)}
                disabled={pending}
              >
                {SHIPPING_METHODS.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs text-slate-400">
              <span>Discount %</span>
              <input
                type="number"
                min={0}
                max={100}
                step={0.01}
                className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(e.target.value)}
                placeholder="0"
                disabled={pending}
              />
            </label>
          </div>

          {shippingMethod === 'ship' ? (
            <div className="rounded-lg border border-white/10 bg-black/40 p-3 space-y-3">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Shipping address</p>
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                  placeholder="Recipient name"
                  value={shippingName}
                  onChange={(e) => setShippingName(e.target.value)}
                  disabled={pending}
                />
                <input
                  className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                  placeholder="Country"
                  value={shippingCountry}
                  onChange={(e) => setShippingCountry(e.target.value)}
                  disabled={pending}
                />
                <input
                  className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white md:col-span-2"
                  placeholder="Address line 1"
                  value={shippingLine1}
                  onChange={(e) => setShippingLine1(e.target.value)}
                  disabled={pending}
                />
                <input
                  className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white md:col-span-2"
                  placeholder="Address line 2"
                  value={shippingLine2}
                  onChange={(e) => setShippingLine2(e.target.value)}
                  disabled={pending}
                />
                <input
                  className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                  placeholder="City"
                  value={shippingCity}
                  onChange={(e) => setShippingCity(e.target.value)}
                  disabled={pending}
                />
                <input
                  className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                  placeholder="State"
                  value={shippingState}
                  onChange={(e) => setShippingState(e.target.value)}
                  disabled={pending}
                />
                <input
                  className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                  placeholder="Postal code"
                  value={shippingPostal}
                  onChange={(e) => setShippingPostal(e.target.value)}
                  disabled={pending}
                />
              </div>
            </div>
          ) : null}

          <div className="rounded-lg border border-white/10 bg-black/40 p-3 space-y-3">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Community contribution</p>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="space-y-1 text-xs text-slate-400">
                <span>Contribution type</span>
                <select
                  className="w-full rounded-md border border-white/10 bg-black/40 px-2 py-2 text-sm text-white"
                  value={contributionType}
                  onChange={(e) => setContributionType(e.target.value)}
                  disabled={pending}
                >
                  <option value="paid">Paid</option>
                  <option value="discounted">Discounted</option>
                  <option value="donated">Donated</option>
                  <option value="cost_only">Cost only</option>
                  <option value="sponsored">Sponsored</option>
                </select>
              </label>
              <label className="space-y-1 text-xs text-slate-400">
                <span>Receipt status</span>
                <select
                  className="w-full rounded-md border border-white/10 bg-black/40 px-2 py-2 text-sm text-white"
                  value={receiptStatus}
                  onChange={(e) => setReceiptStatus(e.target.value)}
                  disabled={pending}
                >
                  <option value="none">None</option>
                  <option value="requested">Requested</option>
                  <option value="received">Received</option>
                  <option value="not_eligible">Not eligible</option>
                </select>
              </label>
              <label className="space-y-1 text-xs text-slate-400">
                <span>Machine minutes</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                  value={machineTimeMinutes}
                  onChange={(e) => setMachineTimeMinutes(e.target.value)}
                  placeholder="0"
                  disabled={pending}
                />
              </label>
              <label className="space-y-1 text-xs text-slate-400">
                <span>Donated amount</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                  value={donatedAmount}
                  onChange={(e) => setDonatedAmount(e.target.value)}
                  placeholder="0.00"
                  disabled={pending}
                />
              </label>
              <label className="space-y-1 text-xs text-slate-400">
                <span>Material cost</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                  value={materialCost}
                  onChange={(e) => setMaterialCost(e.target.value)}
                  placeholder="0.00"
                  disabled={pending}
                />
              </label>
              <label className="space-y-1 text-xs text-slate-400 md:col-span-3">
                <span>Contribution notes</span>
                <textarea
                  className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                  rows={2}
                  value={contributionNotes}
                  onChange={(e) => setContributionNotes(e.target.value)}
                  placeholder="Receipt, valuation, or delivery notes"
                  disabled={pending}
                />
              </label>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Line items</p>
              <button
                type="button"
                className="rounded-md border border-white/10 px-2 py-1 text-xs hover:border-white/30"
                onClick={() => setItems((prev) => [...prev, createItem()])}
                disabled={pending}
              >
                Add item
              </button>
            </div>
            {items.map((item, index) => (
              <div key={item.id} className="rounded-lg border border-white/10 bg-black/40 p-3 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Item {index + 1}</span>
                  {items.length > 1 ? (
                    <button
                      type="button"
                      className="text-rose-300 hover:text-rose-200"
                      onClick={() => removeItem(item.id)}
                      disabled={pending}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white md:col-span-2"
                    placeholder="Item title"
                    value={item.modelTitle}
                    onChange={(e) => updateItem(item.id, { modelTitle: e.target.value })}
                    disabled={pending}
                  />
                  <select
                    className="w-full rounded-md border border-white/10 bg-black/40 px-2 py-2 text-sm text-white"
                    value={item.material}
                    onChange={(e) => updateItem(item.id, { material: e.target.value })}
                    disabled={pending}
                  >
                    {MATERIAL_OPTIONS.map((material) => (
                      <option key={material} value={material}>{material}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => updateItem(item.id, { quantity: Number(e.target.value) })}
                    disabled={pending}
                  />
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                    placeholder="Unit price"
                    value={item.unitPrice}
                    onChange={(e) => updateItem(item.id, { unitPrice: e.target.value })}
                    disabled={pending}
                  />
                  <input
                    className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                    placeholder="Colors (comma separated)"
                    value={item.colors}
                    onChange={(e) => updateItem(item.id, { colors: e.target.value })}
                    disabled={pending}
                  />
                  <select
                    className="w-full rounded-md border border-white/10 bg-black/40 px-2 py-2 text-sm text-white"
                    value={item.finish}
                    onChange={(e) => updateItem(item.id, { finish: e.target.value })}
                    disabled={pending}
                  >
                    <option value="">Finish (optional)</option>
                    {FINISH_OPTIONS.map((finish) => (
                      <option key={finish} value={finish}>{finish}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                    placeholder="Infill %"
                    value={item.infillPct}
                    onChange={(e) => updateItem(item.id, { infillPct: e.target.value })}
                    disabled={pending}
                  />
                  <input
                    className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white md:col-span-2"
                    placeholder="Custom notes"
                    value={item.customNotes}
                    onChange={(e) => updateItem(item.id, { customNotes: e.target.value })}
                    disabled={pending}
                  />
                </div>
              </div>
            ))}
          </div>

          <label className="space-y-1 text-xs text-slate-400">
            <span>Order notes</span>
            <textarea
              className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes (optional)"
              disabled={pending}
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
            <span>Subtotal: ${(subtotalCents / 100).toFixed(2)} · Total: ${(totalCents / 100).toFixed(2)}</span>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-md border border-white/10 px-3 py-1.5 text-xs"
                onClick={() => {
                  resetForm()
                  setOpen(false)
                }}
                disabled={pending}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-md border border-brand-500/60 bg-brand-500/20 px-3 py-1.5 text-xs text-white disabled:opacity-60"
                disabled={pending}
              >
                {pending ? 'Creating...' : 'Create order'}
              </button>
            </div>
          </div>
        </form>
      ) : null}
    </div>
  )
}
