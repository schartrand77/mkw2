export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/db'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import FeaturedManager from '@/components/admin/FeaturedManager'
import SiteConfigForm from '@/components/admin/SiteConfigForm'
import BackupControls from '@/components/admin/BackupControls'
import ModelManager from '@/components/admin/ModelManager'
import CollapsibleCard from '@/components/admin/CollapsibleCard'
import UsersAndBadgesPanel from '@/components/admin/UsersAndBadgesPanel'
import JobQueue from '@/components/admin/JobQueue'
import { fetchAdminUsersWithBadges, fetchJobQueueSnapshot } from '@/lib/admin/queries'
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
  const [usersWithBadges, jobSnapshot] = await Promise.all([
    fetchAdminUsersWithBadges(),
    fetchJobQueueSnapshot(100),
  ])
  const orderWorksEnabled = Boolean(process.env.ORDERWORKS_WEBHOOK_URL)

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Admin Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">Manage featured models, pricing, backups, and more.</p>
        </div>
        <CollapsibleCard
          title="Backup status"
          subtitle="Latest snapshot & restore queue"
          variant="plain"
          className="min-w-[260px] text-sm"
          bodyClassName="px-4 py-3 text-sm"
        >
          <div aria-live="polite" className="space-y-3">
            <div>
              <div className="text-xs uppercase tracking-[0.25em] text-slate-400">Latest backup</div>
              <p className="text-base text-white mt-1">
                {lastBackupDate ? `${lastBackupDate.toLocaleString()} (${formatRelative(lastBackupDate)})` : 'No backups yet'}
              </p>
            </div>
            <p className={`text-xs ${pendingRestore ? 'text-amber-300' : 'text-slate-500'}`}>
              {pendingRestore
                ? `Pending restore: ${(pendingRestore.relativePath || pendingRestore.backupPath || '').replace(/^backups\//, '')} - ${pendingRestoreDate?.toLocaleString()}`
                : 'No restore scheduled'}
            </p>
            <Link href="#backups" className="text-xs text-brand-300 underline inline-flex">Open backup tools</Link>
          </div>
        </CollapsibleCard>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <CollapsibleCard title="Featured models" subtitle="Control which models appear on the homepage hero">
          <FeaturedManager initial={initialFeatured} />
        </CollapsibleCard>
        <div className="space-y-6">
          <CollapsibleCard title="Site configuration" subtitle="Update global pricing, copy, and limits">
            <SiteConfigForm initial={cfg as any} />
          </CollapsibleCard>
          <CollapsibleCard id="backups" title="Backups & restore" subtitle="Create new archives or trigger restores">
            <BackupControls />
          </CollapsibleCard>
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <CollapsibleCard
          title="Users & badges"
          subtitle="Manage accounts, permissions, and badge awards"
          bodyClassName="space-y-4 p-6"
        >
          <p className="text-sm text-slate-400">
            Review registered users, adjust admin access, and curate the badge showcase without leaving the dashboard.
          </p>
          <UsersAndBadgesPanel
            users={usersWithBadges}
            className="rounded-xl border border-white/10 bg-black/20 overflow-hidden"
          />
          <Link href="/admin/users" className="inline-flex text-xs text-brand-300 underline">
            Open full user manager
          </Link>
        </CollapsibleCard>
        <CollapsibleCard
          title="Job queue"
          subtitle="Inspect background tasks and OrderWorks webhooks"
          bodyClassName="space-y-4 p-6"
        >
          <p className="text-sm text-slate-400">
            Monitor queued or failed jobs, retry stuck webhooks, and confirm OrderWorks automation is healthy.
          </p>
          <JobQueue
            initialJobs={jobSnapshot.jobs}
            pendingCount={jobSnapshot.pendingCount}
            totalCount={jobSnapshot.totalCount}
            orderWorksEnabled={orderWorksEnabled}
          />
          <Link href="/admin/jobs" className="inline-flex text-xs text-brand-300 underline">
            Open full job console
          </Link>
        </CollapsibleCard>
      </div>
      <CollapsibleCard title="Model library" subtitle="Search, curate, or moderate user uploads">
        <ModelManager />
      </CollapsibleCard>
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
