export type DiscountSource = {
  discountPercent?: number | null
  friendsAndFamilyPercent?: number | null
  isFriendsAndFamily?: boolean | null
}

export type DiscountSummary = {
  discountPercent: number
  friendsAndFamilyPercent: number
  isFriendsAndFamily: boolean
  totalPercent: number
}

const MAX_DISCOUNT_PERCENT = 95

function clampPercent(value?: number | null) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0
  return Math.min(MAX_DISCOUNT_PERCENT, Math.max(0, Math.round(value * 100) / 100))
}

export function summarizeDiscount(source?: DiscountSource | null): DiscountSummary {
  const discountPercent = clampPercent(source?.discountPercent)
  const ffActive = !!source?.isFriendsAndFamily
  const friendsAndFamilyPercent = ffActive ? clampPercent(source?.friendsAndFamilyPercent) : 0
  const totalPercent = clampPercent(discountPercent + friendsAndFamilyPercent)
  return {
    discountPercent,
    friendsAndFamilyPercent,
    isFriendsAndFamily: ffActive,
    totalPercent,
  }
}

export function getDiscountMultiplier(summary?: DiscountSummary | null) {
  if (!summary) return 1
  return Math.max(0, 1 - summary.totalPercent / 100)
}
