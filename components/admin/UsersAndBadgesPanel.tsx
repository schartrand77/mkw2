import UserDiscountControls from '@/components/admin/UserDiscountControls'
import UserAdminActions from '@/components/admin/UserAdminActions'
import UserOrderCreator from '@/components/admin/UserOrderCreator'
import UserAccountEditor from '@/components/admin/UserAccountEditor'
import type { fetchAdminUsersWithBadges } from '@/lib/admin/queries'
import { toPublicHref } from '@/lib/public-path'
import { DEFAULT_ACHIEVEMENTS } from '@/lib/achievements'
import { getBadgeImageSrc } from '@/lib/badge-images'

const fallbackAchievements = new Map(DEFAULT_ACHIEVEMENTS.map((ach) => [ach.key, ach]))

function resolveBadgeDetails(achievement?: { key?: string | null; name?: string | null; icon?: string | null }) {
  const fallback = achievement?.key ? fallbackAchievements.get(achievement.key) : undefined
  const rawName = achievement?.name || fallback?.name || 'Badge'
  let icon = (achievement?.icon || fallback?.icon || '').trim()
  let name = rawName
  if (icon) {
    const prefix = `${icon} `
    if (name.startsWith(prefix)) {
      name = name.slice(prefix.length)
    }
  } else {
    const match = rawName.match(/^([A-Z]{1,4}\d{0,2})\s+(.*)$/)
    if (match) {
      icon = match[1]
      name = match[2]
    }
  }
  return { icon, name }
}

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
      {users.map((u) => {
        const avatarSrc = toPublicHref(u.profile?.avatarImagePath)
        const placeholder = (u.name || u.email || '?').trim().charAt(0).toUpperCase() || '?'
        return (
          <div key={u.id} className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {avatarSrc ? (
                  <img
                    src={avatarSrc}
                    alt={`${u.name || u.email}'s avatar`}
                    className="w-12 h-12 rounded-full border border-white/10 object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full border border-white/10 bg-slate-900/70 flex items-center justify-center text-sm text-slate-400">
                    {placeholder}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-medium truncate">{u.name || u.email}</div>
                  <div className="text-slate-400 text-xs break-all">/{u.profile?.slug || 'no-slug'}</div>
                  <div className="text-slate-500 text-xs break-all">{u.email}</div>
                </div>
              </div>
              <div className="text-slate-400 text-xs">Joined {new Date(u.createdAt).toLocaleDateString()}</div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {u.badges.length === 0 && (
                <span className="text-slate-500 text-sm">No badges yet</span>
              )}
              {u.badges.map((b: any) => {
                const { icon, name } = resolveBadgeDetails(b.achievement)
                const badgeImage = getBadgeImageSrc(icon)
                return (
                  <span
                    key={b.achievementId}
                    title={b.achievement?.description || ''}
                    className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-sm"
                  >
                    {badgeImage ? (
                      <img
                        src={badgeImage}
                        alt={name}
                        className="h-6 w-6"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : icon ? (
                      <span className="inline-flex min-w-[1.75rem] items-center justify-center rounded bg-white/10 px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-white/90">
                        {icon}
                      </span>
                    ) : null}
                    <span>{name}</span>
                  </span>
                )
              })}
            </div>
            <div className="mt-4">
              <a
                href={`/admin/users/${u.id}/orders`}
                className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-1.5 text-xs text-slate-200 hover:border-white/20"
              >
                View orders
              </a>
            </div>
            <div className="mt-4">
              <UserAdminActions
                userId={u.id}
                initialSuspended={!!u.isSuspended}
                initialEmailVerified={!!u.emailVerified}
                isAdmin={!!u.isAdmin || u.role === 'admin'}
                initialRole={u.role}
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
            <UserAccountEditor userId={u.id} />
            <UserOrderCreator
              userId={u.id}
              userEmail={u.email}
              userName={u.name}
            />
          </div>
        )
      })}
    </div>
  )
}
