"use client"
import { useCallback, useMemo, useState } from 'react'
import { useCart } from './CartProvider'
import { buildImageSrc } from '@/lib/public-path'
import { normalizeColors } from '@/lib/cartPricing'
import { buildAllowedColorTokenSet, isColorAllowed, normalizeModelColorSlotCount } from '@/lib/color-constraints'

type ModelPreview = {
  id: string
  title: string
  priceUsd?: number | null
  basePriceUsd?: number | null
  salePriceUsd?: number | null
  saleActive?: boolean | null
  flatRatePricing?: boolean | null
  coverImagePath?: string | null
  updatedAt?: string | Date | null
  sizeXmm?: number
  sizeYmm?: number
  sizeZmm?: number
  defaultColors?: string[] | null
  colorSlotCount?: number | null
  allowedColors?: string[] | null
}

export default function AddToCartButtons({ model }: { model: ModelPreview }) {
  const { add, inc, dec, items } = useCart()
  const [adding, setAdding] = useState(false)
  const [parts, setParts] = useState<Array<{
    id: string
    name?: string | null
    index?: number | null
    priceUsd?: number | null
    sizeXmm?: number | null
    sizeYmm?: number | null
    sizeZmm?: number | null
  }> | null>(null)
  const partItems = useMemo(() => items.filter((i) => i.modelId === model.id && i.partId), [items, model.id])
  const isMultipart = (parts?.length || 0) > 0 || partItems.length > 0
  const partIds = parts?.map((p) => p.id) || []
  const setQty = useMemo(() => {
    if (!isMultipart) return 0
    if (partIds.length === 0) return partItems.length ? Math.min(...partItems.map((i) => i.options.qty || 0)) : 0
    const quantities = partIds.map((id) => partItems.find((i) => i.partId === id)?.options.qty ?? 0)
    return quantities.length ? Math.min(...quantities) : 0
  }, [isMultipart, partIds, partItems])
  const inCart = items.find(i => i.modelId === model.id && !i.partId)
  const qty = isMultipart ? setQty : (inCart?.options.qty || 0)
  const thumbnail = useMemo(() => buildImageSrc(model.coverImagePath ?? null, model.updatedAt ?? null), [model.coverImagePath, model.updatedAt])
  const resolvedPrice = useMemo(() => {
    if (model.salePriceUsd != null && (model.saleActive || model.salePriceUsd != null)) {
      return model.salePriceUsd
    }
    if (model.priceUsd != null) return model.priceUsd
    if (model.basePriceUsd != null) return model.basePriceUsd
    return null
  }, [model.salePriceUsd, model.saleActive, model.priceUsd, model.basePriceUsd])

  const applyColorRules = useCallback((colors: string[], slotCount?: number | null, allowedColors?: string[] | null) => {
    const limit = normalizeModelColorSlotCount(slotCount)
    const normalized = normalizeColors(colors, limit ?? undefined)
    const allowed = buildAllowedColorTokenSet(allowedColors)
    return allowed ? normalized.filter((value) => isColorAllowed(value, allowed)) : normalized
  }, [])

  const addOne = useCallback(async () => {
    if (adding) return
    setAdding(true)
    let colors = Array.isArray(model.defaultColors) ? model.defaultColors : []
    let colorSlotCount = normalizeModelColorSlotCount(model.colorSlotCount)
    let allowedColors = Array.isArray(model.allowedColors) ? model.allowedColors : null
    let fetchedParts: Array<{
      id: string
      name?: string | null
      index?: number | null
      priceUsd?: number | null
      sizeXmm?: number | null
      sizeYmm?: number | null
      sizeZmm?: number | null
    }> | null = parts
    let flatRatePricing = Boolean(model.flatRatePricing)
    if (colors.length === 0 || !parts) {
      try {
        const res = await fetch(`/api/models/${model.id}`, { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          flatRatePricing = Boolean(data?.model?.flatRatePricing ?? flatRatePricing)
          colorSlotCount = normalizeModelColorSlotCount(data?.model?.colorSlotCount ?? colorSlotCount)
          allowedColors = Array.isArray(data?.model?.allowedColors) ? data.model.allowedColors : allowedColors
          if (Array.isArray(data?.model?.defaultColors)) {
            colors = data.model.defaultColors
          }
          if (Array.isArray(data?.model?.parts)) {
            fetchedParts = data.model.parts.map((part: any, index: number) => ({
              id: String(part?.id ?? ''),
              name: part?.name ?? null,
              index: typeof part?.index === 'number' ? part.index : index,
              priceUsd: typeof part?.priceUsd === 'number' ? part.priceUsd : part?.priceUsd ?? null,
              sizeXmm: part?.sizeXmm ?? null,
              sizeYmm: part?.sizeYmm ?? null,
              sizeZmm: part?.sizeZmm ?? null,
            })).filter((part: any) => Boolean(part.id))
          }
        }
      } catch {}
    }
    if (!fetchedParts && Array.isArray(model.defaultColors)) {
      fetchedParts = null
    }
    const constrainedColors = applyColorRules(colors, colorSlotCount, allowedColors)
    if (fetchedParts && fetchedParts.length > 1) {
      setParts(fetchedParts)
      for (const part of fetchedParts) {
        add(
          {
            modelId: model.id,
            partId: part.id,
            partName: part.name || undefined,
            partIndex: typeof part.index === 'number' ? part.index : undefined,
            flatRatePricing,
            title: model.title,
            priceUsd: part.priceUsd ?? null,
            thumbnail,
            size: { x: part.sizeXmm ?? undefined, y: part.sizeYmm ?? undefined, z: part.sizeZmm ?? undefined },
            colorSlotCount,
            allowedColors,
          },
          { material: 'PLA', colors: constrainedColors, finish: 'standard' },
        )
      }
    } else {
      setParts(fetchedParts && fetchedParts.length > 1 ? fetchedParts : null)
        add(
        {
          modelId: model.id,
          flatRatePricing,
          title: model.title,
          priceUsd: resolvedPrice,
          thumbnail,
          size: { x: model.sizeXmm, y: model.sizeYmm, z: model.sizeZmm },
          colorSlotCount,
          allowedColors,
        },
        { material: 'PLA', colors: constrainedColors, finish: 'standard' },
      )
    }
    setAdding(false)
  }, [add, adding, model.allowedColors, model.colorSlotCount, model.defaultColors, model.flatRatePricing, model.id, model.sizeXmm, model.sizeYmm, model.sizeZmm, model.title, resolvedPrice, thumbnail, parts, applyColorRules])

  const stopPropagation = (e: React.SyntheticEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  return (
    <div className="flex items-center gap-2" onClick={stopPropagation} onKeyDownCapture={(e) => e.stopPropagation()}>
      {qty > 0 && (
        <button
          type="button"
          className="px-2 py-1 rounded-md border border-white/10 hover:border-white/20"
          onClick={() => {
            if (isMultipart && parts?.length) {
              for (const part of parts) {
                dec(model.id, part.id)
              }
              return
            }
            dec(model.id)
          }}
        >
          -
        </button>
      )}
      <button
        type="button"
        className="px-2 py-1 rounded-md border border-white/10 hover:border-white/20"
        onClick={qty > 0
          ? () => {
            if (isMultipart && parts?.length) {
              for (const part of parts) {
                add(
                  {
                    modelId: model.id,
                    partId: part.id,
                    partName: part.name || undefined,
                    partIndex: typeof part.index === 'number' ? part.index : undefined,
                    flatRatePricing: Boolean(model.flatRatePricing),
                    title: model.title,
                    priceUsd: part.priceUsd ?? null,
                    thumbnail,
                    size: { x: part.sizeXmm ?? undefined, y: part.sizeYmm ?? undefined, z: part.sizeZmm ?? undefined },
                    colorSlotCount: normalizeModelColorSlotCount(model.colorSlotCount),
                    allowedColors: Array.isArray(model.allowedColors) ? model.allowedColors : null,
                  },
                  { material: 'PLA', colors: applyColorRules(Array.isArray(model.defaultColors) ? model.defaultColors : [], model.colorSlotCount, model.allowedColors), finish: 'standard' },
                )
              }
              return
            }
            inc(model.id)
          }
          : addOne}
        disabled={adding}
      >
        {qty > 0 ? '+' : 'Add'}
      </button>
      {qty > 0 && <span className="text-xs text-slate-400">{qty} in cart</span>}
    </div>
  )
}
