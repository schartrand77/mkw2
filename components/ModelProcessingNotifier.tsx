"use client"

import { useEffect, useRef, useState } from 'react'
import { useNotifications } from '@/components/notifications/NotificationsProvider'

type Props = {
  modelId: string
  enabled: boolean
  initialCoverProcessing: boolean
  initialPreviewProcessing: boolean
  pollMs?: number
}

type ModelResponse = {
  model?: {
    coverImageStatus?: string | null
    parts?: Array<{ filePath?: string | null; previewFilePath?: string | null }>
  }
}

function computePreviewProcessing(model?: ModelResponse['model']) {
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
  initialPreviewProcessing,
  pollMs = 12000,
}: Props) {
  const { notify } = useNotifications()
  const [active, setActive] = useState(enabled && (initialCoverProcessing || initialPreviewProcessing))
  const stateRef = useRef({
    cover: initialCoverProcessing,
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
        const previewProcessing = computePreviewProcessing(data.model)
        const prev = stateRef.current
        if (prev.cover && !coverProcessing) {
          notify({ type: 'success', title: 'Cover image ready', message: 'Your cover image finished processing.' })
        }
        if (prev.preview && !previewProcessing) {
          notify({ type: 'success', title: 'Model preview ready', message: 'Your 3MF preview is ready to view.' })
        }
        stateRef.current = { cover: coverProcessing, preview: previewProcessing }
        if (!coverProcessing && !previewProcessing) {
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
  }, [active, enabled, modelId, notify, pollMs])

  return null
}
