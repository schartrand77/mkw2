"use client"

import Link from 'next/link'
import { useEffect, useState } from 'react'

type BackupMeta = { folder: string; createdAt: string; downloadUrl?: string | null }

export default function BackupControls() {
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(false)
  const [backups, setBackups] = useState<BackupMeta[]>([])
  const [selected, setSelected] = useState('')
  const [pending, setPending] = useState<{ folder: string; scheduledAt: string } | null>(null)
  const [latestMessage, setLatestMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmRestore, setConfirmRestore] = useState(false)

  const loadBackups = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/restore')
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to load backups')
      setBackups(data.backups || [])
      setPending(data.pending || null)
      if (data.backups?.length) {
        setSelected((prev) => (prev && data.backups.some((b: BackupMeta) => b.folder === prev) ? prev : data.backups[0].folder))
      } else {
        setSelected('')
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load backups')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBackups()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const triggerBackup = async () => {
    setCreating(true)
    setLatestMessage(null)
    setError(null)
    try {
      const res = await fetch('/api/admin/backup', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to create backup')
      setLatestMessage(`Backup created: ${data.folder}`)
      await loadBackups()
    } catch (err: any) {
      setError(err?.message || 'Failed to create backup')
    } finally {
      setCreating(false)
    }
  }

  const scheduleRestore = async () => {
    setError(null)
    setLatestMessage(null)
    if (!selected) {
      setError('Select a backup to restore.')
      return
    }
    if (!confirmRestore) {
      setError('You must confirm restoration will delete newer files.')
      return
    }
    try {
      const res = await fetch('/api/admin/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: selected, confirm: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to schedule restore')
      setPending(data.pending)
      setLatestMessage('Restore scheduled. Restart the app/container to apply it.')
      setConfirmRestore(false)
    } catch (err: any) {
      setError(err?.message || 'Failed to schedule restore')
    }
  }

  const activeSelection = backups.find((b) => b.folder === selected)

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Backups live under <code>/files/backups</code>. Restoring removes files uploaded after that snapshot and will take effect after a restart.
      </p>
      {error && <div className="text-sm text-amber-400">{error}</div>}
      {latestMessage && <div className="text-sm text-green-400">{latestMessage}</div>}
      <div className="flex flex-wrap gap-3">
        <button className="btn" onClick={triggerBackup} disabled={creating}>
          {creating ? 'Creating backup…' : 'Create backup'}
        </button>
        <button className="px-3 py-2 rounded-md border border-white/10 text-sm" type="button" onClick={loadBackups} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh list'}
        </button>
      </div>
      <div className="space-y-2">
        <label className="block text-sm text-slate-300">Available backups</label>
        <select className="input" value={selected} onChange={(e) => setSelected(e.target.value)}>
          {backups.map((b) => (
            <option key={b.folder} value={b.folder}>
              {b.folder} · {new Date(b.createdAt).toLocaleString()}
            </option>
          ))}
          {backups.length === 0 && <option value="">No backups yet</option>}
        </select>
        {activeSelection?.downloadUrl && (
          <div className="text-xs text-slate-400">
            Download:&nbsp;
            <a className="underline" href={activeSelection.downloadUrl} target="_blank" rel="noreferrer">
              {activeSelection.folder}
            </a>
          </div>
        )}
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input id="confirm-restore" type="checkbox" checked={confirmRestore} onChange={(e) => setConfirmRestore(e.target.checked)} />
          <label htmlFor="confirm-restore" className="text-sm">
            I understand that restoring will delete uploads created after this backup.
          </label>
        </div>
        <button className="btn bg-red-600 hover:bg-red-500 disabled:opacity-50" type="button" onClick={scheduleRestore} disabled={!selected}>
          Schedule restore
        </button>
        {pending && (
          <div className="text-xs text-amber-300">
            Pending restore: {pending.folder} (scheduled {new Date(pending.scheduledAt).toLocaleString()}). Restart the app to apply.
          </div>
        )}
      </div>
      <div className="border-t border-white/10 pt-4 space-y-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">OrderWorks queue</h3>
          <p className="text-xs text-slate-500">View, retry, or delete webhook jobs from the dedicated queue.</p>
        </div>
        <Link className="px-3 py-2 inline-flex items-center rounded-md border border-white/10 text-sm hover:border-white/20" href="/admin/jobs">
          Open job queue
        </Link>
      </div>
    </div>
  )
}
