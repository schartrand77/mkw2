import { prisma } from '@/lib/db'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import Link from 'next/link'
import UserDiscountControls from '@/components/admin/UserDiscountControls'

export const dynamic = 'force-dynamic'

async function requireAdminServer() {
  const token = cookies().get('mwv2_token')?.value
  const payload = token ? verifyToken(token) : null
  if (!payload?.sub) return null
  const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { isAdmin: true } })
  return user?.isAdmin ? payload.sub : null
}

export default async function AdminUsersPage() {
  const adminId = await requireAdminServer()
  if (!adminId) return (<div className="text-slate-400">Forbidden</div>)

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      profile: { select: { slug: true } },
      badges: { include: { achievement: true } },
      discountPercent: true,
      isFriendsAndFamily: true,
      friendsAndFamilyPercent: true,
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Users & Badges</h1>
        <Link className="px-3 py-1.5 rounded-md border border-white/10 hover:border-white/20" href="/admin">Back to Admin</Link>
      </div>
      <div className="glass rounded-xl border border-white/10 divide-y divide-white/10">
        {users.map(u => (
          <div key={u.id} className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-medium">{u.name || u.email}</div>
                <div className="text-slate-400 text-xs">/{u.profile?.slug || 'no-slug'}</div>
              </div>
              <div className="text-slate-400 text-xs">Joined {new Date(u.createdAt).toLocaleDateString()}</div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {u.badges.length === 0 && (
                <span className="text-slate-500 text-sm">No badges yet</span>
              )}
              {u.badges.map((b: any) => (
                <span key={b.achievementId} title={b.achievement?.description || ''} className="px-2 py-1 rounded-md border border-white/10 bg-black/30 text-sm">
                  <span className="mr-1">{b.achievement?.icon || '🏆'}</span>
                  <span>{b.achievement?.name || 'Badge'}</span>
                </span>
              ))}
            </div>
            <div className="mt-4">
              <UserDiscountControls
                userId={u.id}
                initialDiscount={u.discountPercent ?? 0}
                initialFriendsAndFamily={u.isFriendsAndFamily ?? false}
                initialFriendsAndFamilyPercent={u.friendsAndFamilyPercent ?? 0}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
