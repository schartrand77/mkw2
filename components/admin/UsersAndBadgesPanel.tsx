'use client'

import { useState } from 'react'
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
type AdminUserWithStats = AdminUser & {
  orderCount?: number
  totalSpentCents?: number
}

type Props = {
  users: AdminUserWithStats[]
  className?: string
}

export default function UsersAndBadgesPanel({ users, className = '' }: Props) {
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)

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
        const isExpanded = expandedUserId === u.id
        const badgePreview = u.badges.slice(0, 3)
        return (
          <div key={u.id} className="p-4">
            <button
              type="button"
              onClick={() => setExpandedUserId(isExpanded ? null : u.id)}
              className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-3 text-left transition hover:border-white/20"
              aria-expanded={isExpanded}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  {avatarSrc ? (
                    <img
                      src={avatarSrc}
                      alt={`${u.name || u.email}'s avatar`}
                      className="h-11 w-11 rounded-full border border-white/10 object-cover"
                    />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-slate-900/70 text-sm text-slate-400">
                      {placeholder}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="truncate font-medium">{u.name || u.email}</div>
                    <div className="break-all text-xs text-slate-400">/{u.profile?.slug || 'no-slug'}</div>
                    <div className="break-all text-xs text-slate-500">{u.email}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400">Joined {new Date(u.createdAt).toLocaleDateString()}</div>
                  <div className="mt-1 text-xs text-slate-500">{u.badges.length} badge{u.badges.length === 1 ? '' : 's'}</div>
                  <div className="mt-1 text-xs text-slate-500">{u.orderCount ?? u._count?.orders ?? 0} order{(u.orderCount ?? u._count?.orders ?? 0) === 1 ? '' : 's'}</div>
                  <div className="mt-1 text-xs text-slate-500">{u.lastLoginAt ? `Last login ${new Date(u.lastLoginAt).toLocaleDateString()}` : 'No login yet'}</div>
                  <div className="mt-1 text-xs text-brand-300">{isExpanded ? 'Hide details' : 'Show details'}</div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {u.badges.length === 0 && (
                  <span className="text-sm text-slate-500">No badges yet</span>
                )}
                {badgePreview.map((b: any) => {
                  const { icon, name } = resolveBadgeDetails(b.achievement)
                  const badgeImage = getBadgeImageSrc(icon)
                  return (
                    <span
                      key={b.achievementId}
                      className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-xs"
                    >
                      {badgeImage ? (
                        <img
                          src={badgeImage}
                          alt={name}
                          className="h-5 w-5"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : icon ? (
                        <span className="inline-flex min-w-[1.5rem] items-center justify-center rounded bg-white/10 px-1 py-0.5 text-[10px] font-semibold tracking-wide text-white/90">
                          {icon}
                        </span>
                      ) : null}
                      <span>{name}</span>
                    </span>
                  )
                })}
                {u.badges.length > 3 ? (
                  <span className="inline-flex items-center rounded-md border border-white/10 bg-black/30 px-2 py-1 text-xs text-slate-400">
                    +{u.badges.length - 3} more
                  </span>
                ) : null}
              </div>
            </button>
            {isExpanded ? (
              <>
                <div className="mt-3 flex flex-wrap gap-2">
                  {u.badges.map((b: any) => {
                    const { icon, name } = resolveBadgeDetails(b.achievement)
                    const badgeImage = getBadgeImageSrc(icon)
                    return (
                      <span
                        key={`${b.achievementId}-expanded`}
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
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-slate-300 space-y-1">
                    <div>Registration source: {u.registrationSource || 'unknown'}</div>
                    <div>Total spent: ${(((u.totalSpentCents ?? 0) / 100).toFixed(2))}</div>
                    {u.registrationIp ? <div>Signup IP: {u.registrationIp}</div> : null}
                    {u.lastLoginIp ? <div>Last login IP: {u.lastLoginIp}</div> : null}
                  </div>
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
              </>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
