import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { parseProcurementConfig } from '@/lib/procurement-config'
import { normalizeOrganizationCategory } from '@/lib/community-contributions'

export type OrganizationRole = 'owner' | 'approver' | 'requester' | 'finance'

const PRIVILEGED_ORG_ROLES = new Set<OrganizationRole>(['owner', 'approver'])

type OrganizationMembershipWithOrganization = Prisma.OrganizationMemberGetPayload<{
  include: {
    organization: {
      select: {
        id: true
        name: true
        slug: true
        category: true
        charitableRegistrationNumber: true
        communityNotes: true
        billingEmail: true
        billingContact: true
        quoteApprovalRequired: true
        requirePoAboveCents: true
        procurementConfig: true
      }
    }
  }
}>

export function isPrivilegedOrgRole(role: string | null | undefined) {
  return PRIVILEGED_ORG_ROLES.has((role || '').toLowerCase() as OrganizationRole)
}

export async function getOrganizationMembership(userId: string, organizationId: string): Promise<OrganizationMembershipWithOrganization | null> {
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
          category: true,
          charitableRegistrationNumber: true,
          communityNotes: true,
          billingEmail: true,
          billingContact: true,
          quoteApprovalRequired: true,
          requirePoAboveCents: true,
          procurementConfig: true,
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

export function serializeOrganizationSummary(organization: {
  id: string
  name: string
  slug: string
  category?: string | null
  charitableRegistrationNumber?: string | null
  communityNotes?: string | null
  billingEmail: string | null
  billingContact: string | null
  quoteApprovalRequired: boolean
  requirePoAboveCents: number | null
  procurementConfig?: unknown
}) {
  return {
    ...organization,
    category: normalizeOrganizationCategory(organization.category),
    procurementConfig: parseProcurementConfig(organization.procurementConfig),
  }
}
