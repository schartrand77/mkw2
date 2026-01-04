"use client"

import { useCallback, useEffect, useState } from 'react'
import { pushSessionNotification } from '@/components/notifications/NotificationsProvider'

const PUBLIC_VAPID_KEY = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '').trim()
const HAS_PUBLIC_KEY = Boolean(PUBLIC_VAPID_KEY)

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i)
  }
  return output
}

export default function PushNotificationsCard() {
  const [supported, setSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshStatus = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setSupported(false)
      return
    }
    setSupported(true)
    setPermission(Notification.permission)
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    setSubscribed(Boolean(subscription))
  }, [])

  useEffect(() => {
    refreshStatus().catch((err) => {
      console.error('Failed to refresh push status', err)
      setError('Unable to read notification status.')
    })
  }, [refreshStatus])

  const enablePush = async () => {
    if (!supported || !HAS_PUBLIC_KEY) return
    setBusy(true)
    setError(null)
    try {
      let nextPermission = Notification.permission
      if (nextPermission === 'default') {
        nextPermission = await Notification.requestPermission()
      }
      setPermission(nextPermission)
      if (nextPermission !== 'granted') {
        setError('Browser blocked notifications. Update your permission settings and try again.')
        return
      }
      const registration = await navigator.serviceWorker.ready
      const existing = await registration.pushManager.getSubscription()
      if (existing) {
        await syncSubscription(existing)
        setSubscribed(true)
        pushSessionNotification({ type: 'info', title: 'Notifications already enabled', message: 'This device is already subscribed.' })
        return
      }
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY),
      })
      await syncSubscription(subscription)
      setSubscribed(true)
      pushSessionNotification({ type: 'success', title: 'Notifications enabled', message: 'Admin alerts will appear even when offline.' })
    } catch (err: any) {
      console.error('Failed to enable push notifications', err)
      setError(err?.message || 'Unable to enable notifications.')
    } finally {
      setBusy(false)
    }
  }

  const disablePush = async () => {
    if (!supported) return
    setBusy(true)
    setError(null)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        setSubscribed(false)
        return
      }
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      })
      await subscription.unsubscribe()
      setSubscribed(false)
      pushSessionNotification({ type: 'info', title: 'Notifications disabled', message: 'This device will no longer receive admin alerts.' })
    } catch (err: any) {
      console.error('Failed to disable push notifications', err)
      setError(err?.message || 'Unable to disable notifications.')
    } finally {
      setBusy(false)
    }
  }

  const syncSubscription = async (subscription: PushSubscription) => {
    const payload = subscription.toJSON()
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data?.error || 'Unable to store subscription.')
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold">Admin push alerts</div>
          <p className="text-xs text-slate-400 mt-1">
            Receive offline push notifications on this device for new users, uploads, and payment activity.
          </p>
        </div>
        <button
          type="button"
          className="rounded-md border border-white/10 px-3 py-2 text-xs hover:border-white/30 disabled:opacity-50"
          onClick={() => refreshStatus()}
          disabled={busy}
        >
          Refresh
        </button>
      </div>
      <div className="mt-3 text-xs text-slate-300 space-y-1">
        <div>Status: <span className={subscribed ? 'text-emerald-300' : 'text-slate-300'}>{subscribed ? 'Enabled' : 'Disabled'}</span></div>
        <div>Permission: <span className="text-slate-300">{permission}</span></div>
        {!supported && <div className="text-amber-300">Push notifications are not supported in this browser.</div>}
        {supported && !HAS_PUBLIC_KEY && <div className="text-amber-300">Missing `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.</div>}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-md border border-white/10 px-4 py-2 text-xs hover:border-white/30 disabled:opacity-50"
          onClick={enablePush}
          disabled={busy || !supported || !HAS_PUBLIC_KEY}
        >
          {busy ? 'Working...' : subscribed ? 'Re-enable' : 'Enable'}
        </button>
        <button
          type="button"
          className="rounded-md border border-white/10 px-4 py-2 text-xs hover:border-white/30 disabled:opacity-50"
          onClick={disablePush}
          disabled={busy || !supported || !subscribed}
        >
          Disable
        </button>
      </div>
      {error && <div className="mt-3 text-xs text-amber-300">{error}</div>}
    </div>
  )
}
