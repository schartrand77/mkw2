"use client"

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { pushSessionNotification } from '@/components/notifications/NotificationsProvider'

type BackupMeta = {
  folder: string
  createdAt: string
  hasDatabase?: boolean
  hasStorage?: boolean
  downloadUrl?: string | null
}

type RuntimeReadiness = {
  ok: boolean
  mode: 'docker' | 'local' | 'unavailable'
  dockerComposeAvailable: boolean
  pgDumpAvailable?: boolean
  psqlAvailable?: boolean
  pgDumpCommand?: string
  psqlCommand?: string
  reasons?: string[]
}

type BackupPolicy = {
  retentionDays: number
  retentionMaxCount: number
  scheduleEnabled: boolean
  scheduleTimeUtc: string
  scheduleTimeValid: boolean
  pruneOnBackup: boolean
  runOnStart: boolean
}

export default function BackupControls() {
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(false)
  const [backups, setBackups] = useState<BackupMeta[]>([])
  const [selected, setSelected] = useState('')
  const [pending, setPending] = useState<{ folder: string; scheduledAt: string } | null>(null)
  const [backupsRoot, setBackupsRoot] = useState<string | null>(null)
  const [backupsRootInStorage, setBackupsRootInStorage] = useState<boolean>(true)
  const [latestMessage, setLatestMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmRestore, setConfirmRestore] = useState(false)
  const [readiness, setReadiness] = useState<{
    backup: RuntimeReadiness
    restore: RuntimeReadiness
    policy: BackupPolicy
    nextRunAt?: string
  } | null>(null)

  const loadBackups = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/restore')
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to load backups')
      setBackups(data.backups || [])
      setPending(data.pending || null)
      setBackupsRoot(data.backupsRoot || null)
      setBackupsRootInStorage(Boolean(data.backupsRootInStorage))
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
  }, [])

  useEffect(() => {
    loadBackups()
  }, [loadBackups])

  useEffect(() => {
    const loadReadiness = async () => {
      try {
        const res = await fetch('/api/admin/backup')
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || 'Failed to check backup prerequisites')
        setReadiness({ backup: data.backup, restore: data.restore, policy: data.policy, nextRunAt: data.nextRunAt })
      } catch {
        setReadiness(null)
      }
    }
    loadReadiness()
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
      pushSessionNotification({
        type: 'success',
        title: 'Backup created',
        message: data?.folder ? `Snapshot ${data.folder} is ready.` : 'Backup completed successfully.',
      })
      await loadBackups()
    } catch (err: any) {
      const message = err?.message || 'Failed to create backup'
      setError(message)
      pushSessionNotification({
        type: 'error',
        title: 'Backup failed',
        message,
      })
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
    const active = backups.find((b) => b.folder === selected)
    if (active && active.hasDatabase === false) {
      setError('Selected backup is missing db.sql.')
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
        Backups root: <code>{backupsRoot || '/files/backups'}</code>. Restoring removes files uploaded after that snapshot and will take effect after a restart.
      </p>
      {backupsRoot && !backupsRootInStorage && (
        <p className="text-xs text-amber-300">
          This backup root is outside <code>STORAGE_DIR</code>. Restore works, but browser download links are disabled for these backups.
        </p>
      )}
      {readiness?.policy && (
        <div className="text-xs text-slate-400">
          Retention: keep backups from last <code>{readiness.policy.retentionDays}</code> day(s) and newest <code>{readiness.policy.retentionMaxCount}</code>.
          {' '}Prune on backup: <code>{readiness.policy.pruneOnBackup ? 'enabled' : 'disabled'}</code>.
          {' '}Schedule: <code>{readiness.policy.scheduleEnabled ? 'enabled' : 'disabled'}</code> at{' '}
          <code>{readiness.policy.scheduleTimeUtc} UTC</code>
          {readiness.nextRunAt ? <> (next run: {new Date(readiness.nextRunAt).toLocaleString()}).</> : '.'}
        </div>
      )}
      {readiness && !readiness.backup.ok && (
        <div className="text-sm text-amber-300">
          Backup prerequisites missing ({(readiness.backup.reasons || []).join(', ')}). Configure Docker Compose with the <code>db</code> service
          running, or set <code>PG_DUMP_BIN</code> to your local <code>pg_dump</code> path.
        </div>
      )}
      {readiness && !readiness.restore.ok && (
        <div className="text-sm text-amber-300">
          Restore prerequisites missing ({(readiness.restore.reasons || []).join(', ')}). Configure Docker Compose with the <code>db</code> service
          running, or set <code>PSQL_BIN</code> to your local <code>psql</code> path before applying restore.
        </div>
      )}
      {error && <div className="text-sm text-amber-400">{error}</div>}
      {latestMessage && <div className="text-sm text-green-400">{latestMessage}</div>}
      <div className="flex flex-wrap gap-3">
        <button className="btn" onClick={triggerBackup} disabled={creating || (readiness ? !readiness.backup.ok : false)}>
          {creating ? 'Creating backup...' : 'Create backup'}
        </button>
        <button className="px-3 py-2 rounded-md border border-white/10 text-sm" type="button" onClick={loadBackups} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh list'}
        </button>
      </div>
      <div className="space-y-2">
        <label className="block text-sm text-slate-300">Available backups</label>
        <select className="input" value={selected} onChange={(e) => setSelected(e.target.value)}>
          {backups.map((b) => (
            <option key={b.folder} value={b.folder}>
              {b.folder} - {new Date(b.createdAt).toLocaleString()}
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
        {activeSelection?.hasStorage === false && (
          <div className="text-xs text-amber-300">Note: This backup has no storage snapshot.</div>
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
          <p className="text-xs text-slate-500">View, retry, or delete OrderWorks jobs from the dedicated queue.</p>
        </div>
        <Link className="px-3 py-2 inline-flex items-center rounded-md border border-white/10 text-sm hover:border-white/20" href="/admin/jobs">
          Open job queue
        </Link>
      </div>
    </div>
  )
}
