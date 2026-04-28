"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { trackPwaInstallEvent } from '@/lib/pwa-install-analytics'

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
  const [showIosPrompt, setShowIosPrompt] = useState(false)
  const dismissedRef = useRef(false)
  const brandName = useMemo(() => resolveBrandName(), [])

  const isIosLikeDevice = () => {
    if (typeof window === 'undefined') return false
    const ua = window.navigator.userAgent
    const platform = window.navigator.platform
    const touchPoints = window.navigator.maxTouchPoints || 0
    return /iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && touchPoints > 1)
  }

  const isStandalone = () => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  }

  const persistDismissed = useCallback(() => {
    setDismissed(true)
    dismissedRef.current = true
    setShowIosPrompt(false)
    try { localStorage.setItem(STORAGE_KEY, '1') } catch {}
  }, [])

  const promptInstall = useCallback(async (installEvent: BeforeInstallPromptEvent) => {
    await installEvent.prompt()
    const choice = await installEvent.userChoice
    setEvent(null)
    trackPwaInstallEvent(choice.outcome, { platform: choice.platform || installEvent.platforms?.join(',') || 'web', source: 'prompt' })
    if (choice.outcome === 'accepted' || choice.outcome === 'dismissed') {
      persistDismissed()
    }
  }, [persistDismissed])

  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null
      if (stored === '1') {
        setDismissed(true)
        dismissedRef.current = true
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isStandalone()) return

    if (isIosLikeDevice()) {
      if (!dismissedRef.current) {
        setShowIosPrompt(true)
        trackPwaInstallEvent('ios_instruction_shown', { platform: 'ios', source: 'ios-instructions' })
      }
      return
    }

    const onBeforeInstall = (e: Event) => {
      if (dismissedRef.current) return
      e.preventDefault()
      const installEvent = e as BeforeInstallPromptEvent
      setEvent(installEvent)
      setDismissed(false)
      void promptInstall(installEvent).catch(() => {})
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [promptInstall])

  const handleInstall = async () => {
    if (!event) return
    try {
      await promptInstall(event)
    } catch {
      setEvent(null)
    }
  }

  const handleDismiss = () => {
    setEvent(null)
    trackPwaInstallEvent('dismissed', { platform: showIosPrompt ? 'ios' : 'web', source: showIosPrompt ? 'ios-instructions' : 'prompt' })
    persistDismissed()
  }

  if (dismissed) return null
  if (!event && !showIosPrompt) return null

  return (
    <div className="fixed bottom-6 right-6 z-[1100] w-[92vw] max-w-xs glass border border-white/15 rounded-2xl bg-black/70 backdrop-blur p-4 shadow-[0_10px_35px_rgba(0,0,0,0.55)]">
      <div className="text-sm space-y-2">
        <div className="font-semibold text-base">Install {brandName}?</div>
        {showIosPrompt ? (
          <p className="text-slate-300 leading-relaxed">
            On iPad Safari, open Share and choose Add to Home Screen for a fullscreen install sized for large displays.
          </p>
        ) : (
          <p className="text-slate-300 leading-relaxed">
            Add the app to your home screen for fullscreen access and offline-ready caching.
          </p>
        )}
        <div className="flex gap-2 pt-1">
          {showIosPrompt ? (
            <button
              className="flex-1 rounded-md bg-brand-500/90 hover:bg-brand-500 text-sm font-semibold py-2 transition"
              onClick={handleDismiss}
            >
              I’ll do it
            </button>
          ) : (
            <button
              className="flex-1 rounded-md bg-brand-500/90 hover:bg-brand-500 text-sm font-semibold py-2 transition"
              onClick={handleInstall}
            >
              Install
            </button>
          )}
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
