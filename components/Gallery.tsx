"use client"
import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { toPublicHref } from '@/lib/public-path'

const LazyModelViewer = dynamic(() => import('./ModelViewer'), { ssr: false })

type Part = { id: string; name: string; filePath: string; previewFilePath?: string | null }

type GalleryImage = { id: string; filePath: string; caption?: string | null }

type Props = {
  coverSrc?: string | null
  parts?: Part[]
  allSrc?: string | null
  images?: GalleryImage[]
  initialKey?: string
}

type Item = { key: string; label: string; kind: 'image' | 'three'; src?: string; srcs?: string[] }

export default function Gallery({ coverSrc, parts = [], allSrc, images = [], initialKey }: Props) {
  const items = useMemo<Item[]>(() => {
    const arr: Item[] = []
    const partSrcs = parts.map(p => toPublicHref(p.previewFilePath || p.filePath)).filter((src): src is string => !!src)
    const normalizedAllSrc = allSrc || (partSrcs.length === 1 ? partSrcs[0] : null)

    if (coverSrc) arr.push({ key: 'image:cover', label: 'Cover', kind: 'image', src: coverSrc })
    if (images.length > 0) {
      images.forEach((img, idx) => {
        const src = toPublicHref(img.filePath)
        if (!src) return
        const label = img.caption?.trim() || `Photo ${idx + 1}`
        arr.push({ key: `gallery:${img.id}`, label, kind: 'image', src })
      })
    }

    if (normalizedAllSrc) {
      arr.push({ key: 'three:all', label: '3D View', kind: 'three', src: normalizedAllSrc })
    } else if (partSrcs.length > 0) {
      arr.push({ key: 'three:all', label: '3D View: All parts', kind: 'three', srcs: partSrcs })
    }

    if (partSrcs.length > 0) {
      parts.forEach((p, i) => arr.push({ key: `three:${i}`, label: p.name, kind: 'three', src: partSrcs[i] }))
    }
    return arr
  }, [coverSrc, parts, allSrc, images])

  const initialActiveKey = useMemo(() => {
    if (initialKey && items.some(i => i.key === initialKey)) return initialKey
    return items[0]?.key
  }, [initialKey, items])

  const [active, setActive] = useState<string | undefined>(initialActiveKey)
  const [viewerEnabled, setViewerEnabled] = useState<boolean>(() => Boolean(initialActiveKey && initialActiveKey.startsWith('three:')))
  const prevInitialKeyRef = useRef(initialKey)

  useEffect(() => {
    const initialChanged = prevInitialKeyRef.current !== initialKey
    prevInitialKeyRef.current = initialKey

    if (!items.length) {
      if (active !== undefined) setActive(undefined)
      return
    }
    const preferred = initialKey && items.find(i => i.key === initialKey)?.key
    const activeValid = active && items.some(i => i.key === active)
    if (initialChanged) {
      if (preferred) {
        if (preferred !== active) setActive(preferred)
        if (preferred.startsWith('three:')) setViewerEnabled(true)
        return
      }
      if (!preferred && active !== items[0]?.key) {
        setActive(items[0]?.key)
        return
      }
    }
    if (!activeValid) setActive(preferred || items[0]?.key)
  }, [initialKey, items, active])

  useEffect(() => {
    if (active && active.startsWith('three:')) setViewerEnabled(true)
  }, [active])

  const activeItem = items.find(i => i.key === active) || items[0]
  const enableViewer = () => setViewerEnabled(true)

  const handleSelect = (item: Item) => {
    setActive(item.key)
    if (item.kind === 'three') setViewerEnabled(true)
  }

  return (
    <div className="w-full">
      <div className="glass rounded-2xl overflow-hidden border border-white/10 shadow-soft">
        <div className="relative">
          {activeItem ? (
            activeItem.kind === 'three' ? (
              viewerEnabled ? (
                activeItem.srcs ? (
                  <LazyModelViewer srcs={activeItem.srcs} height={540} className="bg-black/30" />
                ) : (
                  <LazyModelViewer src={activeItem.src} height={540} className="bg-black/30" />
                )
              ) : (
                <div className="aspect-video w-full bg-slate-900/60 flex items-center justify-center text-center px-6">
                  <button
                    type="button"
                    className="btn"
                    onClick={enableViewer}
                  >
                    Load interactive 3D preview
                  </button>
                </div>
              )
            ) : activeItem.src ? (
              <img
                src={activeItem.src}
                alt={activeItem.label}
                className="w-full aspect-video object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="aspect-video w-full bg-slate-900/60 flex items-center justify-center text-slate-400">No preview</div>
            )
          ) : (
            <div className="aspect-video w-full bg-slate-900/60 flex items-center justify-center text-slate-400">No preview</div>
          )}
          {activeItem && (
            <div className="absolute top-3 left-3 text-xs px-2 py-1 rounded-md border border-white/10 bg-black/40">{activeItem.kind === 'three' ? '3D' : 'Image'}</div>
          )}
        </div>
      </div>
      {items.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {items.map((it) => (
            <button
              key={it.key}
              type="button"
              onClick={() => handleSelect(it)}
              className={`px-2 py-1 rounded-md border text-xs ${active === it.key ? 'bg-brand-600 border-brand-600 text-white' : 'border-white/10 hover:border-white/20'}`}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
