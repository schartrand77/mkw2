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

  const members = await prisma.organizationMember.findMany({
    where: { organizationId, status: 'active' },
    include: {
      user: { select: { id: true, email: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({
    organization: membership.organization,
    role: membership.role,
    members: members.map((row) => ({
      id: row.id,
      role: row.role,
      status: row.status,
      joinedAt: row.createdAt,
      user: row.user,
    })),
  })
}

export async function POST(req: NextRequest, { params }: Context) {
  const { organizationId } = await params
  const userId = await getUserIdFromCookie()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const membership = await getOrganizationMembership(userId, organizationId)
  if (!membership) return NextResponse.json({ error: 'Organization not found.' }, { status: 404 })
  if (!isPrivilegedOrgRole(membership.role)) {
    return NextResponse.json({ error: 'Only owners/approvers can manage members.' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const roleRaw = typeof body.role === 'string' ? body.role.trim().toLowerCase() : 'requester'
  const role = ['owner', 'approver', 'requester', 'finance'].includes(roleRaw) ? roleRaw : 'requester'
  if (!email) return NextResponse.json({ error: 'Member email is required.' }, { status: 400 })

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, name: true } })
  if (!user) {
    return NextResponse.json({ error: 'User not found. Ask them to create an account first.' }, { status: 404 })
  }

  const created = await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId,
        userId: user.id,
      },
    },
    update: { role, status: 'active' },
    create: {
      organizationId,
      userId: user.id,
      role,
      status: 'active',
    },
    include: { user: { select: { id: true, email: true, name: true } } },
  })

  return NextResponse.json({
    member: {
      id: created.id,
      role: created.role,
      status: created.status,
      joinedAt: created.createdAt,
      user: created.user,
    },
  })
}
