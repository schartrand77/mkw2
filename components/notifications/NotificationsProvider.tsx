"use client"
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

type NoticeType = 'success' | 'error' | 'info'
export type Notice = { id: string; type: NoticeType; title?: string; message: string; timeout?: number }

type Ctx = {
  notify: (n: Omit<Notice, 'id'>) => void
}

const NotificationsCtx = createContext<Ctx | null>(null)
const SESSION_KEY = 'mwv2:notify'
const EVENT_KEY = 'mwv2:notify:event'

function rndId() { return Math.random().toString(36).slice(2) }

export function useNotifications() {
  const ctx = useContext(NotificationsCtx)
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider')
  return ctx
}

export function pushSessionNotification(n: Omit<Notice, 'id'>) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(n))
    window.dispatchEvent(new CustomEvent(EVENT_KEY, { detail: n }))
  } catch {}
}

export default function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Notice[]>([])
  const timers = useRef<Record<string, any>>({})

  const notify = useCallback((n: Omit<Notice, 'id'>) => {
    const id = rndId()
    const notice: Notice = { id, ...n }
    setItems(prev => [...prev, notice])
    const t = setTimeout(() => dismiss(id), n.timeout ?? (n.type === 'error' ? 8000 : 4000))
    timers.current[id] = t
  }, [])

  const dismiss = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id))
    const t = timers.current[id]
    if (t) { clearTimeout(t); delete timers.current[id] }
  }, [])

  useEffect(() => {
    const flushSessionQueue = () => {
      try {
        const raw = sessionStorage.getItem(SESSION_KEY)
        if (raw) {
          sessionStorage.removeItem(SESSION_KEY)
          const parsed = JSON.parse(raw)
          if (parsed && parsed.message) notify(parsed)
        }
      } catch {}
    }
    flushSessionQueue()

    const onStorage = (event: StorageEvent) => {
      if (event.key !== SESSION_KEY || !event.newValue) return
      try {
        const parsed = JSON.parse(event.newValue)
        sessionStorage.removeItem(SESSION_KEY)
        if (parsed && parsed.message) notify(parsed)
      } catch {}
    }

    const onCustom = (event: Event) => {
      const detail = (event as CustomEvent<Omit<Notice, 'id'>>).detail
      if (detail && detail.message) notify(detail)
    }

    window.addEventListener('storage', onStorage)
    window.addEventListener(EVENT_KEY, onCustom as EventListener)

    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(EVENT_KEY, onCustom as EventListener)
      Object.values(timers.current).forEach(clearTimeout)
    }
  }, [notify])

  const value = useMemo(() => ({ notify }), [notify])

  return (
    <NotificationsCtx.Provider value={value}>
      {children}
      {/* Toast container */}
      <div className="fixed z-[1000] bottom-4 right-4 space-y-2 w-[92vw] max-w-sm">
        {items.map(n => (
          <div key={n.id} className={`glass border ${
            n.type === 'success' ? 'border-emerald-400/30' : n.type === 'error' ? 'border-red-400/30' : 'border-white/10'
          } rounded-lg p-3 shadow-soft bg-black/60`}> 
            <div className="flex items-start gap-3">
              <div className="text-lg">
                {n.type === 'success' ? '✅' : n.type === 'error' ? '⚠️' : 'ℹ️'}
              </div>
              <div className="flex-1 text-sm">
                {n.title && <div className="font-semibold mb-0.5">{n.title}</div>}
                <div className="text-slate-300">{n.message}</div>
              </div>
              <button className="px-2 py-1 text-xs text-slate-400 hover:text-white" onClick={() => dismiss(n.id)}>Dismiss</button>
            </div>
          </div>
        ))}
      </div>
    </NotificationsCtx.Provider>
  )
}
