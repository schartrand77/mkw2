"use client"

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Gallery from '@/components/Gallery'
import StatusChip from '@/components/StatusChip'

type Part = {
  id: string
  name?: string | null
  index: number
  filePath: string
  previewFilePath?: string | null
  sizeXmm?: number | null
  sizeYmm?: number | null
  sizeZmm?: number | null
}

type GalleryImage = { id: string; filePath: string; caption?: string | null; status?: string | null }

type Props = {
  modelId: string
  coverSrc?: string | null
  parts: Part[]
  allSrc?: string | null
  allFallbackSrc?: string | null
  images?: GalleryImage[]
  initialKey?: string
  actions?: ReactNode
  reviewPins?: Array<{ partKey: string; x: number; y: number; z: number; highlighted?: boolean }>
}

function formatDimensions(part: Part | null) {
  if (!part) return null
  const dimensions = [part.sizeXmm, part.sizeYmm, part.sizeZmm]
  if (dimensions.some((value) => typeof value !== 'number' || !Number.isFinite(value) || value <= 0)) return null
  return `${Math.round(dimensions[0] as number)} x ${Math.round(dimensions[1] as number)} x ${Math.round(dimensions[2] as number)} mm`
}

export default function ModelReviewWorkspace({
  modelId,
  coverSrc,
  parts,
  allSrc,
  allFallbackSrc,
  images = [],
  initialKey,
  actions,
  reviewPins = [],
}: Props) {
  const initialPartKey = useMemo(() => {
    if (!initialKey?.startsWith('three:')) return null
    const partIndex = Number.parseInt(initialKey.slice('three:'.length), 10)
    if (!Number.isFinite(partIndex) || partIndex < 0 || partIndex >= parts.length) return null
    return parts[partIndex]?.id || null
  }, [initialKey, parts])
  const [selectedPartKey, setSelectedPartKey] = useState<string | null>(initialPartKey)
  const [selectedPin, setSelectedPin] = useState<{ partKey: string; x: number; y: number; z: number } | null>(null)
  const selectedPart = useMemo(() => parts.find((part) => part.id === selectedPartKey) || null, [parts, selectedPartKey])
  const sizeLabel = formatDimensions(selectedPart)

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new CustomEvent('mwv2:model-part-selection', {
      detail: selectedPart
        ? {
            partId: selectedPart.id,
            partName: selectedPart.name || `Part ${selectedPart.index + 1}`,
            pin: selectedPin && selectedPin.partKey === selectedPart.id
              ? { x: selectedPin.x, y: selectedPin.y, z: selectedPin.z }
              : null,
          }
        : {},
    }))
  }, [selectedPart, selectedPin])

  return (
    <div className="space-y-3">
      <Gallery
        coverSrc={coverSrc}
        parts={parts}
        allSrc={allSrc}
        allFallbackSrc={allFallbackSrc}
        images={images}
        initialKey={initialKey}
        actions={actions}
        selectedPartPin={selectedPin}
        reviewPins={reviewPins}
        onPartSelect={(partKey, pin) => {
          setSelectedPartKey(partKey)
          setSelectedPin(partKey && pin ? { partKey, ...pin } : null)
        }}
      />
      {parts.length > 1 && (
        <div className="glass rounded-xl border border-white/10 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Part-aware review</p>
              <p className="text-sm text-slate-300">Tap a part in the combined 3D view to target comments, pins, and part-specific review details.</p>
            </div>
            <StatusChip
              label={selectedPart ? `Reviewing ${selectedPart.name || `Part ${selectedPart.index + 1}`}` : 'All parts visible'}
              tone={selectedPart ? 'info' : 'neutral'}
            />
          </div>
          {selectedPart ? (
            <div className="rounded-lg border border-sky-400/20 bg-sky-500/10 p-3 text-sm text-sky-50 space-y-2">
              <div className="font-semibold">{selectedPart.name || `Part ${selectedPart.index + 1}`}</div>
              {sizeLabel && <div className="text-xs text-sky-100/80">Envelope {sizeLabel}</div>}
              {selectedPin && selectedPin.partKey === selectedPart.id && (
                <div className="text-xs text-sky-100/80">
                  Pin {selectedPin.x.toFixed(1)}, {selectedPin.y.toFixed(1)}, {selectedPin.z.toFixed(1)}
                </div>
              )}
              <div className="flex flex-wrap gap-2 text-xs">
                <a href={`/models/${modelId}?part=${selectedPart.index}`} className="rounded-full border border-white/10 px-3 py-1.5 hover:border-white/20">
                  Open dedicated part view
                </a>
                <a href="#model-comments-compose" className="rounded-full border border-white/10 px-3 py-1.5 hover:border-white/20">
                  Jump to comments
                </a>
                <button
                  type="button"
                  onClick={() => setSelectedPartKey(null)}
                  className="rounded-full border border-white/10 px-3 py-1.5 hover:border-white/20"
                >
                  Show all parts
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPin(null)}
                  className="rounded-full border border-white/10 px-3 py-1.5 hover:border-white/20"
                >
                  Clear pin
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400">Start in the combined 3D view, then tap any part to focus review metadata without leaving the model page.</p>
          )}
        </div>
      )}
    </div>
  )
}
