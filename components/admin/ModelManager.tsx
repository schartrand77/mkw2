"use client"
import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { buildImageSrc } from '@/lib/public-path'
import { useCart } from '@/components/cart/CartProvider'
import { buildAdminCheckoutCartItem } from '@/lib/admin-checkout-cart'
import { IMAGE_ACCEPT_ATTRIBUTE } from '@/lib/images'
import { MATERIAL_OPTIONS, normalizeMaterialName } from '@/lib/cartPricing'
import ModelImagesManager from '@/components/ModelImagesManager'
import ModelRevisionsManager from '@/components/ModelRevisionsManager'

type Model = {
  id: string
  title: string
  description?: string | null
  coverImagePath?: string | null
  coverImageStatus?: string | null
  creditName?: string | null
  creditUrl?: string | null
  updatedAt?: string | null
  visibility: string
  priceUsd?: number | null
  salePriceUsd?: number | null
  material?: string | null
  sizeXmm?: number | null
  sizeYmm?: number | null
  sizeZmm?: number | null
  salePriceIsFrom?: boolean | null
  salePriceUnit?: string | null
  disableCustomerDiscounts?: boolean | null
  flatRatePricing?: boolean | null
  colorSlotCount?: number | null
  allowedColors?: string[] | null
  defaultColors?: string[] | null
  tags: string[]
  affiliateTitle?: string | null
  affiliateUrl?: string | null
  videoEmbedId?: string | null
  videoUrl?: string
}

function PaginationControls({
  page,
  totalPages,
  onFirst,
  onPrev,
  onNext,
  onLast,
}: {
  page: number
  totalPages: number
  onFirst: () => void
  onPrev: () => void
  onNext: () => void
  onLast: () => void
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <button className="px-2 py-1 rounded-md border border-white/10 disabled:opacity-40" onClick={onFirst} disabled={page <= 1}>
        « First
      </button>
      <button className="px-2 py-1 rounded-md border border-white/10 disabled:opacity-40" onClick={onPrev} disabled={page <= 1}>
        ‹ Prev
      </button>
      <div className="px-2 py-1 rounded-md border border-white/10 text-slate-300">
        Page {page} / {totalPages}
      </div>
      <button className="px-2 py-1 rounded-md border border-white/10 disabled:opacity-40" onClick={onNext} disabled={page >= totalPages}>
        Next ›
      </button>
      <button className="px-2 py-1 rounded-md border border-white/10 disabled:opacity-40" onClick={onLast} disabled={page >= totalPages}>
        Last »
      </button>
    </div>
  )
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">{children}</label>
}

function CheckboxField({
  id,
  checked,
  onChange,
  children,
}: {
  id: string
  checked: boolean
  onChange: (checked: boolean) => void
  children: ReactNode
}) {
  return (
    <label htmlFor={id} className="flex items-start gap-2 rounded-md border border-white/10 bg-black/10 px-3 py-2 text-sm text-slate-300">
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="leading-snug">{children}</span>
    </label>
  )
}

type Props = {
  initialQuery?: string
  initialModelId?: string
}

export default function ModelManager({ initialQuery = '', initialModelId = '' }: Props) {
  const router = useRouter()
  const { add } = useCart()
  const [query, setQuery] = useState(initialQuery)
  const [items, setItems] = useState<Model[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pageSize, setPageSize] = useState(12)
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(initialModelId || null)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [removeCover, setRemoveCover] = useState(false)

  useEffect(() => {
    let active = true
    const run = async () => {
      setLoading(true)
      try {
        const modelParam = initialModelId ? `&modelId=${encodeURIComponent(initialModelId)}` : ''
        const res = await fetch(`/api/admin/models?q=${encodeURIComponent(query)}&page=${page}&pageSize=${pageSize}${modelParam}`)
        if (!res.ok) return
        const data = await res.json()
        if (active) {
          const normalized = data.models.map((m: Model) => ({
            ...m,
            salePriceIsFrom: Boolean((m as any).salePriceIsFrom),
            salePriceUnit: (m as any).salePriceUnit ?? null,
            disableCustomerDiscounts: Boolean((m as any).disableCustomerDiscounts),
            flatRatePricing: Boolean((m as any).flatRatePricing),
            colorSlotCount: typeof (m as any).colorSlotCount === 'number' ? (m as any).colorSlotCount : null,
            allowedColors: Array.isArray((m as any).allowedColors) ? (m as any).allowedColors : null,
            videoUrl: m.videoEmbedId ? `https://youtu.be/${m.videoEmbedId}` : ''
          }))
          setItems(normalized)
          setTotal(data.total)
          setPage(data.page)
          setPageSize(data.pageSize)
        }
      } finally { setLoading(false) }
    }
    const t = setTimeout(run, 250)
    return () => { active = false; clearTimeout(t) }
  }, [query, page, pageSize, initialModelId])

  useEffect(() => {
    if (initialModelId) setActiveId(initialModelId)
  }, [initialModelId])

  useEffect(() => {
    if (activeId && !loading && items.length > 0 && !items.find((m) => m.id === activeId)) setActiveId(null)
  }, [items, activeId, loading])

  useEffect(() => {
    setCoverFile(null)
    setRemoveCover(false)
  }, [activeId])

  const updateModel = (id: string, patch: Partial<Model>) => {
    setItems(prev => prev.map((m) => m.id === id ? { ...m, ...patch } : m))
  }

  const saveRow = async (m: Model) => {
    setSavingId(m.id)
    try {
      const res = await fetch(`/api/admin/models/${m.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visibility: m.visibility,
          title: m.title,
          description: m.description ?? '',
          material: m.material || 'PLA',
          creditName: m.creditName ?? '',
          creditUrl: m.creditUrl ?? '',
          tags: m.tags.join(','),
          affiliateTitle: m.affiliateTitle ?? '',
          affiliateUrl: m.affiliateUrl ?? '',
          videoUrl: m.videoUrl ?? '',
          salePriceUsd: (m as any).salePriceUsd ?? null,
          salePriceIsFrom: Boolean(m.salePriceIsFrom),
          salePriceUnit: m.salePriceUnit || '',
          disableCustomerDiscounts: Boolean(m.disableCustomerDiscounts),
          flatRatePricing: Boolean(m.flatRatePricing),
          colorSlotCount: m.colorSlotCount ?? null,
          allowedColors: Array.isArray(m.allowedColors) ? m.allowedColors : null,
        })
      })
      if (!res.ok) alert('Failed to save model: ' + (await res.text()))
      if (res.ok && (coverFile || removeCover)) {
        const fd = new FormData()
        fd.append('removeCover', removeCover ? '1' : '0')
        if (coverFile) fd.append('cover', coverFile)
        const coverRes = await fetch(`/api/models/${m.id}`, { method: 'PATCH', body: fd })
        if (!coverRes.ok) {
          const body = await coverRes.json().catch(() => ({}))
          alert('Failed to update cover: ' + (body.error || coverRes.statusText))
        } else {
          const body = await coverRes.json().catch(() => ({}))
          if (body?.model) {
            updateModel(m.id, {
              coverImagePath: body.model.coverImagePath,
              coverImageStatus: body.model.coverImageStatus,
              updatedAt: body.model.updatedAt,
            })
            setCoverFile(null)
            setRemoveCover(false)
          }
        }
      }
    } finally {
      setSavingId((current) => current === m.id ? null : current)
    }
  }

  const deleteRow = async (id: string) => {
    const target = items.find((m) => m.id === id)
    const title = target?.title || 'this model'
    if (!confirm(`Permanently delete "${title}"? This cannot be undone.`)) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/admin/models/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const msg = await res.text()
        throw new Error(msg || 'Failed to delete model')
      }
      setItems((prev) => prev.filter((m) => m.id !== id))
      setTotal((prev) => Math.max(0, prev - 1))
      if (activeId === id) setActiveId(null)
    } catch (err: any) {
      console.error('Failed to delete model', err)
      alert(err?.message || 'Failed to delete model')
    } finally {
      setDeletingId((current) => (current === id ? null : current))
    }
  }

  const sendToCheckout = (model: Model) => {
    const { options, ...cartItem } = buildAdminCheckoutCartItem(model)
    add(cartItem, options)
    router.push('/checkout')
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const activeModel = activeId ? items.find((m) => m.id === activeId) || null : null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Model manager</h2>
          <p className="text-sm text-slate-400">Find a model, then edit catalog details, pricing, photos, and revisions in one place.</p>
        </div>
        {activeModel && (
          <button className="px-3 py-2 rounded-md border border-white/10 hover:border-white/20 text-sm" onClick={() => setActiveId(null)}>
            Back to list
          </button>
        )}
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <input className="input flex-1" placeholder="Search models..." value={query} onChange={(e) => { setQuery(e.target.value); setPage(1) }} />
        <label className="text-sm text-slate-400 flex items-center gap-2">
          Page size
          <select
            className="input w-28"
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
          >
            {[12, 24, 36, 48].map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </label>
      </div>
      {loading && <div className="text-slate-400 text-sm">Loading...</div>}

      {!activeModel && (
        <>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div className="text-xs uppercase tracking-[0.3em] text-slate-500">Results</div>
              {totalPages > 1 && (
                <PaginationControls
                  page={page}
                  totalPages={totalPages}
                  onFirst={() => setPage(1)}
                  onPrev={() => setPage((p) => Math.max(1, p - 1))}
                  onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
                  onLast={() => setPage(totalPages)}
                />
              )}
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map((m) => (
                <div
                  key={m.id}
                  className="rounded-lg border border-white/10 bg-slate-900/40 transition-colors hover:border-white/20"
                >
                  <button
                    type="button"
                    className="flex w-full items-start gap-3 p-3 text-left"
                    onClick={() => setActiveId(m.id)}
                  >
                    {m.coverImagePath ? (
                      <img
                        src={buildImageSrc(m.coverImagePath, m.updatedAt) || `/files${m.coverImagePath}`}
                        className="w-16 h-12 object-cover rounded border border-white/10"
                        alt={`${m.title} cover`}
                      />
                    ) : (
                      <div className="w-16 h-12 bg-slate-900/60 rounded border border-white/10" />
                    )}
                    <div className="flex-1 space-y-1">
                      <div className="font-semibold text-sm">{m.title}</div>
                      <div className="text-xs uppercase tracking-wide text-slate-400">{m.visibility}</div>
                      {m.tags?.length > 0 && <div className="text-xs text-slate-400 truncate">{m.tags.join(', ')}</div>}
                    </div>
                  </button>
                  {m.visibility === 'unlisted' && (
                    <div className="border-t border-white/10 px-3 py-2">
                      <button
                        type="button"
                        className="w-full rounded-md border border-brand-500/50 bg-brand-500/15 px-3 py-2 text-sm text-brand-100 hover:border-brand-400/70 hover:bg-brand-500/25"
                        onClick={() => sendToCheckout(m)}
                      >
                        Send to checkout
                      </button>
                    </div>
                  )}
                  </div>
              ))}
              {!loading && items.length === 0 && (
                <div className="col-span-full text-slate-400 text-sm">No models found.</div>
              )}
            </div>
            {totalPages > 1 && (
              <div className="flex justify-center">
                <PaginationControls
                  page={page}
                  totalPages={totalPages}
                  onFirst={() => setPage(1)}
                  onPrev={() => setPage((p) => Math.max(1, p - 1))}
                  onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
                  onLast={() => setPage(totalPages)}
                />
              </div>
            )}
          </div>
        </>
      )}

      {activeModel && (
        <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4 shadow-[0_18px_45px_rgba(0,0,0,0.22)]">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="shrink-0">
                  {activeModel.coverImagePath ? (
                    <img src={buildImageSrc(activeModel.coverImagePath, activeModel.updatedAt) || `/files${activeModel.coverImagePath}`} className="h-16 w-20 rounded border border-white/10 object-cover" alt={`${activeModel.title} cover`} />
                  ) : (
                    <div className="h-16 w-20 rounded border border-white/10 bg-slate-900/60" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold">{activeModel.title}</div>
                  <div className="break-all text-xs text-slate-400">{activeModel.id}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Auto estimate {activeModel.priceUsd != null ? `$${Number(activeModel.priceUsd).toFixed(2)}` : 'not available'}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
                <button className="btn min-w-28 disabled:cursor-not-allowed disabled:opacity-50" onClick={() => saveRow(activeModel)} disabled={savingId === activeModel.id}>
                  {savingId === activeModel.id ? 'Saving...' : 'Save'}
                </button>
                <button
                  className="btn min-w-28 bg-red-600 hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => deleteRow(activeModel.id)}
                  disabled={deletingId === activeModel.id}
                >
                  {deletingId === activeModel.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>

            <section className="grid gap-3 rounded-lg border border-white/10 bg-black/10 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,18rem)]">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-200">Model details</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <FieldLabel>Title</FieldLabel>
                    <input
                      className="input w-full"
                      value={activeModel.title}
                      onChange={(e) => updateModel(activeModel.id, { title: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel>Material</FieldLabel>
                    <select
                      className="input w-full"
                      value={normalizeMaterialName(activeModel.material)}
                      onChange={(e) => updateModel(activeModel.id, { material: e.target.value })}
                    >
                      {(() => {
                        const normalized = normalizeMaterialName(activeModel.material)
                        const options = MATERIAL_OPTIONS.map((option) => String(option))
                        if (!options.includes(normalized)) options.push(normalized)
                        return options.map((option) => <option key={option} value={option}>{option}</option>)
                      })()}
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Description</FieldLabel>
                  <textarea
                    className="input h-28 w-full"
                    value={activeModel.description || ''}
                    onChange={(e) => updateModel(activeModel.id, { description: e.target.value })}
                    placeholder="Describe the model, print notes, and customer-facing details."
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <FieldLabel>Credit model creator</FieldLabel>
                    <input
                      className="input w-full"
                      value={activeModel.creditName || ''}
                      onChange={(e) => updateModel(activeModel.id, { creditName: e.target.value })}
                      placeholder="Creator name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel>Credit URL</FieldLabel>
                    <input
                      className="input w-full"
                      type="url"
                      value={activeModel.creditUrl || ''}
                      onChange={(e) => updateModel(activeModel.id, { creditUrl: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-200">Cover</h3>
                {activeModel.coverImagePath ? (
                  <img
                    src={buildImageSrc(activeModel.coverImagePath, activeModel.updatedAt) || `/files${activeModel.coverImagePath}`}
                    className="aspect-[4/3] w-full rounded-md border border-white/10 object-cover"
                    alt={`${activeModel.title} cover`}
                  />
                ) : (
                  <div className="flex aspect-[4/3] w-full items-center justify-center rounded-md border border-white/10 bg-slate-900/60 text-xs text-slate-500">
                    No cover
                  </div>
                )}
                <div className="space-y-2 text-sm">
                  <input type="file" accept={IMAGE_ACCEPT_ATTRIBUTE} onChange={(e) => setCoverFile(e.target.files?.[0] || null)} />
                  <CheckboxField id={`remove-cover-${activeModel.id}`} checked={removeCover} onChange={setRemoveCover}>
                    Remove existing cover
                  </CheckboxField>
                  {coverFile && <div className="text-xs text-slate-400">Pending cover: {coverFile.name}</div>}
                  {activeModel.coverImageStatus === 'processing' && <div className="text-xs text-amber-300">Cover processing</div>}
                </div>
              </div>
            </section>

            <div className="grid gap-4 xl:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <section className="space-y-3 rounded-lg border border-white/10 bg-black/10 p-3">
                <h3 className="text-sm font-semibold text-slate-200">Listing</h3>
                <div className="space-y-1.5">
                  <FieldLabel>Visibility</FieldLabel>
                  <select className="input w-full" value={activeModel.visibility} onChange={(e) => updateModel(activeModel.id, { visibility: e.target.value })}>
                    <option value="public">Public - Discover and checkout</option>
                    <option value="unlisted">Unlisted - direct checkout only</option>
                    <option value="private">Private - restricted</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Tags</FieldLabel>
                  <input
                    className="input w-full"
                    value={activeModel.tags.join(', ')}
                    onChange={(e) => updateModel(activeModel.id, { tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                    placeholder="home, decor, Japanese"
                  />
                </div>
              </section>

              <section className="space-y-3 rounded-lg border border-white/10 bg-black/10 p-3">
                <h3 className="text-sm font-semibold text-slate-200">Pricing</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <FieldLabel>Sale price</FieldLabel>
                    <input
                      className="input w-full"
                      type="number"
                      step="0.01"
                      value={activeModel.salePriceUsd ?? ''}
                      onChange={(e) => updateModel(activeModel.id, { salePriceUsd: e.target.value === '' ? null : Number(e.target.value) })}
                      placeholder="Blank = automatic"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel>Unit label</FieldLabel>
                    <select
                      className="input w-full"
                      value={activeModel.salePriceUnit || ''}
                      onChange={(e) => updateModel(activeModel.id, { salePriceUnit: e.target.value || null })}
                    >
                      <option value="">No unit</option>
                      <option value="ea">ea</option>
                      <option value="bx">bx</option>
                      <option value="complete">complete</option>
                    </select>
                  </div>
                </div>
                <CheckboxField
                  id={`sale-from-${activeModel.id}`}
                  checked={!!activeModel.salePriceIsFrom}
                  onChange={(checked) => updateModel(activeModel.id, { salePriceIsFrom: checked })}
                >
                  Prefix price with "From"
                </CheckboxField>
                <div className="rounded-md border border-white/10 bg-slate-950/40 px-3 py-2 text-xs text-slate-400">
                  Current displayed price: <span className="font-medium text-slate-200">
                    {activeModel.salePriceUsd != null
                      ? `$${Number(activeModel.salePriceUsd).toFixed(2)}`
                      : activeModel.priceUsd != null
                        ? `$${Number(activeModel.priceUsd).toFixed(2)}`
                        : 'No estimate'}
                  </span>
                </div>
              </section>

              <section className="space-y-3 rounded-lg border border-white/10 bg-black/10 p-3">
                <h3 className="text-sm font-semibold text-slate-200">Checkout rules</h3>
                <CheckboxField
                  id={`model-discount-off-${activeModel.id}`}
                  checked={!!activeModel.disableCustomerDiscounts}
                  onChange={(checked) => updateModel(activeModel.id, { disableCustomerDiscounts: checked })}
                >
                  Disable customer discounts for this model
                </CheckboxField>
                <CheckboxField
                  id={`model-flat-rate-${activeModel.id}`}
                  checked={!!activeModel.flatRatePricing}
                  onChange={(checked) => updateModel(activeModel.id, { flatRatePricing: checked })}
                >
                  Flat rate: no color-count or custom-text surcharge
                </CheckboxField>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <FieldLabel>Color slots</FieldLabel>
                    <input
                      className="input w-full"
                      type="number"
                      min={1}
                      max={16}
                      value={activeModel.colorSlotCount ?? ''}
                      placeholder="Global default"
                      onChange={(e) => updateModel(activeModel.id, {
                        colorSlotCount: e.target.value === ''
                          ? null
                          : Math.max(1, Math.min(16, Math.round(Number(e.target.value) || 1))),
                      })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel>Allowed colors</FieldLabel>
                    <input
                      className="input w-full"
                      value={Array.isArray(activeModel.allowedColors) ? activeModel.allowedColors.join(', ') : ''}
                      placeholder="Blank/all/* = all"
                      onChange={(e) => {
                        const raw = e.target.value.trim()
                        if (!raw || /^(all|\*)$/i.test(raw)) {
                          updateModel(activeModel.id, { allowedColors: null })
                          return
                        }
                        updateModel(activeModel.id, {
                          allowedColors: Array.from(new Set(raw.split(',').map((part) => part.trim()).filter(Boolean))),
                        })
                      }}
                    />
                  </div>
                </div>
              </section>
            </div>

            <section className="grid gap-3 rounded-lg border border-white/10 bg-black/10 p-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <FieldLabel>Affiliate label</FieldLabel>
                <input
                  className="input w-full"
                  placeholder="Springs kit"
                  value={activeModel.affiliateTitle || ''}
                  onChange={(e) => updateModel(activeModel.id, { affiliateTitle: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Affiliate URL</FieldLabel>
                <input
                  className="input w-full"
                  placeholder="https://..."
                  value={activeModel.affiliateUrl || ''}
                  onChange={(e) => updateModel(activeModel.id, { affiliateUrl: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <FieldLabel>YouTube video</FieldLabel>
                <input
                  className="input w-full"
                  placeholder="YouTube URL or video ID"
                  value={activeModel.videoUrl || ''}
                  onChange={(e) => updateModel(activeModel.id, { videoUrl: e.target.value })}
                />
              </div>
            </section>

            <details className="rounded-lg border border-white/10 bg-black/10 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-slate-200">Real-life photos</summary>
              <div className="mt-3">
                <ModelImagesManager modelId={activeModel.id} initialCover={activeModel.coverImagePath} resourceBase="/api/admin/models" />
              </div>
            </details>

            <details className="rounded-lg border border-white/10 bg-black/10 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-slate-200">Model revisions</summary>
              <div className="mt-3">
                <ModelRevisionsManager modelId={activeModel.id} />
              </div>
            </details>
          </div>
        </div>
      )}
    </div>
  )
}
