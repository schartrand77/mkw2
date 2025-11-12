"use client"
import { useMemo, useState } from 'react'
import ModelViewer from './ModelViewer'

type Part = { id: string; name: string; filePath: string }

type GalleryImage = { id: string; filePath: string; caption?: string | null }

type Props = {
  coverSrc?: string | null
  parts?: Part[]
  allSrc?: string | null
  images?: GalleryImage[]
}

type Item = { key: string; label: string; kind: 'image' | 'three'; src?: string; srcs?: string[] }

function filePublicPath(filePath: string) {
  if (!filePath) return null
  const normalized = filePath.startsWith('/') ? filePath : `/${filePath}`
  return `/files${normalized}`
}

export default function Gallery({ coverSrc, parts = [], allSrc, images = [] }: Props) {
  const items = useMemo<Item[]>(() => {
    const arr: Item[] = []
    const partSrcs = parts.map(p => filePublicPath(p.filePath)).filter((src): src is string => !!src)
    if (partSrcs.length > 0) {
      arr.push({ key: 'three:all', label: '3D View: All parts', kind: 'three', srcs: partSrcs })
      parts.forEach((p, i) => arr.push({ key: `three:${i}`, label: p.name, kind: 'three', src: partSrcs[i] }))
    } else if (allSrc) {
      arr.push({ key: 'three:single', label: '3D View', kind: 'three', src: allSrc })
    }
    if (coverSrc) arr.push({ key: 'image:cover', label: 'Cover', kind: 'image', src: coverSrc })
    if (images.length > 0) {
      images.forEach((img, idx) => {
        const src = filePublicPath(img.filePath)
        if (!src) return
        const label = img.caption?.trim() || `Photo ${idx + 1}`
        arr.push({ key: `gallery:${img.id}`, label, kind: 'image', src })
      })
    }
    return arr
  }, [coverSrc, parts, allSrc, images])

  const [active, setActive] = useState(items[0]?.key)
  const activeItem = items.find(i => i.key === active) || items[0]

  return (
    <div className="w-full">
      <div className="glass rounded-2xl overflow-hidden border border-white/10 shadow-soft">
        <div className="relative">
          {activeItem ? (
            activeItem.kind === 'three' ? (
              activeItem.srcs ? (
                <ModelViewer srcs={activeItem.srcs} height={540} className="bg-black/30" />
              ) : (
                <ModelViewer src={activeItem.src} height={540} className="bg-black/30" />
              )
            ) : activeItem.src ? (
              // image
              <img src={activeItem.src} alt={activeItem.label} className="w-full aspect-video object-cover" />
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
              onClick={() => setActive(it.key)}
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
