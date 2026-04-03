import { prisma } from '@/lib/db'

type DailyActual = {
  date: string
  orders: number
  revenueCents: number
}

type DailyForecast = {
  date: string
  expectedOrders: number
  expectedRevenueCents: number
  confidence: 'low' | 'medium' | 'high'
}

function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function parseDateKey(value: string) {
  return new Date(`${value}T00:00:00Z`)
}

function buildDateRange(days: number, end = new Date()) {
  const dates: string[] = []
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(end)
    d.setUTCDate(d.getUTCDate() - i)
    dates.push(formatDateKey(d))
  }
  return dates
}

export async function getDemandForecast(options?: { historyDays?: number; horizonDays?: number }) {
  const historyDays = options?.historyDays ?? 56
  const horizonDays = options?.horizonDays ?? 30
  const since = new Date(Date.now() - historyDays * 24 * 60 * 60 * 1000)

  const orders = await prisma.printOrder.findMany({
    where: { createdAt: { gte: since } },
    select: { createdAt: true, totalCents: true },
  })

  const historyKeys = buildDateRange(historyDays)
  const dailyMap = new Map<string, { orders: number; revenueCents: number }>()
  for (const key of historyKeys) {
    dailyMap.set(key, { orders: 0, revenueCents: 0 })
  }
  for (const order of orders) {
    const key = formatDateKey(order.createdAt)
    const entry = dailyMap.get(key)
    if (!entry) continue
    entry.orders += 1
    entry.revenueCents += order.totalCents ?? 0
  }

  const history: DailyActual[] = historyKeys.map((key) => {
    const entry = dailyMap.get(key)
    return {
      date: key,
      orders: entry?.orders ?? 0,
      revenueCents: entry?.revenueCents ?? 0,
    }
  })

  const byDow = Array.from({ length: 7 }, () => ({ orders: [] as number[], revenue: [] as number[] }))
  history.forEach((day) => {
    const dow = parseDateKey(day.date).getUTCDay()
    byDow[dow].orders.push(day.orders)
    byDow[dow].revenue.push(day.revenueCents)
  })

  const avg = (values: number[]) => {
    if (!values.length) return 0
    return values.reduce((sum, v) => sum + v, 0) / values.length
  }

  const overallOrders = avg(history.map((d) => d.orders))
  const overallRevenue = avg(history.map((d) => d.revenueCents))

  const nextDates = buildDateRange(horizonDays, new Date(Date.now() + horizonDays * 24 * 60 * 60 * 1000))
  const forecast: DailyForecast[] = nextDates.map((key) => {
    const date = parseDateKey(key)
    const dow = date.getUTCDay()
    const ordersSamples = byDow[dow].orders
    const revenueSamples = byDow[dow].revenue
    const expectedOrders = avg(ordersSamples) || overallOrders
    const expectedRevenue = avg(revenueSamples) || overallRevenue
    const samples = Math.max(ordersSamples.length, revenueSamples.length)
    const confidence = samples >= 8 ? 'high' : samples >= 4 ? 'medium' : 'low'
    return {
      date: key,
      expectedOrders: Number(expectedOrders.toFixed(2)),
      expectedRevenueCents: Math.round(expectedRevenue),
      confidence,
    }
  })

  return {
    range: { historyDays, horizonDays },
    history,
    forecast,
    summary: {
      averageOrdersPerDay: Number(overallOrders.toFixed(2)),
      averageRevenuePerDayCents: Math.round(overallRevenue),
    },
  }
}
