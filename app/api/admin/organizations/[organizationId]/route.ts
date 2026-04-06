import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/app/api/admin/_utils'
import { getAdminAuditRequestMeta, recordAdminAuditEvent } from '@/lib/admin-audit'
import {
  applyGovernancePolicyPack,
  buildAdminGovernanceOrganizations,
  type GovernancePolicyPackId,
} from '@/lib/organization-governance'
import { parseProcurementConfig } from '@/lib/procurement-config'

type Context = { params: Promise<{ organizationId: string }> }

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: Context) {
  let adminId = ''
  try {
    adminId = await requireAdmin()
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }

  try {
    const { organizationId } = await params
    const body = await req.json().catch(() => ({} as Record<string, unknown>))
    const policyPackId = typeof body.policyPackId === 'string' ? body.policyPackId as GovernancePolicyPackId : null
    const name = typeof body.name === 'string' ? body.name.trim() : null
    const billingEmail = typeof body.billingEmail === 'string' ? body.billingEmail.trim() : null
    const billingContact = typeof body.billingContact === 'string' ? body.billingContact.trim() : null
    const quoteApprovalRequired = typeof body.quoteApprovalRequired === 'boolean' ? body.quoteApprovalRequired : null
    const requirePoAboveCentsRaw = Number(body.requirePoAboveCents)
    const procurementConfig = body.procurementConfig

    const existing = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        procurementConfig: true,
      },
    })
    if (!existing) return NextResponse.json({ error: 'Organization not found.' }, { status: 404 })

    const nextPack = policyPackId
      ? applyGovernancePolicyPack({
          packId: policyPackId,
          currentProcurementConfig: parseProcurementConfig(existing.procurementConfig),
        })
      : null

    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        ...(name ? { name } : {}),
        ...(billingEmail !== null ? { billingEmail: billingEmail || null } : {}),
        ...(billingContact !== null ? { billingContact: billingContact || null } : {}),
        ...(nextPack
          ? {
              quoteApprovalRequired: nextPack.quoteApprovalRequired,
              requirePoAboveCents: nextPack.requirePoAboveCents,
              procurementConfig: nextPack.procurementConfig,
            }
          : {}),
        ...(quoteApprovalRequired !== null ? { quoteApprovalRequired } : {}),
        ...(Number.isFinite(requirePoAboveCentsRaw)
          ? { requirePoAboveCents: requirePoAboveCentsRaw > 0 ? Math.round(requirePoAboveCentsRaw) : null }
          : {}),
        ...(procurementConfig && typeof procurementConfig === 'object' && !Array.isArray(procurementConfig)
          ? { procurementConfig: parseProcurementConfig(procurementConfig) }
          : {}),
      },
    })

    await recordAdminAuditEvent({
      adminId,
      action: nextPack ? 'organization.policy_pack_applied' : 'organization.policy_updated',
      targetType: 'organization',
      targetId: organizationId,
      ...getAdminAuditRequestMeta(req),
      metadata: nextPack
        ? { policyPackId }
        : {
            quoteApprovalRequired,
            requirePoAboveCents: Number.isFinite(requirePoAboveCentsRaw) ? Math.round(requirePoAboveCentsRaw) : null,
          },
    })

    const organizations = await buildAdminGovernanceOrganizations()
    const organization = organizations.find((entry) => entry.id === organizationId)
    return NextResponse.json({ organization })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to update organization governance.' }, { status: 400 })
  }
}
