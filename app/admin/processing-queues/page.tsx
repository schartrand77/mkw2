import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import ProcessingQueuesPanel from '@/components/admin/ProcessingQueuesPanel'

export const dynamic = 'force-dynamic'

export default async function AdminProcessingQueuesPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('mwv2_token')?.value
  const payload = token ? verifyToken(token) : null
  if (!payload?.sub) redirect('/login')
  const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { isAdmin: true, role: true } })
  const role = user?.role || null
  if (!(user?.isAdmin || role === 'admin' || role === 'staff')) redirect('/')

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-brand-400 uppercase tracking-[0.3em]">Operations</p>
        <h1 className="text-3xl font-semibold">Processing queues</h1>
        <p className="text-sm text-slate-400 mt-1">Inspect worker jobs, retry failures, and replay stuck active tasks.</p>
      </div>
      <div className="glass rounded-xl border border-white/10 p-6">
        <ProcessingQueuesPanel />
      </div>
    </div>
  )
}
