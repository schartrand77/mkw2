"use client"
import { useEffect, useMemo, useState } from 'react'

type Model = { id: string; title: string; coverImagePath?: string | null }

export default function FeaturedManager({ initial }: { initial: Model[] }) {
  const [featured, setFeatured] = useState<Model[]>(initial)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Model[]>([])
  const [saving, setSaving] = useState(false)
  const ids = useMemo(() => new Set(featured.map(m => m.id)), [featured])

  useEffect(() => {
    let active = true
    const run = async () => {
      if (!query.trim()) { setResults([]); return }
      const res = await fetch(`/api/admin/search-models?q=${encodeURIComponent(query)}`)
      if (!res.ok) return
      const data = await res.json()
      if (active) setResults(data.models)
    }
    const t = setTimeout(run, 250)
    return () => { active = false; clearTimeout(t) }
  }, [query])

  const add = (m: Model) => { if (!ids.has(m.id)) setFeatured((prev) => [...prev, m]) }
  const remove = (id: string) => setFeatured((prev) => prev.filter(m => m.id !== id))
  const move = (i: number, dir: -1 | 1) => {
    setFeatured((prev) => {
      const arr = prev.slice()
      const j = i + dir
      if (j < 0 || j >= arr.length) return prev
      const tmp = arr[i]
      arr[i] = arr[j]
      arr[j] = tmp
      return arr
    })
  }
  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/featured', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ modelIds: featured.map(f => f.id) }) })
      if (!res.ok) throw new Error(await res.text())
      alert('Featured list saved')
    } catch (e: any) {
      alert(e.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Featured models</h2>
      <div className="flex gap-2">
        <input className="input" placeholder="Search to add" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {results.length > 0 && (
        <div className="glass rounded-xl p-3 border border-white/10">
          <div className="text-xs text-slate-400 mb-2">Search results</div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {results.map(r => (
              <button key={r.id} type="button" onClick={() => add(r)} className="text-left glass rounded-lg overflow-hidden border border-white/10 hover:border-white/20">
                {r.coverImagePath ? (
                  <img src={`/files${r.coverImagePath}`} className="aspect-video w-full object-cover" />
                ) : (
                  <div className="aspect-video w-full bg-slate-900/60" />
                )}
                <div className="p-2 text-sm">{r.title}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="glass rounded-xl p-3 border border-white/10">
        <div className="text-xs text-slate-400 mb-2">Current featured</div>
        {featured.length === 0 && <div className="text-slate-400 text-sm">No featured models selected.</div>}
        <ul className="divide-y divide-white/10">
          {featured.map((m, i) => (
            <li key={m.id} className="flex items-center gap-3 py-2">
              {m.coverImagePath ? (
                <img src={`/files${m.coverImagePath}`} className="w-16 h-10 object-cover rounded border border-white/10" />
              ) : (
                <div className="w-16 h-10 bg-slate-900/60 rounded border border-white/10" />
              )}
              <div className="flex-1 text-sm">{m.title}</div>
              <div className="flex gap-2">
                <button type="button" className="px-2 py-1 rounded-md border border-white/10" onClick={() => move(i, -1)}>↑</button>
                <button type="button" className="px-2 py-1 rounded-md border border-white/10" onClick={() => move(i, 1)}>↓</button>
                <button type="button" className="px-2 py-1 rounded-md border border-white/10" onClick={() => remove(m.id)}>Remove</button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <button className="btn" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Featured'}</button>
    </div>
  )
}

