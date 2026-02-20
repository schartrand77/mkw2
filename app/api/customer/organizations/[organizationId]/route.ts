import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserIdFromCookie } from '@/lib/auth'
import { getOrganizationMembership, isPrivilegedOrgRole } from '@/lib/organizations'

export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ organizationId: string }> }

export async function GET(_: NextRequest, { params }: Context) {
  const { organizationId } = await params
  const userId = await getUserIdFromCookie()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const membership = await getOrganizationMembership(userId, organizationId)
  if (!membership) return NextResponse.json({ error: 'Organization not found.' }, { status: 404 })

  return NextResponse.json({
    organization: membership.organization,
    role: membership.role,
  })
}

export async function PATCH(req: NextRequest, { params }: Context) {
  const { organizationId } = await params
  const userId = await getUserIdFromCookie()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const membership = await getOrganizationMembership(userId, organizationId)
  if (!membership) return NextResponse.json({ error: 'Organization not found.' }, { status: 404 })
  if (!isPrivilegedOrgRole(membership.role)) {
    return NextResponse.json({ error: 'Only owners/approvers can update organization settings.' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const name = typeof body.name === 'string' ? body.name.trim() : null
  const billingEmail = typeof body.billingEmail === 'string' ? body.billingEmail.trim() : null
  const billingContact = typeof body.billingContact === 'string' ? body.billingContact.trim() : null
  const quoteApprovalRequired = typeof body.quoteApprovalRequired === 'boolean' ? body.quoteApprovalRequired : null
  const requirePoAboveCentsRaw = Number(body.requirePoAboveCents)

  const organization = await prisma.organization.update({
    where: { id: organizationId },
    data: {
      ...(name ? { name } : {}),
      ...(billingEmail !== null ? { billingEmail: billingEmail || null } : {}),
      ...(billingContact !== null ? { billingContact: billingContact || null } : {}),
      ...(quoteApprovalRequired !== null ? { quoteApprovalRequired } : {}),
      ...(Number.isFinite(requirePoAboveCentsRaw)
        ? { requirePoAboveCents: requirePoAboveCentsRaw > 0 ? Math.round(requirePoAboveCentsRaw) : null }
        : {}),
    },
    select: {
      id: true,
      name: true,
      slug: true,
      billingEmail: true,
      billingContact: true,
      quoteApprovalRequired: true,
      requirePoAboveCents: true,
      updatedAt: true,
    },
  })

  return NextResponse.json({ organization })
}
