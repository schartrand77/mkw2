"use client"
import { useEffect, useState } from 'react'
import { useNotifications } from './NotificationsProvider'

type Item = { id: string; content: string; author: string; timestamp: string }

function useDismissed() {
  const key = 'mwv2:dismissedAnnouncements'
  const [set, setSet] = useState<Set<string>>(new Set())
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw) setSet(new Set(JSON.parse(raw)))
    } catch {}
  }, [])
  const save = (s: Set<string>) => {
    setSet(new Set(s))
    try { localStorage.setItem(key, JSON.stringify(Array.from(s))) } catch {}
  }
  return {
    isDismissed: (id: string) => set.has(id),
    dismiss: (id: string) => { const s = new Set(set); s.add(id); save(s) },
  }
}

export default function Announcements() {
  const [items, setItems] = useState<Item[]>([])
  const { notify } = useNotifications()
  const { isDismissed, dismiss } = useDismissed()

  useEffect(() => {
    let t: any
    const load = async () => {
      try {
        const res = await fetch('/api/announcements', { cache: 'no-store' })
        const data = await res.json()
        const list: Item[] = Array.isArray(data.items) ? data.items : []
        setItems(list)
        // Optionally bubble a passive heads-up on first mount
      } catch {}
    }
    load()
    t = setInterval(load, 60000)
    return () => { if (t) clearInterval(t) }
  }, [])

  const visible = items.filter(i => !isDismissed(i.id))
  if (visible.length === 0) return null
  return (
    <div className="fixed left-4 bottom-4 z-[900] space-y-2 w-[92vw] max-w-md">
      {visible.map(i => (
        <div key={i.id} className="glass rounded-lg border border-white/10 p-3 bg-black/60">
          <div className="text-xs text-slate-400 mb-1">From Discord • {new Date(i.timestamp).toLocaleString()}</div>
          <div className="whitespace-pre-wrap text-sm">{i.content}</div>
          <div className="mt-2 flex items-center gap-2">
            <button className="px-2 py-1 rounded-md border border-white/10 text-xs hover:border-white/20" onClick={() => dismiss(i.id)}>Dismiss</button>
            <button className="px-2 py-1 rounded-md border border-white/10 text-xs hover:border-white/20"
              onClick={() => { notify({ type: 'info', title: 'Confirmed', message: 'You confirmed an announcement.' }); dismiss(i.id) }}
            >Confirm</button>
          </div>
        </div>
      ))}
    </div>
  )
}

