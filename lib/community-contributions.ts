export const ORGANIZATION_CATEGORIES = ['customer', 'business', 'school', 'charity', 'community', 'internal'] as const
export type OrganizationCategory = typeof ORGANIZATION_CATEGORIES[number]

export const CONTRIBUTION_TYPES = ['paid', 'discounted', 'donated', 'cost_only', 'sponsored'] as const
export type ContributionType = typeof CONTRIBUTION_TYPES[number]

export const RECEIPT_STATUSES = ['none', 'requested', 'received', 'not_eligible'] as const
export type ReceiptStatus = typeof RECEIPT_STATUSES[number]

const organizationCategorySet = new Set<string>(ORGANIZATION_CATEGORIES)
const contributionTypeSet = new Set<string>(CONTRIBUTION_TYPES)
const receiptStatusSet = new Set<string>(RECEIPT_STATUSES)

function normalizeToken(value: unknown) {
  return typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[\s-]+/g, '_')
    : ''
}

export function normalizeOrganizationCategory(value: unknown): OrganizationCategory {
  const normalized = normalizeToken(value)
  return organizationCategorySet.has(normalized) ? normalized as OrganizationCategory : 'customer'
}

export function normalizeContributionType(value: unknown): ContributionType {
  const normalized = normalizeToken(value)
  return contributionTypeSet.has(normalized) ? normalized as ContributionType : 'paid'
}

export function normalizeReceiptStatus(value: unknown): ReceiptStatus {
  const normalized = normalizeToken(value)
  return receiptStatusSet.has(normalized) ? normalized as ReceiptStatus : 'none'
}

function positiveCents(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : 0
}

function positiveMinutes(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : 0
}

export type ContributionSummaryOrder = {
  organizationCategory?: string | null
  contributionType?: string | null
  totalCents: number
  subtotalCents: number
  donatedAmountCents?: number | null
  materialCostCents?: number | null
  machineTimeMinutes?: number | null
  receiptStatus?: string | null
}

export type ContributionSummary = {
  orderCount: number
  communityOrderCount: number
  donatedOrderCount: number
  discountedOrderCount: number
  donatedAmountCents: number
  materialCostCents: number
  machineTimeMinutes: number
  receiptCounts: Record<ReceiptStatus, number>
}

export function buildContributionSummary(orders: ContributionSummaryOrder[]): ContributionSummary {
  const summary: ContributionSummary = {
    orderCount: orders.length,
    communityOrderCount: 0,
    donatedOrderCount: 0,
    discountedOrderCount: 0,
    donatedAmountCents: 0,
    materialCostCents: 0,
    machineTimeMinutes: 0,
    receiptCounts: {
      none: 0,
      requested: 0,
      received: 0,
      not_eligible: 0,
    },
  }

  for (const order of orders) {
    const category = normalizeOrganizationCategory(order.organizationCategory)
    const type = normalizeContributionType(order.contributionType)
    const receiptStatus = normalizeReceiptStatus(order.receiptStatus)
    const isCommunity = category === 'charity' || category === 'community' || category === 'internal'
    const isContributed = type !== 'paid'

    if (isCommunity) summary.communityOrderCount += 1
    if (type === 'donated') summary.donatedOrderCount += 1
    if (type === 'discounted') summary.discountedOrderCount += 1

    if (isCommunity || isContributed) {
      summary.materialCostCents += positiveCents(order.materialCostCents)
      summary.machineTimeMinutes += positiveMinutes(order.machineTimeMinutes)
    }

    if (isContributed) {
      const explicitDonation = positiveCents(order.donatedAmountCents)
      const computedDonation = Math.max(0, positiveCents(order.subtotalCents) - positiveCents(order.totalCents))
      summary.donatedAmountCents += explicitDonation || computedDonation
    }

    summary.receiptCounts[receiptStatus] += 1
  }

  return summary
}
