export type Currency = 'USD' | 'CAD'

export function getCurrency(): Currency {
  const env = (process.env.NEXT_PUBLIC_CURRENCY || process.env.CURRENCY || 'USD').toString().toUpperCase()
  return env === 'CAD' ? 'CAD' : 'USD'
}

export function getCurrencySymbol(cur?: Currency): string {
  const c = cur || getCurrency()
  return c === 'CAD' ? 'CA$' : '$'
}

export function formatCurrency(amount: number, cur?: Currency): string {
  const c = cur || getCurrency()
  const locale = c === 'CAD' ? 'en-CA' : 'en-US'
  return new Intl.NumberFormat(locale, { style: 'currency', currency: c }).format(amount)
}

