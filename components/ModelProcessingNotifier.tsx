"use client"

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useNotifications } from '@/components/notifications/NotificationsProvider'

type Props = {
  modelId: string
  enabled: boolean
  initialCoverProcessing: boolean
  initialGalleryProcessing: boolean
  initialPreviewProcessing: boolean
  pollMs?: number
}

type ModelResponse = {
  model?: {
    coverImageStatus?: string | null
    images?: Array<{ status?: string | null }>
    previewProcessing?: boolean | null
    parts?: Array<{ filePath?: string | null; previewFilePath?: string | null }>
  }
}

function computeGalleryProcessing(model?: ModelResponse['model']) {
  if (!model?.images || model.images.length === 0) return false
  return model.images.some((image) => image.status === 'processing')
}

function computePreviewProcessing(model?: ModelResponse['model']) {
  if (typeof model?.previewProcessing === 'boolean') return model.previewProcessing
  if (!model?.parts || model.parts.length === 0) return false
  return model.parts.some((part) => {
    const filePath = String(part.filePath || '').toLowerCase()
    return filePath.endsWith('.3mf') && !part.previewFilePath
  })
}

export default function ModelProcessingNotifier({
  modelId,
  enabled,
  initialCoverProcessing,
  initialGalleryProcessing,
  initialPreviewProcessing,
  pollMs = 12000,
}: Props) {
  const router = useRouter()
  const { notify } = useNotifications()
  const [active, setActive] = useState(enabled && (initialCoverProcessing || initialGalleryProcessing || initialPreviewProcessing))
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null)
  const stateRef = useRef({
    cover: initialCoverProcessing,
    gallery: initialGalleryProcessing,
    preview: initialPreviewProcessing,
  })

  useEffect(() => {
    if (!enabled) return
    if (!active) return
    let cancelled = false

    const tick = async () => {
      try {
        const res = await fetch(`/api/models/${modelId}`, { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as ModelResponse
        if (cancelled) return
        const coverProcessing = data.model?.coverImageStatus === 'processing'
        const galleryProcessing = computeGalleryProcessing(data.model)
        const previewProcessing = computePreviewProcessing(data.model)
        setLastCheckedAt(new Date())
        const prev = stateRef.current
        if (prev.cover && !coverProcessing) {
          notify({ type: 'success', title: 'Cover image ready', message: 'Your cover image finished processing.' })
        }
        if (prev.gallery && !galleryProcessing) {
          notify({ type: 'success', title: 'Gallery photos ready', message: 'Your new photos finished processing.' })
        }
        if (prev.preview && !previewProcessing) {
          notify({ type: 'success', title: 'Model preview ready', message: 'Your 3MF preview is ready to view.' })
        }
        stateRef.current = { cover: coverProcessing, gallery: galleryProcessing, preview: previewProcessing }
        const hasProcessing = coverProcessing || galleryProcessing || previewProcessing
        const completedProcessing = (prev.cover && !coverProcessing) || (prev.gallery && !galleryProcessing) || (prev.preview && !previewProcessing)
        if (completedProcessing) {
          router.refresh()
        }
        if (!hasProcessing) {
          setActive(false)
        }
      } catch {
        // ignore polling errors
      }
    }

    void tick()
    const interval = setInterval(tick, pollMs)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [active, enabled, modelId, notify, pollMs, router])

  if (!enabled || !active) return null

  return (
    <div className="glass rounded-xl p-4 text-sm text-slate-200 border border-amber-400/30">
      <div className="font-semibold text-amber-200">Refreshing when processing completes</div>
      <p className="text-slate-300 mt-1">
        New media is still processing. This page checks again every {Math.round(pollMs / 1000)} seconds and refreshes automatically when ready.
      </p>
      {lastCheckedAt && (
        <p className="text-xs text-slate-400 mt-2">
          Last checked {lastCheckedAt.toLocaleTimeString()}
        </p>
      )}
    </div>
  )
}
