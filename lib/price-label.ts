import { formatCurrency } from '@/lib/currency'

const UNIT_LABELS: Record<string, string> = {
  ea: 'ea',
  bx: 'bx',
  complete: 'complete',
}

export function formatPriceLabel(
  price: number | null | undefined,
  options?: { from?: boolean; unit?: string | null },
) {
  if (price == null || Number.isNaN(price)) return null
  const parts: string[] = []
  if (options?.from) {
    parts.push('From')
  }
  parts.push(formatCurrency(price))
  const unitKey = (options?.unit || '').toLowerCase().trim()
  if (unitKey) {
    parts.push(UNIT_LABELS[unitKey] || unitKey)
  }
  return parts.join(' ')
}
