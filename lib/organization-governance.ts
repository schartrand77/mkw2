import { prisma } from '@/lib/db'
import { parseProcurementConfig, type ProcurementConfig } from '@/lib/procurement-config'

export type GovernancePolicyPackId = 'maker_lab' | 'controlled_spend' | 'enterprise_strict'

export type GovernancePolicyPack = {
  id: GovernancePolicyPackId
  label: string
  description: string
  quoteApprovalRequired: boolean
  requirePoAboveCents: number | null
  procurementConfig: ProcurementConfig
}

export type GovernanceApprovalGraphNode = {
  thresholdCents: number
  approverRole: string
  label: string
  gate: 'quote' | 'purchase_order' | 'approval_route'
}

export type GovernanceRiskSummary = {
  riskLevel: 'low' | 'medium' | 'high'
  reasons: string[]
  overBudgetDepartments: number
  missingBudgets: number
  missingApprovers: boolean
}

export type AdminGovernanceOrganization = {
  id: string
  name: string
  slug: string
  billingEmail: string | null
  billingContact: string | null
  quoteApprovalRequired: boolean
  requirePoAboveCents: number | null
  procurementConfig: ProcurementConfig
  createdAt: string
  updatedAt: string
  memberCounts: Record<string, number>
  totalMembers: number
  usage90d: {
    orders: number
    spendCents: number
    pendingApprovalRequests: number
    departments: Array<{
      code: string
      name: string
      spendCents: number
      monthlyBudgetCents: number | null
      overBudget: boolean
      remainingBudgetCents: number | null
    }>
  }
  approvalGraph: GovernanceApprovalGraphNode[]
  governanceRisk: GovernanceRiskSummary
}

export const GOVERNANCE_POLICY_PACKS: GovernancePolicyPack[] = [
  {
    id: 'maker_lab',
    label: 'Maker Lab',
    description: 'Low-friction team setting with light approval and shared lab budgets.',
    quoteApprovalRequired: false,
    requirePoAboveCents: null,
    procurementConfig: {
      departments: [
        { code: 'LAB', name: 'Lab Operations', monthlyBudgetCents: 300000 },
        { code: 'RND', name: 'R&D', monthlyBudgetCents: 500000 },
      ],
      approvalRouting: [
        { thresholdCents: 150000, approverRole: 'owner', label: 'Large prototype review' },
      ],
    },
  },
  {
    id: 'controlled_spend',
    label: 'Controlled Spend',
    description: 'Mid-market approval structure with PO gates and departmental controls.',
    quoteApprovalRequired: true,
    requirePoAboveCents: 100000,
    procurementConfig: {
      departments: [
        { code: 'ENG', name: 'Engineering', monthlyBudgetCents: 600000 },
        { code: 'OPS', name: 'Operations', monthlyBudgetCents: 450000 },
        { code: 'MKT', name: 'Marketing', monthlyBudgetCents: 250000 },
      ],
      approvalRouting: [
        { thresholdCents: 50000, approverRole: 'approver', label: 'Manager approval' },
        { thresholdCents: 250000, approverRole: 'finance', label: 'Finance review' },
      ],
    },
  },
  {
    id: 'enterprise_strict',
    label: 'Enterprise Strict',
    description: 'Multi-step approval path with finance control and higher governance rigor.',
    quoteApprovalRequired: true,
    requirePoAboveCents: 250000,
    procurementConfig: {
      departments: [
        { code: 'ENG', name: 'Engineering', monthlyBudgetCents: 1200000 },
        { code: 'OPS', name: 'Operations', monthlyBudgetCents: 900000 },
        { code: 'QA', name: 'Quality Assurance', monthlyBudgetCents: 400000 },
        { code: 'FIN', name: 'Finance', monthlyBudgetCents: 300000 },
      ],
      approvalRouting: [
        { thresholdCents: 100000, approverRole: 'approver', label: 'Department approver' },
        { thresholdCents: 250000, approverRole: 'finance', label: 'PO compliance review' },
        { thresholdCents: 500000, approverRole: 'owner', label: 'Executive approval' },
      ],
    },
  },
]

function parseOrderMetadata(raw: unknown) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  return raw as Record<string, unknown>
}

export function buildApprovalGraph(args: {
  quoteApprovalRequired: boolean
  requirePoAboveCents: number | null
  procurementConfig: ProcurementConfig
}) {
  const nodes: GovernanceApprovalGraphNode[] = []
  if (args.quoteApprovalRequired) {
    nodes.push({
      thresholdCents: 0,
      approverRole: 'requester',
      label: 'Quote approval required before production',
      gate: 'quote',
    })
  }
  if (typeof args.requirePoAboveCents === 'number' && args.requirePoAboveCents > 0) {
    nodes.push({
      thresholdCents: args.requirePoAboveCents,
      approverRole: 'finance',
      label: 'PO required above threshold',
      gate: 'purchase_order',
    })
  }
  for (const route of args.procurementConfig.approvalRouting) {
    nodes.push({
      thresholdCents: route.thresholdCents,
      approverRole: route.approverRole,
      label: route.label || `${route.approverRole} approval`,
      gate: 'approval_route',
    })
  }
  return nodes.sort((a, b) => a.thresholdCents - b.thresholdCents || a.label.localeCompare(b.label))
}

export function applyGovernancePolicyPack(args: {
  packId: GovernancePolicyPackId
  currentProcurementConfig?: ProcurementConfig | null
}) {
  const pack = GOVERNANCE_POLICY_PACKS.find((entry) => entry.id === args.packId)
  if (!pack) throw new Error('Unknown governance policy pack')
  const current = args.currentProcurementConfig || { departments: [], approvalRouting: [] }
  return {
    quoteApprovalRequired: pack.quoteApprovalRequired,
    requirePoAboveCents: pack.requirePoAboveCents,
    procurementConfig: {
      departments: current.departments.length > 0 ? current.departments : pack.procurementConfig.departments,
      approvalRouting: pack.procurementConfig.approvalRouting,
    } satisfies ProcurementConfig,
  }
}

export function summarizeGovernanceRisk(args: {
  memberCounts: Record<string, number>
  procurementConfig: ProcurementConfig
  usage90dDepartments: Array<{ overBudget: boolean; monthlyBudgetCents: number | null }>
  pendingApprovalRequests: number
}) {
  const overBudgetDepartments = args.usage90dDepartments.filter((entry) => entry.overBudget).length
  const missingBudgets = args.procurementConfig.departments.filter((entry) => !(typeof entry.monthlyBudgetCents === 'number' && entry.monthlyBudgetCents > 0)).length
  const missingApprovers = (args.memberCounts.approver || 0) + (args.memberCounts.owner || 0) === 0
  const reasons: string[] = []
  let score = 0

  if (overBudgetDepartments > 0) {
    score += 0.4
    reasons.push(`${overBudgetDepartments} department budget${overBudgetDepartments === 1 ? '' : 's'} exceeded.`)
  }
  if (missingBudgets > 0) {
    score += 0.2
    reasons.push(`${missingBudgets} department${missingBudgets === 1 ? '' : 's'} missing a budget.`)
  }
  if (missingApprovers) {
    score += 0.3
    reasons.push('No active approver or owner assigned.')
  }
  if (args.pendingApprovalRequests > 3) {
    score += 0.2
    reasons.push(`${args.pendingApprovalRequests} approvals are currently pending.`)
  }
  if (reasons.length === 0) reasons.push('Controls are configured and budget signals are within range.')

  return {
    riskLevel: score >= 0.6 ? 'high' : score >= 0.3 ? 'medium' : 'low',
    reasons,
    overBudgetDepartments,
    missingBudgets,
    missingApprovers,
  } satisfies GovernanceRiskSummary
}

export async function buildAdminGovernanceOrganizations(): Promise<AdminGovernanceOrganization[]> {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  const organizations = await prisma.organization.findMany({
    orderBy: { name: 'asc' },
    include: {
      members: {
        where: { status: 'active' },
        select: { role: true },
      },
      orders: {
        where: { createdAt: { gte: since } },
        select: {
          totalCents: true,
          metadata: true,
          approvalRequests: {
            where: { status: 'pending' },
            select: { id: true },
          },
        },
      },
    },
  })

  return organizations.map((organization) => {
    const procurementConfig = parseProcurementConfig(organization.procurementConfig)
    const spendByDepartment = new Map<string, number>()
    let pendingApprovalRequests = 0

    for (const order of organization.orders) {
      pendingApprovalRequests += order.approvalRequests.length
      const metadata = parseOrderMetadata(order.metadata)
      const departmentCode = typeof metadata.departmentCode === 'string'
        ? metadata.departmentCode.trim().toUpperCase()
        : null
      if (departmentCode) {
        spendByDepartment.set(departmentCode, (spendByDepartment.get(departmentCode) || 0) + (order.totalCents || 0))
      }
    }

    const memberCounts = organization.members.reduce((acc, member) => {
      const key = String(member.role || 'requester').toLowerCase()
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const usage90dDepartments = procurementConfig.departments.map((department) => {
      const spendCents = spendByDepartment.get(department.code) || 0
      const remainingBudgetCents = typeof department.monthlyBudgetCents === 'number'
        ? department.monthlyBudgetCents - spendCents
        : null
      return {
        code: department.code,
        name: department.name,
        spendCents,
        monthlyBudgetCents: department.monthlyBudgetCents ?? null,
        overBudget: typeof remainingBudgetCents === 'number' ? remainingBudgetCents < 0 : false,
        remainingBudgetCents,
      }
    })

    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      billingEmail: organization.billingEmail,
      billingContact: organization.billingContact,
      quoteApprovalRequired: organization.quoteApprovalRequired,
      requirePoAboveCents: organization.requirePoAboveCents,
      procurementConfig,
      createdAt: organization.createdAt.toISOString(),
      updatedAt: organization.updatedAt.toISOString(),
      memberCounts,
      totalMembers: organization.members.length,
      usage90d: {
        orders: organization.orders.length,
        spendCents: organization.orders.reduce((sum, order) => sum + (order.totalCents || 0), 0),
        pendingApprovalRequests,
        departments: usage90dDepartments,
      },
      approvalGraph: buildApprovalGraph({
        quoteApprovalRequired: organization.quoteApprovalRequired,
        requirePoAboveCents: organization.requirePoAboveCents,
        procurementConfig,
      }),
      governanceRisk: summarizeGovernanceRisk({
        memberCounts,
        procurementConfig,
        usage90dDepartments,
        pendingApprovalRequests,
      }),
    } satisfies AdminGovernanceOrganization
  })
}
