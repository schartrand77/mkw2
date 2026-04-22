"use client"
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Elements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import CheckoutForm from '@/components/checkout/CheckoutForm'
import OrderSummary from '@/components/checkout/OrderSummary'
import TrustBadge from '@/components/checkout/TrustBadge'
import CheckoutMiniSummary from '@/components/checkout/CheckoutMiniSummary'
import ConfigurationCompareCard from '@/components/checkout/ConfigurationCompareCard'
import { pushSessionNotification } from '@/components/notifications/NotificationsProvider'
import { useCart } from '@/components/cart/CartProvider'
import type { CheckoutIntentResponse, CheckoutItemInput, ShippingAddress, CheckoutPaymentMethod, Dimensions, CheckoutOrganization } from '@/types/checkout'
import type { Appearance, PaymentIntent } from '@stripe/stripe-js'
import { DIMENSION_AXES, normalizeColors, resolveAxisScale, normalizeMaterialName } from '@/lib/cartPricing'
import { formatCurrency } from '@/lib/currency'
import { BRAND_LAB_NAME } from '@/lib/brand'
import StatusChip from '@/components/StatusChip'

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

type OrganizationsResponse = {
  organizations: CheckoutOrganization[]
}

export default function CheckoutPage() {
  const { items, clear, minimumOrder } = useCart()
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
  const [adminFreeConfirmation, setAdminFreeConfirmation] = useState(false)
  const [deferredInvoice, setDeferredInvoice] = useState<CheckoutIntentResponse['stripeInvoice']>(null)
  const [cashProcessing, setCashProcessing] = useState(false)
  const [finalizingJob, setFinalizingJob] = useState(false)
  const [applePayAvailable, setApplePayAvailable] = useState(false)
  const [materialWarnings, setMaterialWarnings] = useState<StockworksWarningResponse | null>(null)
  const [rush, setRush] = useState(false)
  const [rushMultiplier, setRushMultiplier] = useState(1)
  const [paymentDetails, setPaymentDetails] = useState({
    purchaseOrderNumber: '',
    billingEmail: '',
    billingContact: '',
    notes: '',
  })
  const [organizations, setOrganizations] = useState<CheckoutOrganization[]>([])
  const [organizationId, setOrganizationId] = useState('')
  const [projectCode, setProjectCode] = useState('')
  const [departmentCode, setDepartmentCode] = useState('')
  const normalizedPaymentDetails = useMemo(() => {
    const details: Record<string, string> = {}
    const purchaseOrderNumber = paymentDetails.purchaseOrderNumber.trim()
    const billingEmail = paymentDetails.billingEmail.trim()
    const billingContact = paymentDetails.billingContact.trim()
    const notes = paymentDetails.notes.trim()
    if (purchaseOrderNumber) details.purchaseOrderNumber = purchaseOrderNumber
    if (billingEmail) details.billingEmail = billingEmail
    if (billingContact) details.billingContact = billingContact
    if (notes) details.notes = notes
    return Object.keys(details).length ? details : undefined
  }, [paymentDetails])

  useEffect(() => {
    setCheckoutItemsState(items)
  }, [items])

  useEffect(() => {
    try {
      const stored = localStorage.getItem('mwv2:cart:rush')
      if (stored) setRush(stored === '1')
    } catch {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('mwv2:cart:rush', rush ? '1' : '0')
    } catch {}
  }, [rush])

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
        productTemplateId: item.options.productTemplateId || undefined,
        qty: Math.max(1, item.options.qty || 1),
        scale: uniformScale,
        scaleX: axisScales.x,
        scaleY: axisScales.y,
        scaleZ: axisScales.z,
        material: item.options.material || 'PLA',
        colors: normalizeColors(item.options.colors),
        toleranceClass: item.options.toleranceClass || 'standard',
        finish: item.options.finish || null,
        infillPct: item.options.infillPct ?? null,
        customText: item.options.customText || null,
        lockDimensions: locked,
        targetDimensions,
        priceMultiplier: item.options.priceMultiplier ?? null,
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
  const selectedOrganization = useMemo(
    () => organizations.find((entry) => entry.id === organizationId) || null,
    [organizations, organizationId],
  )

  useEffect(() => {
    if (shippingMethod === 'ship' && paymentMethod === 'cash') {
      setPaymentMethod(cardPaymentAvailable ? 'card' : 'invoice')
    }
  }, [shippingMethod, paymentMethod, cardPaymentAvailable])

  useEffect(() => {
    if (!selectedOrganization) return
    if (selectedOrganization.quoteApprovalRequired && selectedOrganization.role === 'requester' && paymentMethod !== 'quote') {
      setPaymentMethod('quote')
    }
  }, [selectedOrganization, paymentMethod])

  useEffect(() => {
    if (!selectedOrganization) {
      setDepartmentCode('')
      return
    }
    const departments = selectedOrganization.procurementConfig?.departments || []
    if (!departments.some((department) => department.code === departmentCode)) {
      setDepartmentCode('')
    }
  }, [selectedOrganization, departmentCode])

  useEffect(() => {
    let cancelled = false
    const loadKey = async () => {
      try {
        const res = await fetch('/api/public-config', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json().catch(() => null) as { stripePublishableKey?: string; rushMultiplier?: number } | null
        const runtimeKey = data?.stripePublishableKey || ''
        if (typeof data?.rushMultiplier === 'number') {
          setRushMultiplier(data.rushMultiplier)
        }
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
    if (checkoutItemsState.length > 0 && adminFreeConfirmation) {
      setAdminFreeConfirmation(false)
    }
  }, [checkoutItemsState.length, cashConfirmationId, adminFreeConfirmation])

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
    let mounted = true
    fetch('/api/customer/organizations', { cache: 'no-store' })
      .then(async (res) => (res.ok ? res.json() as Promise<OrganizationsResponse> : null))
      .then((data) => {
        if (!mounted || !data?.organizations) return
        setOrganizations(data.organizations)
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
          rush,
          paymentDetails: normalizedPaymentDetails,
          organizationId: organizationId || undefined,
          projectCode: projectCode.trim() || undefined,
          departmentCode: departmentCode.trim().toUpperCase() || undefined,
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
  }, [checkoutItems, hasMissingColors, shippingSelection, shippingAddress, shippingMethod, paymentMethod, rush, normalizedPaymentDetails, organizationId, projectCode, departmentCode])

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
        rush,
        paymentDetails: normalizedPaymentDetails,
        organizationId: organizationId || undefined,
        projectCode: projectCode.trim() || undefined,
        departmentCode: departmentCode.trim().toUpperCase() || undefined,
        commit: true,
        paymentIntentId,
      }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || 'Unable to finalize checkout.')
    }
    return res.json() as Promise<CheckoutIntentResponse>
  }, [checkoutItems, shippingSelection, rush, normalizedPaymentDetails, organizationId, projectCode, departmentCode])

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

  const handleDeferredConfirm = async () => {
    if (!checkoutItems.length) return
    if (paymentMethod === 'card' && !intent?.adminFreeCheckout) return
    setCashProcessing(true)
    setFinalizingJob(true)
    setError(null)
    try {
      const data = await finalizeJob({ method: paymentMethod })
      setCashConfirmationId(data.paymentIntentId)
      setAdminFreeConfirmation(Boolean(data.adminFreeCheckout))
      setDeferredInvoice(data.stripeInvoice || null)
      setSuccessIntent(null)
      setIntent(null)
      clear()
      const label = data.adminFreeCheckout
        ? 'Admin free order placed'
        : paymentMethod === 'cash'
        ? 'Cash order placed'
        : paymentMethod === 'invoice'
          ? 'Invoice request sent'
          : paymentMethod === 'po'
            ? 'PO request sent'
            : 'Quote request sent'
      pushSessionNotification({
        type: 'success',
        title: label,
        message: data.stripeInvoice?.hostedInvoiceUrl
          ? `Invoice sent: ${data.stripeInvoice.invoiceId}`
          : `Confirmation: ${data.paymentIntentId}`,
      })
    } catch (err: any) {
      const msg = err.message || 'Unable to submit order.'
      setError(msg)
      pushSessionNotification({ type: 'error', title: 'Order failed', message: msg })
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

  const isInvoicePayment = paymentMethod === 'invoice'
  const isPoPayment = paymentMethod === 'po'
  const isQuotePayment = paymentMethod === 'quote'
  const isDeferredPayment = paymentMethod !== 'card'
  const isAdminFreeCheckout = Boolean(intent?.adminFreeCheckout)
  const trustBadgeProviders = !isAdminFreeCheckout && paymentMethod === 'card' && cardPaymentAvailable
    ? (applePayAvailable ? ['Stripe', 'Apple Pay'] : ['Stripe'])
    : []
  const trustBadgeNote = isAdminFreeCheckout
    ? 'Admin free checkout: this order skips payment processing and still enters the job queue.'
    : paymentMethod === 'cash'
    ? 'No card details are required for cash orders.'
    : paymentMethod === 'invoice'
      ? 'We will invoice you before production begins.'
      : paymentMethod === 'po'
        ? 'Provide a PO and we will confirm before printing.'
        : paymentMethod === 'quote'
          ? 'Submit a quote request and approve it before production.'
          : 'Card details are encrypted and handled by the payment processor.'
  const intentSubtotal = intent?.lineItems?.reduce((sum, item) => sum + (item.lineTotal || 0), 0) ?? null
  const estimatedTotal = typeof intent?.estimatedTotal === 'number' && Number.isFinite(intent.estimatedTotal)
    ? intent.estimatedTotal
    : null
  const minimumOrderSubtotal = typeof minimumOrder.subtotal === 'number' && Number.isFinite(minimumOrder.subtotal)
    ? minimumOrder.subtotal
    : null
  const meetsMinimumOrder = isAdminFreeCheckout || !minimumOrderSubtotal || (intentSubtotal != null && intentSubtotal >= minimumOrderSubtotal)
  const disableFinalize = hasMissingColors || !meetsMinimumOrder

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
                <div key={item.cartItemId} className="px-4 py-3 flex items-center justify-between text-sm">
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
                    onClick={() => setCheckoutItemsState((prev) => prev.filter((entry) => entry.cartItemId !== item.cartItemId))}
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
            <h2 className="text-lg font-semibold">Organization billing</h2>
            <span className="text-xs text-slate-500">Optional</span>
          </div>
          <div className="space-y-2 text-sm">
            <label className="block text-xs text-slate-400">Bill this order to</label>
            <select
              className="input"
              value={organizationId}
              onChange={(e) => setOrganizationId(e.target.value)}
            >
              <option value="">Personal account</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name} ({org.role})
                </option>
              ))}
            </select>
          </div>
          {selectedOrganization ? (
            <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-xs text-slate-300 space-y-1">
              <div>Role: <span className="uppercase tracking-wide">{selectedOrganization.role}</span></div>
              {selectedOrganization.quoteApprovalRequired && selectedOrganization.role === 'requester' ? (
                <div className="text-amber-200">Requester role must submit as quote for approver review.</div>
              ) : null}
              {typeof selectedOrganization.requirePoAboveCents === 'number' && selectedOrganization.requirePoAboveCents > 0 ? (
                <div>PO number required for orders above {formatCurrency(selectedOrganization.requirePoAboveCents / 100)}.</div>
              ) : null}
              <input
                className="input text-xs mt-2"
                placeholder="Project code (optional)"
                value={projectCode}
                onChange={(e) => setProjectCode(e.target.value)}
              />
              {selectedOrganization.procurementConfig?.departments?.length ? (
                <>
                  <select
                    className="input text-xs mt-2"
                    value={departmentCode}
                    onChange={(e) => setDepartmentCode(e.target.value)}
                  >
                    <option value="">Department (optional)</option>
                    {selectedOrganization.procurementConfig.departments.map((department) => (
                      <option key={department.code} value={department.code}>
                        {department.code} - {department.name}
                      </option>
                    ))}
                  </select>
                  {departmentCode ? (
                    <div className="text-[11px] text-slate-400 mt-1">
                      Department spend will roll into organization budget tracking and approval routing.
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="glass rounded-xl border border-white/10 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Shipping</h2>
            <Link href="/settings/profile" className="text-xs text-brand-400 hover:text-brand-300 underline underline-offset-4">Edit profile</Link>
          </div>
          {!shippingAddress && (
            <p className="text-xs text-amber-300">
              No shipping address on file.{' '}
              <Link href="/settings/profile" className="text-brand-300 hover:text-brand-200 underline underline-offset-4">
                Add one in Settings {'->'} Profile
              </Link>
              .
            </p>
          )}
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
              <p className="text-xs text-amber-300">
                Add your shipping address under{' '}
                <Link href="/settings/profile" className="text-brand-300 hover:text-brand-200 underline underline-offset-4">
                  Settings {'->'} Profile
                </Link>{' '}
                to enable shipping.
              </p>
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
                disabled={!cardPaymentAvailable || Boolean(selectedOrganization?.quoteApprovalRequired && selectedOrganization.role === 'requester')}
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
                disabled={shippingMethod !== 'pickup' || Boolean(selectedOrganization?.quoteApprovalRequired && selectedOrganization.role === 'requester')}
              />
              Pay cash at pickup
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="payment"
                value="invoice"
                checked={paymentMethod === 'invoice'}
                onChange={() => setPaymentMethod('invoice')}
                disabled={Boolean(selectedOrganization?.quoteApprovalRequired && selectedOrganization.role === 'requester')}
              />
              Invoice me
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="payment"
                value="po"
                checked={paymentMethod === 'po'}
                onChange={() => setPaymentMethod('po')}
                disabled={Boolean(selectedOrganization?.quoteApprovalRequired && selectedOrganization.role === 'requester')}
              />
              Purchase order (PO)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="payment"
                value="quote"
                checked={paymentMethod === 'quote'}
                onChange={() => setPaymentMethod('quote')}
              />
              Request quote approval
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
          {isDeferredPayment && (
            <div className="mt-3 rounded-lg border border-white/10 bg-black/30 p-3 space-y-2 text-xs text-slate-300">
              {(isInvoicePayment || isPoPayment) && (
                <>
                  <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Billing details</div>
                  <input
                    className="input text-xs"
                    placeholder="Billing contact name"
                    value={paymentDetails.billingContact}
                    onChange={(e) => setPaymentDetails((prev) => ({ ...prev, billingContact: e.target.value }))}
                  />
                  <input
                    className="input text-xs"
                    placeholder="Billing email"
                    type="email"
                    value={paymentDetails.billingEmail}
                    onChange={(e) => setPaymentDetails((prev) => ({ ...prev, billingEmail: e.target.value }))}
                  />
                </>
              )}
              {isPoPayment && (
                <input
                  className="input text-xs"
                  placeholder="PO number"
                  value={paymentDetails.purchaseOrderNumber}
                  onChange={(e) => setPaymentDetails((prev) => ({ ...prev, purchaseOrderNumber: e.target.value }))}
                />
              )}
              {isQuotePayment && (
                <>
                  <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Quote notes</div>
                  <textarea
                    className="input text-xs min-h-[80px]"
                    placeholder="Share any deadlines or requirements."
                    value={paymentDetails.notes}
                    onChange={(e) => setPaymentDetails((prev) => ({ ...prev, notes: e.target.value }))}
                  />
                </>
              )}
            </div>
          )}
        </div>
        <div className="glass rounded-xl border border-white/10 p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Production priority</h2>
          </div>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Rush production</span>
            <input
              type="checkbox"
              checked={rush}
              onChange={(e) => setRush(e.target.checked)}
            />
          </label>
          <p className="text-xs text-slate-400">
            Rush adds {Math.max(0, Math.round((rushMultiplier - 1) * 100))}% to prioritize your print in the queue.
          </p>
        </div>
        {intent && (
          <OrderSummary
            items={intent.lineItems}
            currency={intent.currency}
            total={intent.total}
            discount={intent.discount}
            shippingRate={intent.shippingRate}
          />
        )}
        {isAdminFreeCheckout && intent && (
          <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm space-y-1">
            <p className="font-semibold text-emerald-200">Admin free checkout</p>
            <p className="text-emerald-100">Payment is bypassed for this admin order. It still goes through queue and inventory tracking.</p>
            {estimatedTotal != null && (
              <p className="text-xs text-emerald-100/90">
                Estimated standard total (reference): {formatCurrency(estimatedTotal, intent.currency)}
              </p>
            )}
          </div>
        )}
        {(loading || finalizingJob) && (
          <div className="flex flex-wrap gap-2">
            {loading && (
              <StatusChip
                label={paymentMethod === 'card' && !isAdminFreeCheckout ? 'Preparing secure payment' : 'Preparing order'}
                tone="info"
                pulse
              />
            )}
            {finalizingJob && <StatusChip label="Finalizing order" tone="warning" pulse />}
          </div>
        )}
        {error && <p className="text-sm text-amber-300">{error}</p>}
        {!meetsMinimumOrder && minimumOrderSubtotal && (
          <p className="text-sm text-amber-300">
            Minimum order subtotal is {formatCurrency(minimumOrderSubtotal)}.
            {minimumOrder.notes ? ` ${minimumOrder.notes}` : ''}
          </p>
        )}
        {(successIntent || cashConfirmationId) && (
          <div className="glass rounded-xl border border-emerald-500/30 p-4 text-sm">
            <p className="font-semibold text-emerald-300">
              {adminFreeConfirmation
                ? 'Admin free order placed!'
                : successIntent
                ? 'Payment received!'
                : paymentMethod === 'cash'
                  ? 'Cash order placed!'
                  : paymentMethod === 'invoice'
                    ? 'Invoice request sent!'
                    : paymentMethod === 'po'
                      ? 'PO request sent!'
                      : 'Quote request sent!'}
            </p>
            <p>Confirmation: {successIntent ? successIntent.id : cashConfirmationId}</p>
            {deferredInvoice?.hostedInvoiceUrl ? (
              <a href={deferredInvoice.hostedInvoiceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block underline underline-offset-4">
                Open invoice
              </a>
            ) : null}
          </div>
        )}
      </div>
      <div className="glass rounded-2xl border border-white/10 p-6 space-y-4 self-start md:sticky md:top-24">
        {intent ? (
          <CheckoutMiniSummary
            items={intent.lineItems}
            currency={intent.currency}
            total={intent.total}
            shippingAmount={intent.shippingRate?.amount ?? null}
          />
        ) : null}
        {intent ? <ConfigurationCompareCard items={intent.lineItems} currency={intent.currency} /> : null}
        <TrustBadge
          providers={trustBadgeProviders}
          note={trustBadgeNote}
        />
        {!intent && !loading && !successIntent && !cashConfirmationId && (
          <p className="text-sm text-slate-400">Add items to your cart to start checkout.</p>
        )}
        {paymentMethod === 'card' && intent?.clientSecret && stripePromise && !successIntent && meetsMinimumOrder && (
          <Elements stripe={stripePromise} options={{ clientSecret: intent.clientSecret, appearance }}>
            <CheckoutForm amount={intent.amount} currency={intent.currency} clientSecret={intent.clientSecret} onSuccess={handleSuccess} />
          </Elements>
        )}
        {paymentMethod === 'card' && !meetsMinimumOrder && !isAdminFreeCheckout && (
          <p className="text-sm text-amber-300">
            Minimum order subtotal is {formatCurrency(minimumOrderSubtotal || 0)}.
          </p>
        )}
        {paymentMethod === 'card' && !isAdminFreeCheckout && (!stripePromise || !cardPaymentAvailable) && (
          <p className="text-sm text-amber-300">Stripe publishable key is not configured. Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to enable card payments.</p>
        )}
        {isAdminFreeCheckout && intent && !cashConfirmationId && !successIntent && (
          <div className="space-y-3 text-sm text-slate-300">
            <p>No payment step is required for this admin checkout. Confirm to send it to the queue.</p>
            {estimatedTotal != null && (
              <p className="text-xs text-slate-400">
                Estimated standard total: {formatCurrency(estimatedTotal, intent.currency)}
              </p>
            )}
            <button
              type="button"
              onClick={handleDeferredConfirm}
              disabled={cashProcessing || finalizingJob || disableFinalize}
              className="btn w-full justify-center disabled:opacity-60"
            >
              {cashProcessing ? 'Submitting...' : 'Confirm admin free order'}
            </button>
          </div>
        )}
        {paymentMethod !== 'card' && intent && !cashConfirmationId && !isAdminFreeCheckout && (
          <div className="space-y-3 text-sm text-slate-300">
            <p>
              {paymentMethod === 'cash'
                ? `Bring exact cash to ${BRAND_LAB_NAME} when you pick up your order.`
                : paymentMethod === 'invoice'
                  ? 'We will review your request and send an invoice before production.'
                  : paymentMethod === 'po'
                    ? 'We will review the PO details and confirm before production.'
                    : 'Submit your quote request and approve it before production.'}
            </p>
            <button
              type="button"
              onClick={handleDeferredConfirm}
              disabled={cashProcessing || finalizingJob || disableFinalize}
              className="btn w-full justify-center disabled:opacity-60"
            >
              {cashProcessing
                ? 'Submitting...'
                : paymentMethod === 'cash'
                  ? 'Confirm cash order'
                  : paymentMethod === 'invoice'
                    ? 'Submit invoice request'
                    : paymentMethod === 'po'
                      ? 'Submit PO request'
                      : 'Request quote'}
            </button>
            {!meetsMinimumOrder && minimumOrderSubtotal && (
              <p className="text-xs text-amber-300">
                Minimum order subtotal is {formatCurrency(minimumOrderSubtotal)}.
                {minimumOrder.notes ? ` ${minimumOrder.notes}` : ''}
              </p>
            )}
          </div>
        )}
        {(successIntent || cashConfirmationId) && (
          <p className="text-sm text-slate-300">You can close this tab or continue browsing models.</p>
        )}
      </div>
    </div>
  )
}

