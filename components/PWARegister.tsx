"use client"
import { useEffect } from 'react'

export default function PWARegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if ('serviceWorker' in navigator) {
      const swUrl = '/sw.js'
      navigator.serviceWorker
        .register(swUrl)
        .then((registration) => {
          if (process.env.NODE_ENV !== 'production') {
            console.info('[PWA] service worker registered:', registration.scope)
          }
        })
        .catch((err) => {
          console.error('[PWA] service worker registration failed', err)
        })
    }
  }, [])
  return null
}
