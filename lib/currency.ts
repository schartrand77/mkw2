export type Currency = 'USD' | 'CAD' | 'AUD'

const SUPPORTED_CURRENCIES = new Set<Currency>(['USD', 'CAD', 'AUD'])

export function getCurrency(): Currency {
  const env = (process.env.NEXT_PUBLIC_CURRENCY || process.env.CURRENCY || 'USD').toString().toUpperCase()
  return SUPPORTED_CURRENCIES.has(env as Currency) ? env as Currency : 'USD'
}

export function getCurrencySymbol(cur?: Currency): string {
  const c = cur || getCurrency()
  if (c === 'AUD') return 'A$'
  return c === 'CAD' ? 'CA$' : '$'
}

export function formatCurrency(amount: number, cur?: Currency): string {
  const c = cur || getCurrency()
  const locale = c === 'CAD' ? 'en-CA' : 'en-US'
  return new Intl.NumberFormat(locale, { style: 'currency', currency: c }).format(amount)
}
