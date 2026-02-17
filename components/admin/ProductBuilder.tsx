"use client"

import { useEffect, useMemo, useState } from 'react'
import { formatCurrency } from '@/lib/currency'
import {
  FINISH_OPTIONS,
  MATERIAL_OPTIONS,
  clampScale,
  getColorMultiplier,
  getFinishMultiplier,
  getMaterialMultiplier,
  normalizeMaterialName,
} from '@/lib/cartPricing'

type ModelSummary = {
  id: string
  title: string
  priceUsd: number | null
  effectivePriceUsd: number | null
  salePriceUsd: number | null
  flatRatePricing?: boolean | null
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

type StockworksColor = {
  name: string
  hex?: string | null
}

type StockworksPalette = {
  enabled: boolean
  materials: Record<string, { inStock: StockworksColor[] | string[]; orderable: StockworksColor[] | string[] }>
  materialTypes?: string[]
}

type ProductTemplate = {
  id: string
  title: string
  description: string | null
  baseModelId: string | null
  lockedMaterial: string | null
  lockedColor: string | null
  lockedColorCount: number | null
  lockedScale: number | null
  lockedFinish: string | null
  lockedPriceMultiplier: number | null
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
  lockedMaterial: 'PLA',
  lockedColor: null,
  lockedColorCount: 1,
  lockedScale: 1,
  lockedFinish: 'standard',
  lockedPriceMultiplier: 1,
  materialOptions: [],
  colorOptions: [],
  sizeOptions: [],
  isActive: true,
})

const normalizeColorName = (entry: StockworksColor | string) => {
  if (typeof entry === 'string') return entry.trim()
  const name = (entry?.name || '').trim()
  const hex = (entry?.hex || '').trim()
  return name || hex
}

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
  const [stockworksPalette, setStockworksPalette] = useState<StockworksPalette | null>(null)

  useEffect(() => {
    let active = true
    fetch('/api/stockworks/filament-colors', { cache: 'no-store' })
      .then(async (res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data?.enabled) return
        setStockworksPalette(data)
      })
      .catch(() => {})
    return () => { active = false }
  }, [])

  const selectedModel = useMemo(
    () => models.find((m) => m.id === form.baseModelId) || null,
    [models, form.baseModelId],
  )

  const basePrice = selectedModel
    ? (selectedModel.salePriceUsd ?? selectedModel.effectivePriceUsd ?? selectedModel.priceUsd ?? null)
    : null

  const materialOptions = useMemo(() => {
    const defaults = MATERIAL_OPTIONS.map((value) => value.toUpperCase())
    const fromStockworks = stockworksPalette?.materialTypes?.length
      ? stockworksPalette.materialTypes.map((value) => value.toUpperCase())
      : (stockworksPalette?.materials ? Object.keys(stockworksPalette.materials).map((value) => value.toUpperCase()) : [])
    const output: string[] = []
    const seen = new Set<string>()
    for (const entry of [...defaults, ...fromStockworks]) {
      const normalized = normalizeMaterialName(entry)
      if (!normalized || seen.has(normalized)) continue
      seen.add(normalized)
      output.push(normalized)
    }
    return output.length ? output : defaults
  }, [stockworksPalette])

  const colorOptions = useMemo(() => {
    const activeMaterial = normalizeMaterialName(form.lockedMaterial)
    const palette = stockworksPalette?.materials?.[activeMaterial]
    const combined = [
      ...(Array.isArray(palette?.inStock) ? palette.inStock : []),
      ...(Array.isArray(palette?.orderable) ? palette.orderable : []),
    ]
    const seen = new Set<string>()
    const output: string[] = []
    for (const entry of combined) {
      const name = normalizeColorName(entry as StockworksColor | string)
      const key = name.toLowerCase()
      if (!name || seen.has(key)) continue
      seen.add(key)
      output.push(name)
    }
    return output
  }, [form.lockedMaterial, stockworksPalette])

  const selectProduct = (id: string) => {
    const target = products.find((p) => p.id === id)
    if (!target) return
    setActiveId(id)
    setForm({ ...target })
    setMessage(null)
    setError(null)
  }

  const updateField = (patch: Partial<ProductTemplate>) => setForm((prev) => ({ ...prev, ...patch }))

  const saveProduct = async () => {
    if (!form.title.trim()) {
      setError('Title is required.')
      return
    }
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const lockedMaterial = normalizeMaterialName(form.lockedMaterial || selectedModel?.material || 'PLA')
      const lockedColor = (form.lockedColor || '').trim() || null
      const lockedColorCount = Math.max(1, Math.round(form.lockedColorCount ?? 1))
      const lockedScale = clampScale(form.lockedScale ?? 1)
      const lockedFinish = (form.lockedFinish || 'standard').trim().toLowerCase()
      const lockedPriceMultiplier = Math.max(0.1, Math.min(5, Number(form.lockedPriceMultiplier ?? 1)))

      const payload = {
        title: form.title.trim(),
        description: form.description?.trim() || null,
        baseModelId: form.baseModelId || null,
        lockedMaterial,
        lockedColor,
        lockedColorCount,
        lockedScale,
        lockedFinish,
        lockedPriceMultiplier,
        materialOptions: [{ label: lockedMaterial, value: lockedMaterial, priceMultiplier: 1 }],
        colorOptions: [{ label: lockedColor || 'Standard', value: lockedColor || undefined, colorCount: lockedColorCount, priceMultiplier: 1 }],
        sizeOptions: [{ label: 'Configured size', scale: lockedScale, priceMultiplier: lockedPriceMultiplier }],
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
      setMessage(
        data?.stockworksWarning
          ? `Saved product. StockWorks sync warning: ${data.stockworksWarning}`
          : 'Saved product and synced StockWorks models inventory.',
      )
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
    setMessage(null)
    try {
      const res = await fetch(`/api/admin/products/${form.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Delete failed')
      setProducts((prev) => prev.filter((p) => p.id !== form.id))
      setForm(emptyProduct())
      setActiveId('')
      setMessage(data?.stockworksWarning
        ? `Deleted product. StockWorks unlink warning: ${data.stockworksWarning}`
        : 'Deleted product and unlinked StockWorks models inventory.')
    } catch (err: any) {
      setError(err?.message || 'Delete failed.')
    } finally {
      setSaving(false)
    }
  }

  const lockedMaterial = normalizeMaterialName(form.lockedMaterial || selectedModel?.material || 'PLA')
  const lockedColorCount = Math.max(1, Math.round(form.lockedColorCount ?? 1))
  const lockedScale = clampScale(form.lockedScale ?? 1)
  const lockedFinish = (form.lockedFinish || 'standard').trim().toLowerCase()
  const lockedMultiplier = Math.max(0.1, Math.min(5, Number(form.lockedPriceMultiplier ?? 1)))

  const estimatedPrice = useMemo(() => {
    if (basePrice == null || !Number.isFinite(basePrice) || basePrice <= 0) return null
    const volumeMultiplier = Math.pow(lockedScale, 3)
    const colorMultiplier = selectedModel?.flatRatePricing ? 1 : getColorMultiplier(Array.from({ length: lockedColorCount }, () => 'X'))
    const materialMultiplier = getMaterialMultiplier(lockedMaterial)
    const finishMultiplier = getFinishMultiplier(lockedFinish)
    return Number((basePrice * volumeMultiplier * colorMultiplier * materialMultiplier * finishMultiplier * lockedMultiplier).toFixed(2))
  }, [basePrice, lockedScale, lockedColorCount, selectedModel, lockedMaterial, lockedFinish, lockedMultiplier])

  return (
    <div className="grid lg:grid-cols-[280px_1fr] gap-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Products</h2>
          <button className="text-xs px-2 py-1 rounded border border-white/10 hover:border-white/20" onClick={newTemplate}>
            New
          </button>
        </div>
        <div className="space-y-2">
          {products.length === 0 && (
            <p className="text-xs text-slate-500">No products yet.</p>
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
            <p className="text-xs text-slate-400">Set a locked production configuration. Customers can only edit engraving text and quantity.</p>
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
              {saving ? 'Saving...' : 'Save product'}
            </button>
          </div>
        </div>

        {error && <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{error}</div>}
        {message && <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">{message}</div>}

        <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-4">
          <div>
            <h2 className="text-sm font-semibold">1. Product Basics</h2>
            <p className="text-xs text-slate-400">Customer-facing product card + detail content.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <label className="text-sm space-y-1">
              <span className="text-slate-400">Product name</span>
              <input
                className="input"
                value={form.title}
                placeholder="Example: Dragon Bust"
                onChange={(e) => updateField({ title: e.target.value })}
              />
            </label>
            <label className="text-sm space-y-1">
              <span className="text-slate-400">Base model</span>
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
            </label>
            <label className="text-sm space-y-1 md:col-span-2">
              <span className="text-slate-400">Customer description</span>
              <textarea
                className="input min-h-[120px]"
                value={form.description || ''}
                placeholder="Short shopper-facing summary."
                onChange={(e) => updateField({ description: e.target.value })}
              />
            </label>
            <label className="text-sm flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => updateField({ isActive: e.target.checked })}
              />
              <span>Visible on Products page</span>
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-4">
          <div>
            <h2 className="text-sm font-semibold">2. Locked Product Configuration</h2>
            <p className="text-xs text-slate-400">This is the exact config used at checkout. StockWorks sync writes this product into the `models` category.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <label className="text-sm space-y-1">
              <span className="text-slate-400">Material</span>
              <select
                className="input"
                value={lockedMaterial}
                onChange={(e) => {
                  const nextMaterial = normalizeMaterialName(e.target.value)
                  const nextPalette = stockworksPalette?.materials?.[nextMaterial]
                  const firstColor = Array.isArray(nextPalette?.inStock) && nextPalette.inStock.length > 0
                    ? normalizeColorName(nextPalette.inStock[0] as StockworksColor | string)
                    : null
                  updateField({ lockedMaterial: nextMaterial, lockedColor: form.lockedColor || firstColor || null })
                }}
              >
                {materialOptions.map((material) => (
                  <option key={material} value={material}>{material}</option>
                ))}
              </select>
            </label>

            <label className="text-sm space-y-1">
              <span className="text-slate-400">Color from StockWorks</span>
              <select
                className="input"
                value={form.lockedColor || ''}
                onChange={(e) => updateField({ lockedColor: e.target.value || null })}
              >
                <option value="">No color selected...</option>
                {colorOptions.map((color) => (
                  <option key={color} value={color}>{color}</option>
                ))}
              </select>
            </label>

            <label className="text-sm space-y-1">
              <span className="text-slate-400">Color slot count</span>
              <input
                className="input"
                type="number"
                min={1}
                max={16}
                value={lockedColorCount}
                onChange={(e) => updateField({ lockedColorCount: Math.max(1, Math.round(Number(e.target.value) || 1)) })}
              />
            </label>

            <label className="text-sm space-y-1">
              <span className="text-slate-400">Finish</span>
              <select
                className="input"
                value={lockedFinish}
                onChange={(e) => updateField({ lockedFinish: e.target.value })}
              >
                {FINISH_OPTIONS.map((finish) => (
                  <option key={finish} value={finish}>{finish}</option>
                ))}
              </select>
            </label>

            <label className="text-sm space-y-1">
              <span className="text-slate-400">Scale factor</span>
              <input
                className="input"
                type="number"
                min={0.1}
                max={5}
                step={0.05}
                value={lockedScale}
                onChange={(e) => updateField({ lockedScale: clampScale(Number(e.target.value) || 1) })}
              />
            </label>

            <label className="text-sm space-y-1">
              <span className="text-slate-400">Price multiplier</span>
              <input
                className="input"
                type="number"
                min={0.1}
                max={5}
                step={0.05}
                value={lockedMultiplier}
                onChange={(e) => updateField({ lockedPriceMultiplier: Math.max(0.1, Math.min(5, Number(e.target.value) || 1)) })}
              />
            </label>
          </div>
          <p className="text-xs text-slate-500">If StockWorks is not connected, material/color selectors still work with saved values.</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm space-y-2">
          <div className="text-xs uppercase tracking-[0.3em] text-slate-400">3. Locked Price Preview</div>
          {selectedModel ? (
            <>
              <div className="text-slate-300">
                Base model: <span className="font-semibold">{selectedModel.title}</span> {basePrice != null ? `- ${formatCurrency(basePrice)}` : ''}
              </div>
              <div className="text-xs text-slate-400">Material {lockedMaterial} • Color slots {lockedColorCount} • Finish {lockedFinish} • Scale {lockedScale.toFixed(2)} • Multiplier {lockedMultiplier.toFixed(2)}</div>
              <div className="text-slate-100">
                {estimatedPrice != null ? `Estimated from ${formatCurrency(estimatedPrice)}` : 'N/A'}
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

