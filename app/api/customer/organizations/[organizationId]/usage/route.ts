import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserIdFromCookie } from '@/lib/auth'
import { getOrganizationMembership } from '@/lib/organizations'

export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ organizationId: string }> }

function toCents(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.round(value))
}

export async function GET(req: NextRequest, { params }: Context) {
  const { organizationId } = await params
  const userId = await getUserIdFromCookie()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const membership = await getOrganizationMembership(userId, organizationId)
  if (!membership) return NextResponse.json({ error: 'Organization not found.' }, { status: 404 })

  const url = new URL(req.url)
  const fromRaw = url.searchParams.get('from')
  const toRaw = url.searchParams.get('to')
  const from = fromRaw ? new Date(fromRaw) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  const to = toRaw ? new Date(toRaw) : new Date()
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return NextResponse.json({ error: 'Invalid date range.' }, { status: 400 })
  }

  const orders = await prisma.printOrder.findMany({
    where: {
      organizationId,
      createdAt: { gte: from, lte: to },
    },
    select: {
      id: true,
      totalCents: true,
      createdAt: true,
      metadata: true,
      items: {
        select: {
          material: true,
          totalCents: true,
        },
      },
    },
  })

  const spendByMaterial = new Map<string, number>()
  const spendByProject = new Map<string, number>()
  const spendByMonth = new Map<string, number>()

  for (const order of orders) {
    const monthKey = `${order.createdAt.getUTCFullYear()}-${String(order.createdAt.getUTCMonth() + 1).padStart(2, '0')}`
    spendByMonth.set(monthKey, (spendByMonth.get(monthKey) || 0) + toCents(order.totalCents))

    for (const item of order.items) {
      const material = (item.material || 'UNKNOWN').toUpperCase()
      spendByMaterial.set(material, (spendByMaterial.get(material) || 0) + toCents(item.totalCents))
    }

    const projectCode = (() => {
      if (!order.metadata || typeof order.metadata !== 'object' || Array.isArray(order.metadata)) return null
      const val = (order.metadata as Record<string, unknown>).projectCode
      return typeof val === 'string' && val.trim().length > 0 ? val.trim() : null
    })()
    if (projectCode) {
      spendByProject.set(projectCode, (spendByProject.get(projectCode) || 0) + toCents(order.totalCents))
    }
  }

  return NextResponse.json({
    organization: {
      id: membership.organization.id,
      name: membership.organization.name,
      role: membership.role,
    },
    range: {
      from: from.toISOString(),
      to: to.toISOString(),
    },
    totals: {
      orders: orders.length,
      spendCents: orders.reduce((sum, order) => sum + toCents(order.totalCents), 0),
    },
    spendByMaterial: Array.from(spendByMaterial.entries())
      .map(([material, spendCents]) => ({ material, spendCents }))
      .sort((a, b) => b.spendCents - a.spendCents),
    spendByProject: Array.from(spendByProject.entries())
      .map(([projectCode, spendCents]) => ({ projectCode, spendCents }))
      .sort((a, b) => b.spendCents - a.spendCents),
    spendByMonth: Array.from(spendByMonth.entries())
      .map(([month, spendCents]) => ({ month, spendCents }))
      .sort((a, b) => a.month.localeCompare(b.month)),
  })
}
