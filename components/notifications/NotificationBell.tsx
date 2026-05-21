"use client"

import { useEffect, useMemo, useState } from 'react'
import { buildNotificationCenterItems, type AnnouncementNotification } from '@/lib/notification-center'

const READ_KEY = 'mwv2:notificationCenter:read'
const DISMISSED_KEY = 'mwv2:dismissedAnnouncements'

function loadIdSet(key: string) {
  if (typeof window === 'undefined') return new Set<string>()
  try {
    const raw = localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(parsed) ? parsed.map(String) : [])
  } catch {
    return new Set<string>()
  }
}

function saveIdSet(key: string, values: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(values)))
  } catch {}
}

export default function NotificationBell() {
  const [announcements, setAnnouncements] = useState<AnnouncementNotification[]>([])
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    setReadIds(loadIdSet(READ_KEY))
    setDismissedIds(loadIdSet(DISMISSED_KEY))
  }, [])

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setInterval> | null = null
    const load = async () => {
      try {
        const res = await fetch('/api/notifications/discord', { cache: 'no-store' })
        const data = await res.json().catch(() => null)
        const list = Array.isArray(data?.items) ? data.items : []
        if (!cancelled) setAnnouncements(list)
      } catch {}
    }
    load()
    timer = setInterval(load, 60000)
    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
    }
  }, [])

  const center = useMemo(() => buildNotificationCenterItems({
    announcements,
    dismissedIds,
    readIds,
  }), [announcements, dismissedIds, readIds])

  const markRead = (id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      saveIdSet(READ_KEY, next)
      return next
    })
  }

  const markAllRead = () => {
    const next = new Set(center.items.map((item) => item.id))
    setReadIds(next)
    saveIdSet(READ_KEY, next)
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="relative flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-black/20 text-slate-200 hover:border-white/25 hover:text-white"
        aria-label={`Open notifications${center.unreadCount ? `, ${center.unreadCount} unread` : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 17H9" />
          <path d="M18 10a6 6 0 0 0-12 0c0 4-2 5-2 5h16s-2-1-2-5" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {center.unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-4 text-white">
            {center.unreadCount > 9 ? '9+' : center.unreadCount}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-[1100] mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-white/10 bg-slate-950/95 p-2 text-sm text-slate-100 shadow-2xl"
        >
          <div className="flex items-center justify-between gap-3 px-2 py-1.5">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Notifications</div>
            {center.items.length > 0 ? (
              <button type="button" className="text-xs text-brand-200 hover:text-brand-100" onClick={markAllRead}>
                Mark read
              </button>
            ) : null}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {center.items.length === 0 ? (
              <div className="px-2 py-5 text-center text-xs text-slate-500">No notifications yet.</div>
            ) : center.items.map((item) => {
              const expanded = expandedId === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  className="block w-full rounded-md px-2 py-2 text-left hover:bg-white/5"
                  onClick={() => {
                    setExpandedId(expanded ? null : item.id)
                    markRead(item.id)
                  }}
                >
                  <div className="flex items-start gap-2">
                    <span className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${item.read ? 'bg-slate-600' : 'bg-red-500'}`} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-medium text-white">{item.title}</span>
                        <span className="flex-shrink-0 text-[10px] text-slate-500">{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </span>
                      <span className={expanded ? 'mt-1 block whitespace-pre-wrap text-xs text-slate-300' : 'mt-1 block truncate text-xs text-slate-300'}>
                        {expanded ? item.content : item.preview}
                      </span>
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
