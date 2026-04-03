import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserIdFromCookie } from '@/lib/auth'
import { getOrganizationMembership } from '@/lib/organizations'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

const schema = z.object({
  name: z.string().min(1).max(80),
  data: z.any(),
  organizationId: z.string().cuid().optional(),
  visibility: z.enum(['personal', 'organization']).optional(),
})

export async function GET() {
  const userId = await getUserIdFromCookie()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const memberships = await prisma.organizationMember.findMany({
    where: { userId, status: 'active' },
    select: {
      organizationId: true,
      organization: { select: { id: true, name: true } },
    },
  })
  const organizationIds = memberships.map((entry) => entry.organizationId)
  const organizationNameById = new Map(memberships.map((entry) => [entry.organization.id, entry.organization.name]))
  const memberRows = organizationIds.length > 0
    ? await prisma.organizationMember.findMany({
      where: {
        organizationId: { in: organizationIds },
        status: 'active',
      },
      select: { userId: true },
    })
    : []
  const visibleUserIds = Array.from(new Set([userId, ...memberRows.map((entry) => entry.userId)]))

  const presets = await prisma.customerPreset.findMany({
    where: { userId: { in: visibleUserIds } },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      data: true,
      createdAt: true,
      updatedAt: true,
      userId: true,
      user: { select: { id: true, name: true } },
    },
  })
  const visiblePresets = presets.filter((preset) => {
    if (preset.userId === userId) return true
    if (!preset.data || typeof preset.data !== 'object' || Array.isArray(preset.data)) return false
    const record = preset.data as Record<string, unknown>
    const visibility = typeof record.visibility === 'string' ? record.visibility : 'personal'
    const organizationId = typeof record.organizationId === 'string' ? record.organizationId : ''
    return visibility === 'organization' && organizationNameById.has(organizationId)
  }).map((preset) => {
    const record = preset.data && typeof preset.data === 'object' && !Array.isArray(preset.data)
      ? preset.data as Record<string, unknown>
      : null
    const organizationId = typeof record?.organizationId === 'string' ? record.organizationId : null
    const organizationName = organizationId ? organizationNameById.get(organizationId) || (typeof record?.organizationName === 'string' ? record.organizationName : null) : null
    return {
      id: preset.id,
      name: preset.name,
      data: preset.data,
      createdAt: preset.createdAt,
      updatedAt: preset.updatedAt,
      ownedByMe: preset.userId === userId,
      ownerName: preset.user?.name || null,
      organizationId,
      organizationName,
      scope: organizationId ? 'organization' : 'personal',
    }
  })
  return NextResponse.json({ presets: visiblePresets })
}

export async function POST(req: Request) {
  const userId = await getUserIdFromCookie()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const json = await req.json()
    const parsed = schema.parse(json)
    if (!parsed.data || typeof parsed.data !== 'object') {
      return NextResponse.json({ error: 'Preset data must be an object.' }, { status: 400 })
    }
    let data = parsed.data as Record<string, unknown>
    if (parsed.visibility === 'organization' || parsed.organizationId) {
      if (!parsed.organizationId) {
        return NextResponse.json({ error: 'Organization preset requires an organization.' }, { status: 400 })
      }
      const membership = await getOrganizationMembership(userId, parsed.organizationId)
      if (!membership) {
        return NextResponse.json({ error: 'You are not an active member of that organization.' }, { status: 403 })
      }
      data = {
        ...data,
        visibility: 'organization',
        organizationId: membership.organization.id,
        organizationName: membership.organization.name,
      }
    } else {
      const { visibility, organizationId, organizationName, ...rest } = data
      void visibility
      void organizationId
      void organizationName
      data = rest
    }
    const preset = await prisma.customerPreset.create({
      data: {
        userId,
        name: parsed.name.trim(),
        data: data as Prisma.InputJsonValue,
      },
    })
    return NextResponse.json({ preset })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid request' }, { status: 400 })
  }
}
