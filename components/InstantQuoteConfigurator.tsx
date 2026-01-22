"use client"
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useCart } from '@/components/cart/CartProvider'
import {
  clampScale,
  DIMENSION_AXES,
  FINISH_OPTIONS,
  MATERIAL_OPTIONS,
  normalizeColors,
  normalizeMaterialName,
  resolveAxisScale,
  type MaterialType,
  type ScaleOverrides,
} from '@/lib/cartPricing'
import { formatCurrency } from '@/lib/currency'

type QuoteResponse = {
  quote: {
    priceUsd: number
    leadTimeHours: number
    scale: number
    scaleX: number
    scaleY: number
    scaleZ: number
    targetDimensions?: { x?: number; y?: number; z?: number } | null
  }
}

type Props = {
  modelId: string
  title: string
  priceUsd?: number | null
  material?: string | null
  sizeXmm?: number | null
  sizeYmm?: number | null
  sizeZmm?: number | null
  thumbnail?: string | null
}

const SCALE_MIN = 0.1
const SCALE_MAX = 5

export default function InstantQuoteConfigurator({
  modelId,
  title,
  priceUsd,
  material,
  sizeXmm,
  sizeYmm,
  sizeZmm,
  thumbnail,
}: Props) {
  const { add, maxColors } = useCart()
  const [materialChoice, setMaterialChoice] = useState<MaterialType>(normalizeMaterialName(material))
  const [colors, setColors] = useState<string[]>([])
  const [finish, setFinish] = useState<string>('standard')
  const [infillPct, setInfillPct] = useState<number>(20)
  const [scale, setScale] = useState<number>(1)
  const [lockDimensions, setLockDimensions] = useState(true)
  const [dimensionOverrides, setDimensionOverrides] = useState<ScaleOverrides | null>(null)
  const [quote, setQuote] = useState<QuoteResponse['quote'] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const normalizedColors = useMemo(() => normalizeColors(colors, maxColors), [colors, maxColors])
  const hasRequiredColor = normalizedColors.length > 0

  const hasDimensions = useMemo(
    () => [sizeXmm, sizeYmm, sizeZmm].some((value) => typeof value === 'number' && Number.isFinite(value) && value > 0),
    [sizeXmm, sizeYmm, sizeZmm],
  )

  const axisScale = useMemo(() => ({
    x: resolveAxisScale(scale, lockDimensions ? null : dimensionOverrides, 'x'),
    y: resolveAxisScale(scale, lockDimensions ? null : dimensionOverrides, 'y'),
    z: resolveAxisScale(scale, lockDimensions ? null : dimensionOverrides, 'z'),
  }), [scale, lockDimensions, dimensionOverrides])

  const targetDimensions = useMemo(() => {
    if (!hasDimensions) return null
    const dims: { x?: number; y?: number; z?: number } = {}
    if (typeof sizeXmm === 'number' && Number.isFinite(sizeXmm)) dims.x = Number((sizeXmm * axisScale.x).toFixed(1))
    if (typeof sizeYmm === 'number' && Number.isFinite(sizeYmm)) dims.y = Number((sizeYmm * axisScale.y).toFixed(1))
    if (typeof sizeZmm === 'number' && Number.isFinite(sizeZmm)) dims.z = Number((sizeZmm * axisScale.z).toFixed(1))
    return Object.keys(dims).length ? dims : null
  }, [axisScale, hasDimensions, sizeXmm, sizeYmm, sizeZmm])

  const materialOptions = useMemo(() => {
    const normalized = normalizeMaterialName(materialChoice)
    const options = MATERIAL_OPTIONS.map((option) => String(option))
    if (!options.includes(normalized)) options.push(normalized)
    return options
  }, [materialChoice])

  const updateTargetDimension = useCallback((axis: (typeof DIMENSION_AXES)[number], nextValue: number) => {
    if (!hasDimensions) return
    const baseValue = axis === 'x' ? sizeXmm : axis === 'y' ? sizeYmm : sizeZmm
    if (typeof baseValue !== 'number' || !Number.isFinite(baseValue) || baseValue <= 0) return
    if (!Number.isFinite(nextValue) || nextValue <= 0) return
    const nextScale = clampScale(nextValue / baseValue)
    if (lockDimensions) {
      setScale(nextScale)
      setDimensionOverrides(null)
    } else {
      setDimensionOverrides((prev) => {
        const next = { ...(prev || {}) }
        next[axis] = nextScale
        return next
      })
    }
  }, [hasDimensions, lockDimensions, sizeXmm, sizeYmm, sizeZmm])

  const toggleLock = useCallback(() => {
    if (lockDimensions) {
      setDimensionOverrides({
        x: axisScale.x,
        y: axisScale.y,
        z: axisScale.z,
      })
      setLockDimensions(false)
    } else {
      setLockDimensions(true)
      setDimensionOverrides(null)
    }
  }, [lockDimensions, axisScale])

  const resetDimensions = useCallback(() => {
    setScale(1)
    setDimensionOverrides(null)
    setLockDimensions(true)
  }, [])

  useEffect(() => {
    let active = true
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/models/${modelId}/quote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            material: materialChoice,
            colors: normalizedColors,
            finish,
            infillPct,
            scale,
            scaleX: axisScale.x,
            scaleY: axisScale.y,
            scaleZ: axisScale.z,
            targetDimensions: targetDimensions || undefined,
          }),
        })
        if (!res.ok) {
          const payload = await res.json().catch(() => null)
          throw new Error(payload?.error || 'Unable to fetch quote')
        }
        const data = await res.json() as QuoteResponse & { pending?: boolean }
        if (!active) return
        if (data.pending) {
          setQuote(null)
          return
        }
        setQuote(data.quote)
      } catch (err: any) {
        if (!active) return
        setError(err?.message || 'Unable to fetch quote')
        setQuote(null)
      } finally {
        if (active) setLoading(false)
      }
    }
    run()
    return () => { active = false }
  }, [modelId, materialChoice, normalizedColors, finish, infillPct, scale, axisScale, targetDimensions])

  const addToCart = useCallback(() => {
    if (!hasRequiredColor) return
    add(
      {
        modelId,
        title,
        priceUsd: priceUsd ?? quote?.priceUsd ?? null,
        thumbnail: thumbnail ?? null,
        size: { x: sizeXmm ?? undefined, y: sizeYmm ?? undefined, z: sizeZmm ?? undefined },
      },
      {
        qty: 1,
        scale: clampScale(scale),
        material: materialChoice,
        colors: normalizedColors,
        finish,
        infillPct,
        dimensionOverrides: lockDimensions ? null : dimensionOverrides,
        lockDimensions,
      },
    )
  }, [add, hasRequiredColor, modelId, title, priceUsd, quote?.priceUsd, thumbnail, sizeXmm, sizeYmm, sizeZmm, scale, materialChoice, normalizedColors, finish, infillPct, lockDimensions, dimensionOverrides])

  return (
    <div className="glass rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Instant quote</h3>
          <p className="text-xs text-slate-400">Tune this model and save the configuration to your cart.</p>
        </div>
        <button className="btn" onClick={addToCart} disabled={loading || !hasRequiredColor}>
          Save to cart
        </button>
      </div>
      {error && <div className="text-xs text-amber-300">{error}</div>}
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm space-y-1">
          <span className="text-slate-400">Material</span>
          <select className="input" value={materialChoice} onChange={(e) => setMaterialChoice(e.target.value as MaterialType)}>
            {materialOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
        <label className="text-sm space-y-1">
          <span className="text-slate-400">Finish</span>
          <select className="input" value={finish} onChange={(e) => setFinish(e.target.value)}>
            {FINISH_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
        <label className="text-sm space-y-1">
          <span className="text-slate-400">Infill %</span>
          <input
            className="input"
            type="number"
            min={0}
            max={100}
            value={infillPct}
            onChange={(e) => setInfillPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
          />
        </label>
        <label className="text-sm space-y-1">
          <span className="text-slate-400">Scale</span>
          <input
            className="input"
            type="number"
            min={SCALE_MIN}
            max={SCALE_MAX}
            step={0.05}
            value={scale.toFixed(2)}
            onChange={(e) => setScale(clampScale(Number(e.target.value)))}
          />
        </label>
      </div>
      {hasDimensions && (
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span>Target dimensions (mm)</span>
            <button type="button" className="px-2 py-1 rounded border border-white/10 hover:border-white/20" onClick={toggleLock}>
              {lockDimensions ? 'Ratio locked' : 'Ratio free'}
            </button>
            <button type="button" className="px-2 py-1 rounded border border-white/10 hover:border-white/20" onClick={resetDimensions}>
              Reset
            </button>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            {DIMENSION_AXES.map((axis) => {
              const value = targetDimensions?.[axis]
              return (
                <label key={axis} className="text-xs text-slate-400 space-y-1">
                  <span>{axis.toUpperCase()}</span>
                  <input
                    className="input"
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={value != null ? value : ''}
                    onChange={(e) => updateTargetDimension(axis, Number(e.target.value))}
                  />
                </label>
              )
            })}
          </div>
        </div>
      )}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Colors (required)</span>
          <button
            type="button"
            className="px-2 py-1 rounded border border-white/10 hover:border-white/20"
            onClick={() => {
              if (colors.length >= maxColors) return
              setColors((prev) => [...prev, ''])
            }}
          >
            Add color
          </button>
        </div>
        {!hasRequiredColor && (
          <p className="text-xs text-amber-300">Choose at least one filament color before saving to cart.</p>
        )}
        <div className="grid gap-2 md:grid-cols-2">
          {colors.map((color, idx) => (
            <div key={`${modelId}-color-${idx}`} className="flex gap-2">
              <input
                className="input flex-1"
                value={color}
                placeholder={`Color ${idx + 1}`}
                onChange={(e) => {
                  const next = colors.slice()
                  next[idx] = e.target.value
                  setColors(next)
                }}
              />
              <button
                type="button"
                className="px-2 py-1 rounded border border-white/10 hover:border-white/20"
                onClick={() => setColors(colors.filter((_, i) => i !== idx))}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-white/10 bg-black/40 p-3 text-sm flex items-center justify-between">
        <div>
          <div className="text-slate-400 text-xs">Estimated price</div>
          <div className="text-lg font-semibold">
            {quote ? formatCurrency(quote.priceUsd) : (priceUsd ? formatCurrency(priceUsd) : '...')}
          </div>
          <div className="text-xs text-slate-400">
            Lead time: {quote ? `${quote.leadTimeHours.toFixed(1)} hrs` : '...'}
          </div>
        </div>
        <div className="text-right text-xs text-slate-500">
          {targetDimensions
            ? `Size: ${DIMENSION_AXES.map((axis) => targetDimensions?.[axis]).filter(Boolean).join(' x ')} mm`
            : 'Size pending'}
        </div>
      </div>
    </div>
  )
}
