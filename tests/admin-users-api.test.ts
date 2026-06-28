import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server'

import { adminRouteGuards } from '../app/api/admin/_utils'
import { prisma } from '../lib/db'

test('admin users list route requires admin access', async () => {
  const route = await import('../app/api/admin/users/route')

  const res = await route.GET(new NextRequest('http://localhost/api/admin/users'))

  assert.equal(res.status, 401)
})

test('admin users list route returns user badges and order summary for native clients', async () => {
  const route = await import('../app/api/admin/users/route')
  const originalRequireAdmin = adminRouteGuards.requireAdmin
  const originalUserFindMany = (prisma.user as any).findMany
  const originalUserCount = (prisma.user as any).count
  const originalGroupBy = (prisma.printOrder as any).groupBy
  const originalAggregate = (prisma.printOrder as any).aggregate

  adminRouteGuards.requireAdmin = async () => 'admin_1'
  ;(prisma.user as any).findMany = async () => [
    {
      id: 'user_1',
      email: 'sam@example.com',
      name: 'Sam User',
      emailVerified: true,
      createdAt: new Date('2026-01-02T03:04:05.000Z'),
      registrationSource: 'invite',
      registrationIp: '203.0.113.10',
      registrationUserAgent: 'Signup Browser',
      lastLoginAt: new Date('2026-02-03T04:05:06.000Z'),
      lastLoginIp: '203.0.113.11',
      lastLoginUserAgent: 'Login Browser',
      profile: { slug: 'sam', avatarImagePath: '/avatars/sam.webp' },
      badges: [
        {
          achievementId: 'ach_1',
          userId: 'user_1',
          earnedAt: new Date('2026-01-10T00:00:00.000Z'),
          achievement: {
            id: 'ach_1',
            key: 'comments_1',
            name: 'First Comment',
            description: 'Left your first comment',
            icon: 'C1',
          },
        },
      ],
      discountPercent: 10,
      isFriendsAndFamily: true,
      friendsAndFamilyPercent: 25,
      isSuspended: false,
      isAdmin: false,
      role: 'customer',
      _count: { orders: 1 },
    },
  ]
  ;(prisma.user as any).count = async () => 1
  ;(prisma.printOrder as any).groupBy = async () => [
    { userId: 'user_1', _count: { _all: 2 }, _sum: { totalCents: 3456 } },
  ]
  ;(prisma.printOrder as any).aggregate = async () => ({
    _count: { _all: 2 },
    _sum: { totalCents: 3456 },
  })

  try {
    const res = await route.GET(new NextRequest('http://localhost/api/admin/users?q=sam'))
    const payload = await res.json()

    assert.equal(res.status, 200)
    assert.equal(payload.users.length, 1)
    assert.equal(payload.users[0].id, 'user_1')
    assert.equal(payload.users[0].profile.slug, 'sam')
    assert.equal(payload.users[0].badges[0].achievement.key, 'comments_1')
    assert.equal(payload.users[0].orderCount, 2)
    assert.equal(payload.users[0].totalSpentCents, 3456)
    assert.equal(payload.summary.totalUsers, 1)
    assert.equal(payload.summary.customerRevenueCents, 3456)
    assert.equal(payload.query.q, 'sam')
  } finally {
    adminRouteGuards.requireAdmin = originalRequireAdmin
    ;(prisma.user as any).findMany = originalUserFindMany
    ;(prisma.user as any).count = originalUserCount
    ;(prisma.printOrder as any).groupBy = originalGroupBy
    ;(prisma.printOrder as any).aggregate = originalAggregate
  }
})

test('admin user detail route returns profile, badges, and order summary', async () => {
  const route = await import('../app/api/admin/users/[id]/route')
  const originalRequireAdmin = adminRouteGuards.requireAdmin
  const originalUserFindUnique = (prisma.user as any).findUnique
  const originalProfileFindFirst = (prisma.profile as any).findFirst
  const originalAchievementFindMany = (prisma.userAchievement as any).findMany
  const originalOrderAggregate = (prisma.printOrder as any).aggregate

  adminRouteGuards.requireAdmin = async () => 'admin_1'
  ;(prisma.user as any).findUnique = async () => ({
    id: 'user_1',
    email: 'sam@example.com',
    name: 'Sam User',
    emailVerified: true,
    createdAt: new Date('2026-01-02T03:04:05.000Z'),
    registrationSource: 'invite',
    registrationIp: '203.0.113.10',
    registrationUserAgent: 'Signup Browser',
    lastLoginAt: new Date('2026-02-03T04:05:06.000Z'),
    lastLoginIp: '203.0.113.11',
    lastLoginUserAgent: 'Login Browser',
    discountPercent: 10,
    isFriendsAndFamily: true,
    friendsAndFamilyPercent: 25,
    isSuspended: false,
    isAdmin: false,
    role: 'customer',
    _count: { orders: 2 },
  })
  ;(prisma.profile as any).findFirst = async () => ({
    userId: 'user_1',
    slug: 'sam',
    bio: 'Printer fan',
    avatarImagePath: '/avatars/sam.webp',
  })
  ;(prisma.userAchievement as any).findMany = async () => [
    {
      achievementId: 'ach_1',
      userId: 'user_1',
      earnedAt: new Date('2026-01-10T00:00:00.000Z'),
      achievement: { id: 'ach_1', key: 'comments_1', name: 'First Comment', description: null, icon: 'C1' },
    },
  ]
  ;(prisma.printOrder as any).aggregate = async () => ({
    _count: { _all: 2 },
    _sum: { totalCents: 3456 },
  })

  try {
    const res = await route.GET(new NextRequest('http://localhost/api/admin/users/user_1'), {
      params: Promise.resolve({ id: 'user_1' }),
    } as any)
    const payload = await res.json()

    assert.equal(res.status, 200)
    assert.equal(payload.user.id, 'user_1')
    assert.equal(payload.user.registrationSource, 'invite')
    assert.equal(payload.profile.slug, 'sam')
    assert.equal(payload.badges[0].achievement.key, 'comments_1')
    assert.equal(payload.summary.orderCount, 2)
    assert.equal(payload.summary.totalSpentCents, 3456)
  } finally {
    adminRouteGuards.requireAdmin = originalRequireAdmin
    ;(prisma.user as any).findUnique = originalUserFindUnique
    ;(prisma.profile as any).findFirst = originalProfileFindFirst
    ;(prisma.userAchievement as any).findMany = originalAchievementFindMany
    ;(prisma.printOrder as any).aggregate = originalOrderAggregate
  }
})
