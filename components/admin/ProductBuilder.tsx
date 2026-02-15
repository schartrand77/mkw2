"use client"

import { useMemo, useState } from 'react'
import { formatCurrency } from '@/lib/currency'

type ModelSummary = {
  id: string
  title: string
  priceUsd: number | null
  effectivePriceUsd: number | null
  salePriceUsd: number | null
  material: string | null
  volumeMm3: number | null
  sizeXmm: number | null
  sizeYmm: number | null
  sizeZmm: number | null
}

type OptionRow = {
  label: string
  value?: string
  scale?: number
  colorCount?: number
  priceMultiplier?: number
}

type ProductTemplate = {
  id: string
  title: string
  description: string | null
  baseModelId: string | null
  materialOptions: OptionRow[] | null
  colorOptions: OptionRow[] | null
  sizeOptions: OptionRow[] | null
  isActive: boolean
  baseModel?: { id: string; title: string } | null
}

type Props = {
  initialProducts: ProductTemplate[]
  models: ModelSummary[]
}

const emptyProduct = (): ProductTemplate => ({
  id: '',
  title: '',
  description: '',
  baseModelId: null,
  materialOptions: [],
  colorOptions: [],
  sizeOptions: [],
  isActive: true,
})

export default function ProductBuilder({ initialProducts, models }: Props) {
  const [products, setProducts] = useState<ProductTemplate[]>(initialProducts)
  const [activeId, setActiveId] = useState<string>(initialProducts[0]?.id || '')
  const [form, setForm] = useState<ProductTemplate>(() => {
    const first = initialProducts[0]
    return first ? { ...first } : emptyProduct()
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selectedModel = useMemo(
    () => models.find((m) => m.id === form.baseModelId) || null,
    [models, form.baseModelId],
  )

  const basePrice = selectedModel
    ? (selectedModel.salePriceUsd ?? selectedModel.effectivePriceUsd ?? selectedModel.priceUsd ?? null)
    : null

  const selectProduct = (id: string) => {
    const target = products.find((p) => p.id === id)
    if (!target) return
    setActiveId(id)
    setForm({ ...target })
    setMessage(null)
    setError(null)
  }

  const updateField = (patch: Partial<ProductTemplate>) => setForm((prev) => ({ ...prev, ...patch }))

  const updateOptionList = (key: 'materialOptions' | 'colorOptions' | 'sizeOptions', updater: (rows: OptionRow[]) => OptionRow[]) => {
    setForm((prev) => {
      const current = (prev[key] || []) as OptionRow[]
      return { ...prev, [key]: updater([...current]) }
    })
  }

  const saveProduct = async () => {
    if (!form.title.trim()) {
      setError('Title is required.')
      return
    }
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description?.trim() || null,
        baseModelId: form.baseModelId || null,
        materialOptions: (form.materialOptions || []).filter((row) => row.label.trim()),
        colorOptions: (form.colorOptions || []).filter((row) => row.label.trim()),
        sizeOptions: (form.sizeOptions || []).filter((row) => row.label.trim()),
        isActive: form.isActive,
      }
      const res = await fetch(form.id ? `/api/admin/products/${form.id}` : '/api/admin/products', {
        method: form.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Save failed')
      const saved = data.product as ProductTemplate
      setProducts((prev) => {
        const exists = prev.some((p) => p.id === saved.id)
        return exists ? prev.map((p) => (p.id === saved.id ? saved : p)) : [saved, ...prev]
      })
      setActiveId(saved.id)
      setForm(saved)
      setMessage('Saved product template.')
    } catch (err: any) {
      setError(err?.message || 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  const newTemplate = () => {
    setActiveId('')
    setForm(emptyProduct())
    setMessage(null)
    setError(null)
  }

  const removeTemplate = async () => {
    if (!form.id) return
    if (!confirm('Delete this product template?')) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/products/${form.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Delete failed')
      setProducts((prev) => prev.filter((p) => p.id !== form.id))
      setForm(emptyProduct())
      setActiveId('')
    } catch (err: any) {
      setError(err?.message || 'Delete failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid lg:grid-cols-[280px_1fr] gap-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Templates</h2>
          <button className="text-xs px-2 py-1 rounded border border-white/10 hover:border-white/20" onClick={newTemplate}>
            New
          </button>
        </div>
        <div className="space-y-2">
          {products.length === 0 && (
            <p className="text-xs text-slate-500">No templates yet.</p>
          )}
          {products.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => selectProduct(product.id)}
              className={`w-full text-left rounded-lg border px-3 py-2 text-sm ${
                activeId === product.id ? 'border-brand-400/70 bg-brand-500/10' : 'border-white/10 hover:border-white/30'
              }`}
            >
              <div className="font-medium">{product.title}</div>
              <div className="text-xs text-slate-400">{product.baseModel?.title || 'No base model'}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Product Builder</h1>
            <p className="text-xs text-slate-400">Build what customers see on the Products page, including choices and price effects.</p>
          </div>
          <div className="flex gap-2">
            {form.id && (
              <button
                className="text-xs px-2 py-1 rounded border border-rose-500/40 text-rose-200 hover:border-rose-400/70"
                onClick={removeTemplate}
                disabled={saving}
              >
                Delete
              </button>
            )}
            <button className="btn text-sm" onClick={saveProduct} disabled={saving}>
              {saving ? 'Saving...' : 'Save template'}
            </button>
          </div>
        </div>

        {error && <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{error}</div>}
        {message && <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">{message}</div>}

        <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-4">
          <div>
            <h2 className="text-sm font-semibold">1. Basic Product Info</h2>
            <p className="text-xs text-slate-400">These fields control the product card and detail content that customers see.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <label className="text-sm space-y-1">
              <span className="text-slate-400">Product name (shown to customers)</span>
              <input
                className="input"
                value={form.title}
                placeholder="Example: Dragon Bust"
                onChange={(e) => updateField({ title: e.target.value })}
              />
              <p className="text-xs text-slate-500">Keep this short and specific. This appears in listings and on the product page.</p>
            </label>
            <label className="text-sm space-y-1">
              <span className="text-slate-400">Base model (drives starting price + dimensions)</span>
              <select
                className="input"
                value={form.baseModelId || ''}
                onChange={(e) => updateField({ baseModelId: e.target.value || null })}
              >
                <option value="">Select a base model...</option>
                {models.map((model) => (
                  <option key={model.id} value={model.id}>{model.title}</option>
                ))}
              </select>
              <p className="text-xs text-slate-500">Starting price comes from this model before option adjustments.</p>
            </label>
            <label className="text-sm space-y-1 md:col-span-2">
              <span className="text-slate-400">Customer description</span>
              <textarea
                className="input min-h-[120px]"
                value={form.description || ''}
                placeholder="Short shopper-facing summary. Example: Detailed fantasy bust for desk display."
                onChange={(e) => updateField({ description: e.target.value })}
              />
              <p className="text-xs text-slate-500">Explain what the customer gets and what can be customized.</p>
            </label>
            <label className="text-sm flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => updateField({ isActive: e.target.checked })}
              />
              <span>Visible on customer Products page</span>
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-4">
          <div>
            <h2 className="text-sm font-semibold">2. Customer Choices And Pricing</h2>
            <p className="text-xs text-slate-400">Each option row becomes a dropdown item on the customer product configurator.</p>
          </div>

          <OptionEditor
            title="Size choices"
            rows={form.sizeOptions || []}
            onChange={(rows) => updateOptionList('sizeOptions', () => rows)}
            hint="Scale changes volume (scale^3), then Price factor applies."
            showScale
            showPriceMultiplier
            labelPlaceholder="Example: Small / Medium / Large"
            scaleLabel="Scale factor"
            scalePlaceholder="1.00"
            multiplierLabel="Price factor"
            multiplierPlaceholder="1.00"
          />

          <OptionEditor
            title="Material choices"
            rows={form.materialOptions || []}
            onChange={(rows) => updateOptionList('materialOptions', () => rows)}
            hint="Label is what customers see. Material key maps to pricing rules (e.g., PLA, PETG, ABS)."
            showValue
            showPriceMultiplier
            labelPlaceholder="Example: Matte PETG"
            valueLabel="Material key"
            valuePlaceholder="Example: PETG"
            multiplierLabel="Price factor"
            multiplierPlaceholder="1.00"
          />

          <OptionEditor
            title="Color palette choices"
            rows={form.colorOptions || []}
            onChange={(rows) => updateOptionList('colorOptions', () => rows)}
            hint="Colors in palette controls how many colors the customer can pick in cart."
            showColorCount
            showPriceMultiplier
            labelPlaceholder="Example: Two-tone"
            colorCountLabel="Colors in palette"
            multiplierLabel="Price factor"
            multiplierPlaceholder="1.00"
          />
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm space-y-2">
          <div className="text-xs uppercase tracking-[0.3em] text-slate-400">3. Live Pricing Preview</div>
          {selectedModel ? (
            <>
              <div className="text-slate-300">
                Base model: <span className="font-semibold">{selectedModel.title}</span> {basePrice != null ? `- ${formatCurrency(basePrice)}` : ''}
              </div>
              <div className="grid sm:grid-cols-3 gap-3 text-xs text-slate-400">
                {(form.sizeOptions || []).length > 0 ? (
                  (form.sizeOptions || []).map((opt, idx) => (
                    <div key={`preview-${idx}`} className="rounded-lg border border-white/10 bg-black/30 p-2">
                      <div className="text-slate-200">{opt.label || 'Size option'}</div>
                      <div>Scale: {opt.scale ?? 1}</div>
                      <div>Multiplier: {opt.priceMultiplier ?? 1}</div>
                      <div className="text-slate-100">
                        {basePrice != null ? formatCurrency(calculateSizePrice(basePrice, opt)) : 'N/A'}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-500">Add size options to preview pricing.</div>
                )}
              </div>
            </>
          ) : (
            <div className="text-slate-500">Select a base model to preview pricing.</div>
          )}
        </div>
      </div>
    </div>
  )
}

function OptionEditor({
  title,
  rows,
  onChange,
  hint,
  showValue = false,
  showScale = false,
  showColorCount = false,
  showPriceMultiplier = false,
  labelPlaceholder = 'Example: Standard',
  valueLabel = 'Internal value',
  valuePlaceholder = 'Example: PLA',
  scaleLabel = 'Scale',
  scalePlaceholder = '1.00',
  colorCountLabel = 'Color count',
  multiplierLabel = 'Price multiplier',
  multiplierPlaceholder = '1.00',
}: {
  title: string
  rows: OptionRow[]
  onChange: (rows: OptionRow[]) => void
  hint?: string
  showValue?: boolean
  showScale?: boolean
  showColorCount?: boolean
  showPriceMultiplier?: boolean
  labelPlaceholder?: string
  valueLabel?: string
  valuePlaceholder?: string
  scaleLabel?: string
  scalePlaceholder?: string
  colorCountLabel?: string
  multiplierLabel?: string
  multiplierPlaceholder?: string
}) {
  const addRow = () => onChange([...rows, { label: '' }])
  const updateRow = (idx: number, patch: Partial<OptionRow>) => {
    const next = rows.map((row, i) => (i === idx ? { ...row, ...patch } : row))
    onChange(next)
  }
  const removeRow = (idx: number) => onChange(rows.filter((_, i) => i !== idx))
  const countLabel = rows.length === 1 ? '1 option' : `${rows.length} options`

  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          {hint && <div className="text-xs text-slate-500">{hint}</div>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500">{countLabel}</span>
          <button type="button" className="text-xs px-2 py-1 rounded border border-white/10 hover:border-white/20" onClick={addRow}>
            Add option
          </button>
        </div>
      </div>
      {rows.length === 0 && <p className="text-xs text-slate-500">No options added yet.</p>}
      <div className="space-y-2">
        {rows.map((row, idx) => (
          <div key={`${title}-${idx}`} className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-500">Option {idx + 1}</div>
              <button
                type="button"
                className="text-xs text-rose-300 hover:text-rose-200"
                onClick={() => removeRow(idx)}
              >
                Remove
              </button>
            </div>
            <div className="grid md:grid-cols-5 gap-2 items-start">
              <label className="text-xs text-slate-400 md:col-span-2">
                Customer label
                <input
                  className="input mt-1"
                  value={row.label}
                  placeholder={labelPlaceholder}
                  onChange={(e) => updateRow(idx, { label: e.target.value })}
                />
              </label>
              {showValue && (
                <label className="text-xs text-slate-400">
                  {valueLabel}
                  <input
                    className="input mt-1"
                    value={row.value || ''}
                    placeholder={valuePlaceholder}
                    onChange={(e) => updateRow(idx, { value: e.target.value })}
                  />
                </label>
              )}
              {showScale && (
                <label className="text-xs text-slate-400">
                  {scaleLabel}
                  <input
                    className="input mt-1"
                    type="number"
                    step="0.05"
                    value={row.scale ?? 1}
                    placeholder={scalePlaceholder}
                    onChange={(e) => updateRow(idx, { scale: Number(e.target.value) })}
                  />
                  <p className="mt-1 text-[11px] text-slate-500">1.00 = original size</p>
                </label>
              )}
              {showColorCount && (
                <label className="text-xs text-slate-400">
                  {colorCountLabel}
                  <input
                    className="input mt-1"
                    type="number"
                    min={1}
                    max={16}
                    value={row.colorCount ?? 1}
                    onChange={(e) => updateRow(idx, { colorCount: Number(e.target.value) })}
                  />
                  <p className="mt-1 text-[11px] text-slate-500">1 = single color pick</p>
                </label>
              )}
              {showPriceMultiplier && (
                <label className="text-xs text-slate-400">
                  {multiplierLabel}
                  <input
                    className="input mt-1"
                    type="number"
                    step="0.05"
                    value={row.priceMultiplier ?? 1}
                    placeholder={multiplierPlaceholder}
                    onChange={(e) => updateRow(idx, { priceMultiplier: Number(e.target.value) })}
                  />
                  <p className="mt-1 text-[11px] text-slate-500">1.15 = +15% | 0.90 = -10%</p>
                </label>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function calculateSizePrice(basePrice: number, option: OptionRow) {
  const scale = option.scale ?? 1
  const multiplier = option.priceMultiplier ?? 1
  const volumeMultiplier = Math.pow(scale, 3)
  return Number((basePrice * volumeMultiplier * multiplier).toFixed(2))
}
