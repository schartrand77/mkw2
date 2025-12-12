"use client"
import { useEffect, useMemo, useRef, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  readonly platforms?: string[]
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const STORAGE_KEY = 'mwv2:pwa-install-dismissed'
const BRAND_FALLBACK = 'MakerWorks'

function resolveBrandName() {
  if (typeof process === 'undefined') return BRAND_FALLBACK
  const raw = process.env.NEXT_PUBLIC_BRAND_NAME || process.env.BRAND_NAME || ''
  return raw.trim().length > 0 ? raw : BRAND_FALLBACK
}

export default function PWAInstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const dismissedRef = useRef(false)
  const brandName = useMemo(() => resolveBrandName(), [])

  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null
      if (stored === '1') {
        setDismissed(true)
        dismissedRef.current = true
      }
    } catch {}
  }, [dismissedRef])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(display-mode: standalone)').matches) return

    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      if (dismissedRef.current) return
      setEvent(e as BeforeInstallPromptEvent)
      setDismissed(false)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [])

  const handleInstall = async () => {
    if (!event) return
    try {
      await event.prompt()
      const choice = await event.userChoice
      if (choice.outcome === 'accepted') {
        setEvent(null)
        setDismissed(true)
        dismissedRef.current = true
        try { localStorage.setItem(STORAGE_KEY, '1') } catch {}
      }
    } catch {
      setEvent(null)
    }
  }

  const handleDismiss = () => {
    setEvent(null)
    setDismissed(true)
    dismissedRef.current = true
    try { localStorage.setItem(STORAGE_KEY, '1') } catch {}
  }

  if (!event || dismissed) return null

  return (
    <div className="fixed bottom-6 right-6 z-[1100] w-[92vw] max-w-xs glass border border-white/15 rounded-2xl bg-black/70 backdrop-blur p-4 shadow-[0_10px_35px_rgba(0,0,0,0.55)]">
      <div className="text-sm space-y-2">
        <div className="font-semibold text-base">Install {brandName}?</div>
        <p className="text-slate-300 leading-relaxed">
          Add the app to your home screen for fullscreen access and offline-ready caching.
        </p>
        <div className="flex gap-2 pt-1">
          <button
            className="flex-1 rounded-md bg-brand-500/90 hover:bg-brand-500 text-sm font-semibold py-2 transition"
            onClick={handleInstall}
          >
            Install
          </button>
          <button
            className="px-3 text-xs text-slate-400 hover:text-white"
            onClick={handleDismiss}
          >
            Later
          </button>
        </div>
      </div>
    </div>
  )
}
