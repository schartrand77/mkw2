export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { prisma } from '@/lib/db'

type BackupSummary = { folder: string; createdAt: string }
type PendingRestore = { relativePath?: string; backupPath?: string; createdAt: string }

// eslint-disable-next-line @typescript-eslint/no-var-requires
const backupModule = require('@/lib/backups') as {
  listBackups: () => BackupSummary[]
  getPendingRestore: () => (PendingRestore & { manifest?: string }) | null
}

export default async function AdminPage() {
  const [featuredCount, pendingJobs, totalUsers] = await Promise.all([
    prisma.featuredModel.count(),
    prisma.jobForm.count({ where: { status: 'pending' } }),
    prisma.user.count(),
  ])

  const latestBackup = backupModule.listBackups?.()?.[0] ?? null
  const pendingRestore = backupModule.getPendingRestore?.() ?? null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Admin</h1>
        <p className="mt-1 text-sm text-slate-400">Use the sidebar to open each admin tool as a dedicated page.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Users</p>
          <p className="mt-2 text-3xl font-semibold">{totalUsers}</p>
          <p className="text-xs text-slate-400">Total accounts</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Job queue</p>
          <p className="mt-2 text-3xl font-semibold">{pendingJobs}</p>
          <p className="text-xs text-slate-400">Pending jobs</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Featured</p>
          <p className="mt-2 text-3xl font-semibold">{featuredCount}</p>
          <p className="text-xs text-slate-400">Featured models</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-black/20 p-5">
          <h2 className="text-lg font-semibold">Backup status</h2>
          <p className="mt-2 text-sm text-slate-300">
            {latestBackup ? `Latest backup: ${new Date(latestBackup.createdAt).toLocaleString()}` : 'No backups found yet.'}
          </p>
          <p className={`mt-2 text-xs ${pendingRestore ? 'text-amber-300' : 'text-slate-500'}`}>
            {pendingRestore
              ? `Pending restore: ${(pendingRestore.relativePath || pendingRestore.backupPath || '').replace(/^backups\//, '')}`
              : 'No restore currently scheduled.'}
          </p>
          <Link href="/admin/backup-tools" className="mt-4 inline-flex text-xs text-brand-300 underline">
            Open backups page
          </Link>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-5">
          <h2 className="text-lg font-semibold">Primary tools</h2>
          <div className="mt-3 space-y-2 text-sm text-slate-300">
            <Link href="/admin/site-config" className="block underline text-brand-300">Site config and env checks</Link>
            <Link href="/admin/notifications" className="block underline text-brand-300">Notifications</Link>
            <Link href="/admin/home-comments" className="block underline text-brand-300">Home comments</Link>
            <Link href="/admin/production" className="block underline text-brand-300">Production dashboard</Link>
            <Link href="/admin/users" className="block underline text-brand-300">User manager</Link>
            <Link href="/admin/models" className="block underline text-brand-300">Model library</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
