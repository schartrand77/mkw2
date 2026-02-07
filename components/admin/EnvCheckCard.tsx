'use client'

import { useEffect, useState } from 'react'
import { pushSessionNotification } from '@/components/notifications/NotificationsProvider'

const STATUS_CLASS: Record<string, string> = {
  ok: 'bg-emerald-500/20 text-emerald-200',
  warn: 'bg-amber-500/20 text-amber-200',
}

type Check = {
  key: string
  label: string
  required: boolean
  ok: boolean
  detail?: string | null
}

type EnvCheckResponse = {
  ok: boolean
  checks: Check[]
}

export default function EnvCheckCard() {
  const [checks, setChecks] = useState<Check[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/env-check', { cache: 'no-store' })
      const data = (await res.json().catch(() => null)) as EnvCheckResponse | null
      if (!res.ok || !data) throw new Error(data?.ok === false ? 'Environment check failed' : 'Unable to load checks')
      setChecks(data.checks || [])
    } catch (err: any) {
      pushSessionNotification({ type: 'error', title: 'Env check failed', message: err?.message || 'Unable to load environment checks.' })
      setChecks([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load().catch(() => {}) }, [])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Environment validation</h2>
          <p className="text-xs text-slate-400">Verify required credentials and integration keys.</p>
        </div>
        <button
          type="button"
          className="px-3 py-1.5 rounded-md border border-white/10 hover:border-white/30 text-xs"
          onClick={() => load()}
          disabled={loading}
        >
          {loading ? 'Checking...' : 'Recheck'}
        </button>
      </div>
      <div className="grid gap-2">
        {checks.length === 0 ? (
          <div className="text-sm text-slate-500">No checks available.</div>
        ) : (
          checks.map((check) => (
            <div key={check.key} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-200">{check.label}</div>
                <div className="text-xs text-slate-500">{check.required ? 'Required' : 'Optional'} - {check.key}</div>
                {!check.ok && check.detail ? (
                  <div className="text-xs text-amber-300 mt-1">{check.detail}</div>
                ) : null}
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs ${check.ok ? STATUS_CLASS.ok : STATUS_CLASS.warn}`}>
                {check.ok ? 'OK' : 'Missing'}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
