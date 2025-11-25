import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import JobQueue from '@/components/admin/JobQueue'
import { serializeJob, type JobWithUser } from '@/app/api/admin/orderworks/jobs/_helpers'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'OrderWorks Job Queue',
}

export default async function AdminJobsPage() {
  const token = cookies().get('mwv2_token')?.value
  const payload = token ? verifyToken(token) : null
  if (!payload?.sub) redirect('/login')
  const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { isAdmin: true } })
  if (!user?.isAdmin) redirect('/')

  const [jobs, pendingCount, totalCount] = await Promise.all([
    prisma.jobForm.findMany({
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.jobForm.count({ where: { status: 'pending' } }),
    prisma.jobForm.count(),
  ])

  const serializedJobs = (jobs as JobWithUser[]).map(serializeJob)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs text-brand-400 uppercase tracking-[0.3em]">OrderWorks</p>
          <h1 className="text-3xl font-semibold">Job queue</h1>
          <p className="text-sm text-slate-400 mt-1">
            Monitor webhook attempts, resend failed jobs, or remove duplicates.
          </p>
        </div>
        <Link href="/admin" className="px-3 py-1.5 rounded-md border border-white/10 text-sm hover:border-white/20">
          Back to dashboard
        </Link>
      </div>
      <div className="glass rounded-xl border border-white/10 p-6">
        <JobQueue
          initialJobs={serializedJobs}
          pendingCount={pendingCount}
          totalCount={totalCount}
          orderWorksEnabled={Boolean(process.env.ORDERWORKS_WEBHOOK_URL)}
        />
      </div>
    </div>
  )
}
