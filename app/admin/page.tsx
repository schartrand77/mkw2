export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/db'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import FeaturedManager from '@/components/admin/FeaturedManager'
import SiteConfigForm from '@/components/admin/SiteConfigForm'
import BackupControls from '@/components/admin/BackupControls'
import ModelManager from '@/components/admin/ModelManager'
import { redirect } from 'next/navigation'
import Link from 'next/link'

type BackupSummary = { folder: string; createdAt: string }
type PendingRestore = { relativePath?: string; backupPath?: string; createdAt: string }
// eslint-disable-next-line @typescript-eslint/no-var-requires
const backupModule = require('@/lib/backups') as {
  listBackups: () => BackupSummary[]
  getPendingRestore: () => (PendingRestore & { manifest?: string }) | null
}

export default async function AdminPage() {
  const token = cookies().get('mwv2_token')?.value
  const payload = token ? verifyToken(token) : null
  if (!payload?.sub) redirect('/login')
  const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { isAdmin: true } })
  if (!user?.isAdmin) redirect('/')

  const featuredItems = await prisma.featuredModel.findMany({ include: { model: { select: { id: true, title: true, coverImagePath: true, visibility: true } } }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] })
  const initialFeatured = featuredItems.map(i => i.model)
  const cfg = await prisma.siteConfig.upsert({ where: { id: 'main' }, update: {}, create: { id: 'main' } })
  const backupList = backupModule.listBackups?.() ?? []
  const latestBackup = backupList[0] ?? null
  const pendingRestore = backupModule.getPendingRestore?.() ?? null
  const lastBackupDate = latestBackup ? new Date(latestBackup.createdAt) : null
  const pendingRestoreDate = pendingRestore ? new Date(pendingRestore.createdAt) : null

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Admin Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">Manage featured models, pricing, backups, and more.</p>
        </div>
        <div className="min-w-[260px] rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm" aria-live="polite">
          <div className="text-xs uppercase tracking-[0.25em] text-slate-400">Backup status</div>
          <p className="text-base text-white mt-2">
            {lastBackupDate ? `${lastBackupDate.toLocaleString()} (${formatRelative(lastBackupDate)})` : 'No backups yet'}
          </p>
          <p className={`text-xs mt-2 ${pendingRestore ? 'text-amber-300' : 'text-slate-500'}`}>
            {pendingRestore
              ? `Pending restore: ${(pendingRestore.relativePath || pendingRestore.backupPath || '').replace(/^backups\//, '')} - ${pendingRestoreDate?.toLocaleString()}`
              : 'No restore scheduled'}
          </p>
          <Link href="#backups" className="text-xs text-brand-300 underline mt-2 inline-flex">Open backup tools</Link>
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="glass p-6 rounded-xl">
          <FeaturedManager initial={initialFeatured} />
        </div>
        <div className="space-y-6">
          <div className="glass p-6 rounded-xl">
            <SiteConfigForm initial={cfg as any} />
          </div>
          <div id="backups">
            <BackupControls />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Link href="/admin/users" className="px-3 py-1.5 rounded-md border border-white/10 hover:border-white/20 text-sm">View Users & Badges</Link>
      </div>
      <div className="glass p-6 rounded-xl">
        <ModelManager />
      </div>
    </div>
  )
}

function formatRelative(date: Date) {
  const diffMs = Date.now() - date.getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 4) return `${weeks}w ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}
