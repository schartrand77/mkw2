"use client"

import Link from 'next/link'
import { formatCurrency } from '@/lib/currency'
import { useCart } from '@/components/cart/CartProvider'
import { useMemo } from 'react'

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
}

type Props = {
  modelId: string
  modelTitle: string
  thumbnail?: string | null
  parts: Part[]
}

export default function ModelPartsList({ modelId, modelTitle, thumbnail, parts }: Props) {
  const { add } = useCart()
  const hasPricedPart = parts.some((p) => typeof p.priceUsd === 'number' && Number(p.priceUsd) > 0)
  const memoizedParts = useMemo(() => parts, [parts])

  return (
    <div className="glass rounded-xl p-4 text-sm">
      <div className="font-semibold mb-2">Parts breakdown</div>
      {memoizedParts.length === 0 && (
        <p className="text-xs text-slate-500">This model does not have individual parts listed.</p>
      )}
      {memoizedParts.length > 0 && (
        <ul className="divide-y divide-white/10">
          {memoizedParts.map((part, i) => {
            const price = typeof part.priceUsd === 'number' && part.priceUsd > 0 ? part.priceUsd : null
            const volume = part.volumeMm3 ? `${(part.volumeMm3 / 1000).toFixed(2)} cm^3` : 'N/A'
            return (
              <li key={part.id} className="py-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <div className="font-medium">{part.name || `Part ${i + 1}`}</div>
                  <div className="text-xs text-slate-400">
                    Volume: {volume}
                    {price != null && ` - Price: ${formatCurrency(price)}`}
                  </div>
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
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {hasPricedPart ? (
        <p className="text-xs text-slate-500 mt-3">Need everything? Use the main download button to grab a zipped bundle.</p>
      ) : (
        <p className="text-xs text-amber-300 mt-3">Part pricing is still being calculated. Download the full set or check back soon.</p>
      )}
    </div>
  )
}
