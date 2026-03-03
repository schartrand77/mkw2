import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserIdFromCookie } from '@/lib/auth'
import { parseProcurementConfig } from '@/lib/procurement-config'

export const dynamic = 'force-dynamic'

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
}

export async function GET() {
  const userId = await getUserIdFromCookie()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const memberships = await prisma.organizationMember.findMany({
    where: { userId, status: 'active' },
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
          procurementConfig: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({
    organizations: memberships.map((membership) => ({
      id: membership.organization.id,
      name: membership.organization.name,
      slug: membership.organization.slug,
      role: membership.role,
      billingEmail: membership.organization.billingEmail,
      billingContact: membership.organization.billingContact,
      quoteApprovalRequired: membership.organization.quoteApprovalRequired,
      requirePoAboveCents: membership.organization.requirePoAboveCents,
      procurementConfig: parseProcurementConfig(membership.organization.procurementConfig),
      joinedAt: membership.createdAt,
      createdAt: membership.organization.createdAt,
    })),
  })
}

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromCookie()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: 'Organization name is required.' }, { status: 400 })

  const billingEmail = typeof body.billingEmail === 'string' ? body.billingEmail.trim() : ''
  const billingContact = typeof body.billingContact === 'string' ? body.billingContact.trim() : ''
  const quoteApprovalRequired = body.quoteApprovalRequired !== false
  const requirePoAboveCents = Number(body.requirePoAboveCents)
  const slugBase = slugify(typeof body.slug === 'string' ? body.slug : name)
  if (!slugBase) return NextResponse.json({ error: 'Invalid organization slug.' }, { status: 400 })

  const existing = await prisma.organization.findUnique({ where: { slug: slugBase }, select: { id: true } })
  const slug = existing ? `${slugBase}-${Date.now().toString().slice(-4)}` : slugBase

  const organization = await prisma.organization.create({
    data: {
      name,
      slug,
      billingEmail: billingEmail || null,
      billingContact: billingContact || null,
      quoteApprovalRequired,
      requirePoAboveCents: Number.isFinite(requirePoAboveCents) && requirePoAboveCents > 0 ? Math.round(requirePoAboveCents) : null,
      procurementConfig: {
        departments: [],
        approvalRouting: [],
      },
      createdById: userId,
      members: {
        create: {
          userId,
          role: 'owner',
          status: 'active',
        },
      },
    },
  })

  return NextResponse.json({ organization })
}
