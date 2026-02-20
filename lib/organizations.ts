import { prisma } from '@/lib/db'

export type OrganizationRole = 'owner' | 'approver' | 'requester' | 'finance'

const PRIVILEGED_ORG_ROLES = new Set<OrganizationRole>(['owner', 'approver'])

export function isPrivilegedOrgRole(role: string | null | undefined) {
  return PRIVILEGED_ORG_ROLES.has((role || '').toLowerCase() as OrganizationRole)
}

export async function getOrganizationMembership(userId: string, organizationId: string) {
  if (!userId || !organizationId) return null
  return prisma.organizationMember.findFirst({
    where: {
      userId,
      organizationId,
      status: 'active',
    },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          billingEmail: true,
          billingContact: true,
          quoteApprovalRequired: true,
          requirePoAboveCents: true,
        },
      },
    },
  })
}

export async function listOrganizationIdsForUser(userId: string) {
  if (!userId) return []
  const rows = await prisma.organizationMember.findMany({
    where: { userId, status: 'active' },
    select: { organizationId: true },
  })
  return rows.map((row) => row.organizationId)
}
