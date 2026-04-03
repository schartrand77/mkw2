'use client'

import { useEffect } from 'react'

function reportClientError(payload: Record<string, unknown>) {
  const body = JSON.stringify(payload)
  const url = '/api/client-errors'
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' })
      navigator.sendBeacon(url, blob)
      return
    }
  } catch {
    // Fall through to fetch.
  }
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {})
}

export default function ClientErrorReporter() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      reportClientError({
        source: 'window.error',
        message: event.message || 'Unhandled error',
        stack: event.error?.stack || null,
        page: window.location.pathname,
        userAgent: navigator.userAgent,
      })
    }

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      const message = reason instanceof Error
        ? reason.message
        : typeof reason === 'string'
          ? reason
          : 'Unhandled promise rejection'
      reportClientError({
        source: 'window.unhandledrejection',
        message,
        stack: reason instanceof Error ? reason.stack : null,
        page: window.location.pathname,
        userAgent: navigator.userAgent,
      })
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onUnhandledRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onUnhandledRejection)
    }
  }, [])

  return null
}
