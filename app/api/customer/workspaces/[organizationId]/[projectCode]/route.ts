import { NextRequest, NextResponse } from 'next/server'
import { getUserIdFromCookie } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getProjectWorkspaceDetailForUser } from '@/lib/project-workspaces'

type WorkspaceDetailContext = {
  params: Promise<{
    organizationId: string
    projectCode: string
  }>
}

export async function GET(_req: NextRequest, { params }: WorkspaceDetailContext) {
  const userId = await getUserIdFromCookie()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { organizationId, projectCode } = await params
  const workspace = await getProjectWorkspaceDetailForUser(userId, organizationId, decodeURIComponent(projectCode))
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const members = await prisma.organizationMember.findMany({
    where: { organizationId, status: 'active' },
    select: {
      role: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true } },
      organization: {
        select: {
          quoteApprovalRequired: true,
          requirePoAboveCents: true,
          billingEmail: true,
          billingContact: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({
    workspace,
    members,
    policy: members[0]?.organization || null,
  })
}
