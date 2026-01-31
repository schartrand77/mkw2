"use client"

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/currency'
import { useCart } from '@/components/cart/CartProvider'
import { useMemo, useState } from 'react'
import type { PricingDetails } from '@/lib/pricing'

type Part = {
  id: string
  name: string
  volumeMm3?: number | null
  priceUsd?: number | null
  downloadUrl?: string | null
  index: number
  sizeXmm?: number | null
  sizeYmm?: number | null
  sizeZmm?: number | null
  pricing?: PricingDetails | null
}

type Props = {
  modelId: string
  modelTitle: string
  thumbnail?: string | null
  parts: Part[]
}

export default function ModelPartsList({ modelId, modelTitle, thumbnail, parts }: Props) {
  const { add, items } = useCart()
  const router = useRouter()
  const hasPricedPart = parts.some((p) => typeof p.priceUsd === 'number' && Number(p.priceUsd) > 0)
  const [isOpen, setIsOpen] = useState(false)
  const memoizedParts = useMemo(() => parts, [parts])
  const partQuantities = useMemo(() => {
    const quantities: Record<string, number> = {}
    for (const item of items) {
      if (item.modelId !== modelId || !item.partId) continue
      quantities[item.partId] = item.options.qty ?? 0
    }
    return quantities
  }, [items, modelId])
  const buildPreviewUrl = (partId: string) => `/cart?previewModelId=${encodeURIComponent(modelId)}&previewPartId=${encodeURIComponent(partId)}`

  return (
    <div className="glass rounded-xl p-4 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="font-semibold">Parts breakdown</div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">
            {memoizedParts.length} {memoizedParts.length === 1 ? 'part' : 'parts'}
          </span>
          <button
            type="button"
            className="px-2 py-1 rounded-md border border-white/10 hover:border-white/20 text-xs"
            onClick={() => setIsOpen((open) => !open)}
            aria-expanded={isOpen}
            aria-controls="parts-breakdown-body"
          >
            {isOpen ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      {isOpen && (
        <div id="parts-breakdown-body" className="mt-3 space-y-3">
          {memoizedParts.length === 0 && (
            <p className="text-xs text-slate-500">This model does not have individual parts listed.</p>
          )}

          {memoizedParts.length > 0 && (
            <ul className="divide-y divide-white/10">
              {memoizedParts.map((part, i) => {
                const price = typeof part.priceUsd === 'number' && part.priceUsd > 0 ? part.priceUsd : null
                const volume = part.volumeMm3 ? `${(part.volumeMm3 / 1000).toFixed(2)} cm^3` : 'N/A'
                const breakdown = part.pricing
                return (
                  <li key={part.id} className="py-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                      <div className="font-medium">{part.name || `Part ${i + 1}`}</div>
                      <div className="text-xs text-slate-400">
                        Volume: {volume}
                        {price != null && ` - Price: ${formatCurrency(price)}`}
                      </div>
                      {breakdown && (
                        <div className="text-xs text-slate-500">
                          ~ {breakdown.grams} g - {breakdown.hours} h
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {part.downloadUrl && (
                        <a className="px-2 py-1 rounded-md border border-white/10 hover:border-white/20" href={part.downloadUrl} download>
                          Download
                        </a>
                      )}

                      <Link className="px-2 py-1 rounded-md border border-white/10 hover:border-white/20" href={`/models/${modelId}?part=${part.index}`}>
                        Preview
                      </Link>

                      <div className="relative inline-flex">
                        <button
                          type="button"
                          className="px-2 py-1 rounded-md border border-brand-500/40 hover:border-brand-500 text-brand-200 disabled:opacity-40"
                          disabled={price == null}
                          onClick={() => {
                            if (price == null) return
                            add(
                              {
                                modelId,
                                partId: part.id,
                                partName: part.name || `Part ${i + 1}`,
                                partIndex: part.index,
                                title: modelTitle,
                                priceUsd: price,
                                thumbnail,
                                size: { x: part.sizeXmm ?? undefined, y: part.sizeYmm ?? undefined, z: part.sizeZmm ?? undefined },
                              },
                              { material: 'PLA', colors: [] },
                            )
                          }}
                        >
                          Add to cart
                        </button>

                        {(partQuantities[part.id] ?? 0) > 0 && (
                          <span className="absolute -top-2 -right-2 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-brand-500 px-1 text-[0.65rem] font-semibold text-white shadow-lg shadow-brand-500/40">
                            {partQuantities[part.id]}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="px-2 py-1 rounded-md border border-white/10 hover:border-white/20 text-xs disabled:opacity-40"
                        disabled={price == null}
                        onClick={() => {
                          if (price == null) return
                          const inCart = items.some((item) => item.modelId === modelId && (item.partId ?? null) === part.id)
                          if (!inCart) {
                            add(
                              {
                                modelId,
                                partId: part.id,
                                partName: part.name || `Part ${i + 1}`,
                                partIndex: part.index,
                                title: modelTitle,
                                priceUsd: price,
                                thumbnail,
                                size: { x: part.sizeXmm ?? undefined, y: part.sizeYmm ?? undefined, z: part.sizeZmm ?? undefined },
                              },
                              { material: 'PLA', colors: [] },
                            )
                          }
                          router.push(buildPreviewUrl(part.id))
                        }}
                      >
                        Configure colors
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {hasPricedPart ? (
            <p className="text-xs text-slate-500">Need everything? Use the main download button to grab a zipped bundle.</p>
          ) : (
            <p className="text-xs text-amber-300">Part pricing is still being calculated. Download the full set or check back soon.</p>
          )}
        </div>
      )}
    </div>
  )
}
