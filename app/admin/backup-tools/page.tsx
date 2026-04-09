export const dynamic = 'force-dynamic'

import BackupControls from '@/components/admin/BackupControls'
import { getPendingRestore, listBackups } from '@/lib/backups'

type BackupSummary = { folder: string; createdAt: string }
type PendingRestore = { relativePath?: string; backupPath?: string; createdAt: string }

export default function AdminBackupsPage() {
  const backupList = listBackups() as BackupSummary[]
  const latestBackup = backupList[0] ?? null
  const pendingRestore = getPendingRestore() as (PendingRestore & { manifest?: string }) | null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Backups & restore</h1>
        <p className="mt-1 text-sm text-slate-400">Create archives and manage restore queue.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-black/20 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Latest backup</p>
          <p className="mt-2 text-sm text-slate-200">{latestBackup ? new Date(latestBackup.createdAt).toLocaleString() : 'No backups yet'}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Pending restore</p>
          <p className={`mt-2 text-sm ${pendingRestore ? 'text-amber-300' : 'text-slate-400'}`}>
            {pendingRestore
              ? (pendingRestore.relativePath || pendingRestore.backupPath || '').replace(/^backups\//, '')
              : 'None scheduled'}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/20 p-5">
        <BackupControls />
      </div>
    </div>
  )
}
