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
import { buildLockedTemplateOptions } from '@/lib/product-template-config'

type ModelSummary = {
  id: string
  title: string
  filePath?: string | null
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
  stockworksCategory: string | null
  stockworksSku: string | null
  stockworksDesigner: string | null
  stockworksMarketplace: string | null
  stockworksFileLocation: string | null
  stockworksVersion: string | null
  stockworksUnitPriceUsd: number | null
  stockworksStatus: string | null
  stockworksNotes: string | null
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
  stockworksCategory: '',
  stockworksSku: '',
  stockworksDesigner: '',
  stockworksMarketplace: '',
  stockworksFileLocation: '',
  stockworksVersion: '',
  stockworksUnitPriceUsd: null,
  stockworksStatus: 'Active',
  stockworksNotes: '',
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

const getOptionColor = (option: OptionRow) => (option.value || option.label || '').trim()

const sanitizeColorOptions = (rows: OptionRow[] | null | undefined, fallbackColorCount: number): OptionRow[] => {
  if (!Array.isArray(rows)) return []
  const output: OptionRow[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    const color = getOptionColor(row)
    if (!color) continue
    const key = color.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    output.push({
      label: row.label?.trim() || color,
      value: color,
      colorCount: Math.max(1, Math.round(row.colorCount ?? fallbackColorCount)),
      priceMultiplier: row.priceMultiplier == null ? 1 : row.priceMultiplier,
    })
  }
  return output
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

  const paletteColorOptions = useMemo(() => {
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
  const [customColorOption, setCustomColorOption] = useState('')
  const selectedColorOptions = useMemo(
    () => sanitizeColorOptions(form.colorOptions, Math.max(1, Math.round(form.lockedColorCount ?? 1))),
    [form.colorOptions, form.lockedColorCount],
  )
  const selectedColorKeys = useMemo(
    () => new Set(selectedColorOptions.map((row) => getOptionColor(row).toLowerCase())),
    [selectedColorOptions],
  )

  const selectProduct = (id: string) => {
    const target = products.find((p) => p.id === id)
    if (!target) return
    setActiveId(id)
    setForm({ ...target })
    setCustomColorOption('')
    setMessage(null)
    setError(null)
  }

  const updateField = (patch: Partial<ProductTemplate>) => setForm((prev) => ({ ...prev, ...patch }))

  const setColorOptions = (rows: OptionRow[]) => {
    setForm((prev) => {
      const fallbackCount = Math.max(1, Math.round(prev.lockedColorCount ?? 1))
      const sanitized = sanitizeColorOptions(rows, fallbackCount)
      const current = (prev.lockedColor || '').trim()
      const hasCurrent = current
        ? sanitized.some((row) => getOptionColor(row).toLowerCase() === current.toLowerCase())
        : false
      const nextLockedColor = hasCurrent ? current : (sanitized[0] ? getOptionColor(sanitized[0]) : prev.lockedColor)
      return {
        ...prev,
        colorOptions: sanitized,
        lockedColor: nextLockedColor || null,
      }
    })
  }

  const toggleColorOption = (color: string, checked: boolean) => {
    const normalized = color.trim()
    if (!normalized) return
    const next = checked
      ? [...selectedColorOptions, { label: normalized, value: normalized, colorCount: lockedColorCount, priceMultiplier: 1 }]
      : selectedColorOptions.filter((row) => getOptionColor(row).toLowerCase() !== normalized.toLowerCase())
    setColorOptions(next)
  }

  const addCustomColorOption = () => {
    const normalized = customColorOption.trim()
    if (!normalized) return
    if (selectedColorKeys.has(normalized.toLowerCase())) {
      setCustomColorOption('')
      return
    }
    setColorOptions([
      ...selectedColorOptions,
      { label: normalized, value: normalized, colorCount: lockedColorCount, priceMultiplier: 1 },
    ])
    setCustomColorOption('')
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
      const lockedMaterial = normalizeMaterialName(form.lockedMaterial || selectedModel?.material || 'PLA')
      const lockedColor = (form.lockedColor || '').trim() || null
      const lockedColorCount = Math.max(1, Math.round(form.lockedColorCount ?? 1))
      const lockedScale = clampScale(form.lockedScale ?? 1)
      const lockedFinish = (form.lockedFinish || 'standard').trim().toLowerCase()
      const lockedPriceMultiplier = Math.max(0.1, Math.min(5, Number(form.lockedPriceMultiplier ?? 1)))
      const lockedTemplate = buildLockedTemplateOptions({
        material: lockedMaterial,
        color: lockedColor,
        colorCount: lockedColorCount,
        scale: lockedScale,
        finish: lockedFinish,
        priceMultiplier: lockedPriceMultiplier,
      })

      const normalizedColorOptions = sanitizeColorOptions(form.colorOptions, lockedColorCount)
      const payload = {
        title: form.title.trim(),
        description: form.description?.trim() || null,
        baseModelId: form.baseModelId || null,
        stockworksCategory: form.stockworksCategory?.trim() || null,
        stockworksSku: form.stockworksSku?.trim() || null,
        stockworksDesigner: form.stockworksDesigner?.trim() || null,
        stockworksMarketplace: form.stockworksMarketplace?.trim() || null,
        stockworksFileLocation: form.stockworksFileLocation?.trim() || null,
        stockworksVersion: form.stockworksVersion?.trim() || null,
        stockworksUnitPriceUsd: form.stockworksUnitPriceUsd == null || !Number.isFinite(Number(form.stockworksUnitPriceUsd))
          ? null
          : Number(form.stockworksUnitPriceUsd),
        stockworksStatus: form.stockworksStatus?.trim() || null,
        stockworksNotes: form.stockworksNotes?.trim() || null,
        lockedMaterial: lockedTemplate.material,
        lockedColor: lockedTemplate.color,
        lockedColorCount: lockedTemplate.colorCount,
        lockedScale: lockedTemplate.scale,
        lockedFinish: lockedTemplate.finish,
        lockedPriceMultiplier: lockedTemplate.priceMultiplier,
        materialOptions: lockedTemplate.materialOptions,
        colorOptions: normalizedColorOptions.length > 0 ? normalizedColorOptions : lockedTemplate.colorOptions,
        sizeOptions: lockedTemplate.sizeOptions,
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
    setCustomColorOption('')
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
            <p className="text-xs text-slate-400">Set production defaults and shopper color choices for a single listing.</p>
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
                onChange={(e) => {
                  const nextBaseModelId = e.target.value || null
                  const nextModel = models.find((model) => model.id === nextBaseModelId) || null
                  updateField({
                    baseModelId: nextBaseModelId,
                    stockworksFileLocation: nextModel?.filePath || '',
                  })
                }}
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
            <p className="text-xs text-slate-400">Choose defaults and available color variants. StockWorks sync writes this product into the `models` category.</p>
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
              <span className="text-slate-400">Default color</span>
              <select
                className="input"
                value={form.lockedColor || ''}
                onChange={(e) => updateField({ lockedColor: e.target.value || null })}
              >
                <option value="">No color selected...</option>
                {(selectedColorOptions.length > 0
                  ? selectedColorOptions.map((row) => getOptionColor(row))
                  : paletteColorOptions
                ).map((color) => (
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
                onChange={(e) => {
                  const nextColorCount = Math.max(1, Math.round(Number(e.target.value) || 1))
                  setForm((prev) => ({
                    ...prev,
                    lockedColorCount: nextColorCount,
                    colorOptions: Array.isArray(prev.colorOptions)
                      ? prev.colorOptions.map((row) => ({ ...row, colorCount: nextColorCount }))
                      : prev.colorOptions,
                  }))
                }}
              />
            </label>

            <div className="text-sm space-y-2 md:col-span-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Available customer colors</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-xs px-2 py-1 rounded border border-white/10 hover:border-white/30"
                    onClick={() => setColorOptions(paletteColorOptions.map((color) => ({ label: color, value: color, colorCount: lockedColorCount, priceMultiplier: 1 })))}
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    className="text-xs px-2 py-1 rounded border border-white/10 hover:border-white/30"
                    onClick={() => setColorOptions([])}
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/25 p-3 space-y-2 max-h-44 overflow-auto">
                {paletteColorOptions.length === 0 ? (
                  <p className="text-xs text-slate-500">No StockWorks colors found for this material.</p>
                ) : (
                  paletteColorOptions.map((color) => (
                    <label key={color} className="flex items-center gap-2 text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={selectedColorKeys.has(color.toLowerCase())}
                        onChange={(e) => toggleColorOption(color, e.target.checked)}
                      />
                      <span>{color}</span>
                    </label>
                  ))
                )}
              </div>
              <div className="flex gap-2">
                <input
                  className="input text-sm"
                  placeholder="Add custom color name"
                  value={customColorOption}
                  onChange={(e) => setCustomColorOption(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return
                    e.preventDefault()
                    addCustomColorOption()
                  }}
                />
                <button
                  type="button"
                  className="text-xs px-3 py-2 rounded border border-white/10 hover:border-white/30"
                  onClick={addCustomColorOption}
                >
                  Add
                </button>
              </div>
              <p className="text-xs text-slate-500">
                Selected: {selectedColorOptions.length > 0 ? selectedColorOptions.map((row) => row.label || getOptionColor(row)).join(', ') : 'None'}
              </p>
            </div>

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

        <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-4">
          <div>
            <h2 className="text-sm font-semibold">3. StockWorks Model Fields</h2>
            <p className="text-xs text-slate-400">Business-facing metadata mirrors StockWorks model intake fields.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <label className="text-sm space-y-1">
              <span className="text-slate-400">Model name</span>
              <input
                className="input"
                value={form.title}
                placeholder="Shelf Buddy Desk Organizer"
                onChange={(e) => updateField({ title: e.target.value })}
              />
            </label>
            <label className="text-sm space-y-1">
              <span className="text-slate-400">Category</span>
              <input
                className="input"
                value={form.stockworksCategory || ''}
                placeholder="Fidgets, props, organization..."
                onChange={(e) => updateField({ stockworksCategory: e.target.value })}
              />
            </label>
            <label className="text-sm space-y-1">
              <span className="text-slate-400">SKU / listing ID</span>
              <input
                className="input"
                value={form.stockworksSku || ''}
                placeholder="MODEL-1021"
                onChange={(e) => updateField({ stockworksSku: e.target.value })}
              />
            </label>
            <label className="text-sm space-y-1">
              <span className="text-slate-400">Designer</span>
              <input
                className="input"
                value={form.stockworksDesigner || ''}
                placeholder="Studio or designer name"
                onChange={(e) => updateField({ stockworksDesigner: e.target.value })}
              />
            </label>
            <label className="text-sm space-y-1">
              <span className="text-slate-400">Marketplace / platform</span>
              <input
                className="input"
                value={form.stockworksMarketplace || ''}
                placeholder="Etsy, Cults3D, Shopify..."
                onChange={(e) => updateField({ stockworksMarketplace: e.target.value })}
              />
            </label>
            <label className="text-sm space-y-1">
              <span className="text-slate-400">File location</span>
              <input
                className="input"
                value={form.stockworksFileLocation || ''}
                placeholder="Folder path or URL"
                onChange={(e) => updateField({ stockworksFileLocation: e.target.value })}
              />
            </label>
            <label className="text-sm space-y-1">
              <span className="text-slate-400">Version</span>
              <input
                className="input"
                value={form.stockworksVersion || ''}
                placeholder="v1.2"
                onChange={(e) => updateField({ stockworksVersion: e.target.value })}
              />
            </label>
            <label className="text-sm space-y-1">
              <span className="text-slate-400">Unit price (USD)</span>
              <input
                className="input"
                type="number"
                min={0}
                step={0.01}
                value={form.stockworksUnitPriceUsd ?? ''}
                onChange={(e) => updateField({
                  stockworksUnitPriceUsd: e.target.value === '' ? null : Math.max(0, Number(e.target.value) || 0),
                })}
              />
            </label>
            <label className="text-sm space-y-1">
              <span className="text-slate-400">Status</span>
              <select
                className="input"
                value={form.stockworksStatus || 'Active'}
                onChange={(e) => updateField({ stockworksStatus: e.target.value })}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Draft">Draft</option>
                <option value="Archived">Archived</option>
              </select>
            </label>
            <label className="text-sm space-y-1 md:col-span-3">
              <span className="text-slate-400">Notes</span>
              <textarea
                className="input min-h-[120px]"
                value={form.stockworksNotes || ''}
                placeholder="Print notes, licensing, or variants..."
                onChange={(e) => updateField({ stockworksNotes: e.target.value })}
              />
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm space-y-2">
          <div className="text-xs uppercase tracking-[0.3em] text-slate-400">4. Locked Price Preview</div>
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

