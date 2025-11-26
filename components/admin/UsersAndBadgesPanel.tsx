import UserDiscountControls from '@/components/admin/UserDiscountControls'
import UserAdminActions from '@/components/admin/UserAdminActions'
import type { fetchAdminUsersWithBadges } from '@/lib/admin/queries'

type AdminUser = Awaited<ReturnType<typeof fetchAdminUsersWithBadges>>[number]

type Props = {
  users: AdminUser[]
  className?: string
}

export default function UsersAndBadgesPanel({ users, className = '' }: Props) {
  if (!users?.length) {
    return (
      <div className={`rounded-lg border border-white/10 bg-black/30 px-4 py-6 text-center text-sm text-slate-400 ${className}`.trim()}>
        No users found yet.
      </div>
    )
  }

  return (
    <div className={`divide-y divide-white/10 ${className}`.trim()}>
      {users.map((u) => (
        <div key={u.id} className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-medium">{u.name || u.email}</div>
              <div className="text-slate-400 text-xs">/{u.profile?.slug || 'no-slug'}</div>
              <div className="text-slate-500 text-xs break-all">{u.email}</div>
            </div>
            <div className="text-slate-400 text-xs">Joined {new Date(u.createdAt).toLocaleDateString()}</div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {u.badges.length === 0 && (
              <span className="text-slate-500 text-sm">No badges yet</span>
            )}
            {u.badges.map((b: any) => (
              <span key={b.achievementId} title={b.achievement?.description || ''} className="px-2 py-1 rounded-md border border-white/10 bg-black/30 text-sm">
                <span className="mr-1">{b.achievement?.icon || 'dY?+'}</span>
                <span>{b.achievement?.name || 'Badge'}</span>
              </span>
            ))}
          </div>
          <div className="mt-4">
            <UserAdminActions
              userId={u.id}
              initialSuspended={!!u.isSuspended}
              initialEmailVerified={!!u.emailVerified}
              isAdmin={!!u.isAdmin}
            />
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
  )
}
