'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

type QueueName = 'image-processing' | 'preview-processing' | 'processing-dead-letter'
type QueueState = 'waiting' | 'active' | 'delayed' | 'failed' | 'completed'

type QueueJob = {
  id: string
  name: string
  queueName: string
  data: any
  attemptsMade: number
  maxAttempts: number
  timestamp: number
  processedOn: number | null
  finishedOn: number | null
  failedReason: string | null
}

type ApiPayload = {
  enabled: boolean
  state?: QueueState
  queues: Record<string, QueueJob[]>
  message?: string
}

const QUEUES: QueueName[] = ['image-processing', 'preview-processing', 'processing-dead-letter']

function fmtTime(value?: number | null) {
  if (!value) return '-'
  try { return new Date(value).toLocaleString() } catch { return String(value) }
}

function ageMinutes(value?: number | null) {
  if (!value) return null
  return Math.max(0, Math.round((Date.now() - value) / 60000))
}

export default function ProcessingQueuesPanel() {
  const [state, setState] = useState<QueueState>('failed')
  const [data, setData] = useState<ApiPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch(`/api/admin/processing-queues?state=${encodeURIComponent(state)}&limit=100`, { cache: 'no-store' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error || 'Failed to load processing queues.')
      setData(body)
      if (body?.message) setMessage(body.message)
    } catch (err: any) {
      setError(err?.message || 'Failed to load processing queues.')
    } finally {
      setLoading(false)
    }
  }, [state])

  useEffect(() => { load().catch(() => {}) }, [load])

  const retryJob = async (queue: QueueName, jobId: string) => {
    setBusy(`${queue}:${jobId}`)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/processing-queues/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queue, jobId }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error || 'Retry failed.')
      setMessage('Job replay/retry queued.')
      await load()
    } catch (err: any) {
      setError(err?.message || 'Retry failed.')
    } finally {
      setBusy(null)
    }
  }

  const replayStuck = async (queue: QueueName) => {
    setBusy(`${queue}:stuck`)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/processing-queues/requeue-stuck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queue, olderThanMinutes: 15, limit: 20 }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error || 'Stuck replay failed.')
      setMessage(`Queued ${body?.queued || 0} replay job(s).`)
      await load()
    } catch (err: any) {
      setError(err?.message || 'Stuck replay failed.')
    } finally {
      setBusy(null)
    }
  }

  const queueEntries = useMemo(() => {
    const payload = data?.queues || {}
    return QUEUES.map((name) => ({ name, jobs: payload[name] || [] }))
  }, [data])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <label className="text-xs text-slate-400">State</label>
        <select className="input w-40" value={state} onChange={(e) => setState(e.target.value as QueueState)}>
          <option value="failed">Failed</option>
          <option value="active">Active</option>
          <option value="waiting">Waiting</option>
          <option value="delayed">Delayed</option>
          <option value="completed">Completed</option>
        </select>
        <button type="button" className="px-3 py-2 rounded-md border border-white/10 hover:border-white/20" onClick={() => load()} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && <p className="text-sm text-rose-300">{error}</p>}
      {message && <p className="text-sm text-emerald-300">{message}</p>}

      {data && !data.enabled && (
        <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-100">
          {data.message || 'Broker disabled. Set REDIS_URL and run worker process.'}
        </div>
      )}

      {queueEntries.map((entry) => (
        <div key={entry.name} className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{entry.name} ({entry.jobs.length})</h3>
            {(entry.name === 'image-processing' || entry.name === 'preview-processing') && (
              <button
                type="button"
                className="px-2 py-1 rounded-md border border-white/15 text-xs hover:border-white/30"
                onClick={() => replayStuck(entry.name)}
                disabled={busy === `${entry.name}:stuck`}
              >
                {busy === `${entry.name}:stuck` ? 'Replaying...' : 'Replay stuck 15m+'}
              </button>
            )}
          </div>
          <div className="space-y-2">
            {entry.jobs.length === 0 && <p className="text-xs text-slate-500">No jobs in this state.</p>}
            {entry.jobs.map((job) => {
              const key = `${entry.name}:${job.id}`
              const started = job.processedOn || job.timestamp
              const age = ageMinutes(started)
              const stuck = state === 'active' && age != null && age >= 15
              return (
                <div key={job.id} className="rounded-md border border-white/10 p-2 text-xs space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono break-all">{job.id}</span>
                    <button
                      type="button"
                      className="px-2 py-1 rounded-md border border-white/15 hover:border-white/30"
                      onClick={() => retryJob(entry.name, job.id)}
                      disabled={busy === key}
                    >
                      {busy === key ? 'Working...' : (entry.name === 'processing-dead-letter' ? 'Replay' : 'Retry')}
                    </button>
                  </div>
                  <div className="text-slate-400">attempts: {job.attemptsMade}/{job.maxAttempts}</div>
                  <div className="text-slate-400">queued: {fmtTime(job.timestamp)} | started: {fmtTime(job.processedOn)} | done: {fmtTime(job.finishedOn)}</div>
                  {stuck && <div className="text-amber-300">Potentially stuck ({age}m active)</div>}
                  {job.failedReason && <div className="text-rose-300">{job.failedReason}</div>}
                  <pre className="bg-black/30 rounded p-2 whitespace-pre-wrap break-all">{JSON.stringify(job.data, null, 2)}</pre>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
