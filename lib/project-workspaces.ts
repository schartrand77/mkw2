import { prisma } from '@/lib/db'

type OrganizationMembership = {
  organizationId: string
  role: string
  organization: {
    id: string
    name: string
    slug: string
  }
}

type WorkspaceOrderSummary = {
  id: string
  orderNumber: number | null
  status: string
  totalCents: number
  createdAt: Date
  updatedAt: Date
  itemCount: number
  revisionCount: number
  approvalRequestCount: number
}

export type ProjectWorkspaceSummary = {
  organizationId: string
  organizationName: string
  organizationSlug: string
  organizationRole: string
  projectCode: string
  orderCount: number
  spendCents: number
  lastOrderAt: Date
  revisionCount: number
  approvalCount: number
  statuses: string[]
  recentOrders: WorkspaceOrderSummary[]
}

export type ProjectWorkspaceDetail = ProjectWorkspaceSummary & {
  orders: WorkspaceOrderSummary[]
}

function extractProjectCode(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const value = (metadata as Record<string, unknown>).projectCode
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

async function listMemberships(userId: string): Promise<OrganizationMembership[]> {
  if (!userId) return []
  return prisma.organizationMember.findMany({
    where: { userId, status: 'active' },
    select: {
      organizationId: true,
      role: true,
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })
}

function buildWorkspaceSummary(
  membership: OrganizationMembership,
  projectCode: string,
  orders: WorkspaceOrderSummary[],
): ProjectWorkspaceSummary {
  const spendCents = orders.reduce((sum, order) => sum + Math.max(0, Number(order.totalCents) || 0), 0)
  const revisionCount = orders.reduce((sum, order) => sum + order.revisionCount, 0)
  const approvalCount = orders.reduce((sum, order) => sum + order.approvalRequestCount, 0)
  const statuses = Array.from(new Set(orders.map((order) => order.status).filter(Boolean)))
  const recentOrders = [...orders]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 3)
  const lastOrderAt = recentOrders[0]?.createdAt || new Date(0)

  return {
    organizationId: membership.organization.id,
    organizationName: membership.organization.name,
    organizationSlug: membership.organization.slug,
    organizationRole: membership.role,
    projectCode,
    orderCount: orders.length,
    spendCents,
    lastOrderAt,
    revisionCount,
    approvalCount,
    statuses,
    recentOrders,
  }
}

export async function listProjectWorkspacesForUser(userId: string): Promise<ProjectWorkspaceSummary[]> {
  const memberships = await listMemberships(userId)
  if (memberships.length === 0) return []

  const organizationIds = memberships.map((membership) => membership.organizationId)
  const orders = await prisma.printOrder.findMany({
    where: {
      organizationId: { in: organizationIds },
    },
    select: {
      id: true,
      orderNumber: true,
      organizationId: true,
      status: true,
      totalCents: true,
      createdAt: true,
      updatedAt: true,
      metadata: true,
      _count: {
        select: {
          items: true,
          revisions: true,
          approvalRequests: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const membershipByOrgId = new Map(memberships.map((membership) => [membership.organizationId, membership]))
  const grouped = new Map<string, { projectCode: string; orders: WorkspaceOrderSummary[] }>()

  for (const order of orders) {
    const projectCode = extractProjectCode(order.metadata)
    if (!projectCode || !order.organizationId) continue
    const key = `${order.organizationId}:${projectCode.toLowerCase()}`
    const existing = grouped.get(key) || { projectCode, orders: [] }
    existing.orders.push({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      totalCents: order.totalCents,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      itemCount: order._count.items,
      revisionCount: order._count.revisions,
      approvalRequestCount: order._count.approvalRequests,
    })
    grouped.set(key, existing)
  }

  return Array.from(grouped.entries())
    .map(([key, workspace]) => {
      const [organizationId] = key.split(':')
      const membership = membershipByOrgId.get(organizationId)
      if (!membership || workspace.orders.length === 0) return null
      return buildWorkspaceSummary(membership, workspace.projectCode, workspace.orders)
    })
    .filter((entry): entry is ProjectWorkspaceSummary => Boolean(entry))
    .sort((a, b) => {
      if (a.lastOrderAt.getTime() !== b.lastOrderAt.getTime()) return b.lastOrderAt.getTime() - a.lastOrderAt.getTime()
      return b.spendCents - a.spendCents
    })
}

export async function getProjectWorkspaceDetailForUser(
  userId: string,
  organizationId: string,
  projectCode: string,
): Promise<ProjectWorkspaceDetail | null> {
  const memberships = await listMemberships(userId)
  const membership = memberships.find((entry) => entry.organizationId === organizationId) || null
  if (!membership) return null

  const orders = await prisma.printOrder.findMany({
    where: {
      organizationId,
    },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      totalCents: true,
      createdAt: true,
      updatedAt: true,
      metadata: true,
      _count: {
        select: {
          items: true,
          revisions: true,
          approvalRequests: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const filteredOrders = orders
    .filter((order) => extractProjectCode(order.metadata)?.toLowerCase() === projectCode.toLowerCase())
    .map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      totalCents: order.totalCents,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      itemCount: order._count.items,
      revisionCount: order._count.revisions,
      approvalRequestCount: order._count.approvalRequests,
    }))

  if (filteredOrders.length === 0) return null

  const summary = buildWorkspaceSummary(membership, projectCode, filteredOrders)
  return {
    ...summary,
    orders: filteredOrders,
  }
}
