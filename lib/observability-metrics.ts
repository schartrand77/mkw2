type CounterBucket = {
  name: string
  labels: Record<string, string>
  value: number
}

type DurationBucket = {
  name: string
  labels: Record<string, string>
  count: number
  totalMs: number
  minMs: number
  maxMs: number
  samples: number[]
}

const counters = new Map<string, CounterBucket>()
const durations = new Map<string, DurationBucket>()
const startedAt = Date.now()
const MAX_DURATION_SAMPLES = 200

function toLabelKey(labels?: Record<string, string | number | boolean | null | undefined>) {
  if (!labels) return ''
  const entries = Object.entries(labels)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => [key, String(value)] as const)
    .sort(([a], [b]) => a.localeCompare(b))
  return entries.map(([key, value]) => `${key}=${value}`).join(',')
}

function normalizeLabels(labels?: Record<string, string | number | boolean | null | undefined>) {
  const out: Record<string, string> = {}
  if (!labels) return out
  for (const [key, value] of Object.entries(labels)) {
    if (value === undefined || value === null) continue
    out[key] = String(value)
  }
  return out
}

function metricKey(name: string, labels?: Record<string, string | number | boolean | null | undefined>) {
  const labelKey = toLabelKey(labels)
  return labelKey ? `${name}|${labelKey}` : name
}

export function incrementMetric(name: string, amount = 1, labels?: Record<string, string | number | boolean | null | undefined>) {
  const key = metricKey(name, labels)
  const existing = counters.get(key)
  if (existing) {
    existing.value += amount
    return
  }
  counters.set(key, {
    name,
    labels: normalizeLabels(labels),
    value: amount,
  })
}

export function observeDurationMetric(name: string, ms: number, labels?: Record<string, string | number | boolean | null | undefined>) {
  const key = metricKey(name, labels)
  const value = Number.isFinite(ms) ? Math.max(0, ms) : 0
  const existing = durations.get(key)
  if (existing) {
    existing.count += 1
    existing.totalMs += value
    existing.minMs = Math.min(existing.minMs, value)
    existing.maxMs = Math.max(existing.maxMs, value)
    existing.samples.push(value)
    if (existing.samples.length > MAX_DURATION_SAMPLES) {
      existing.samples.shift()
    }
    return
  }
  durations.set(key, {
    name,
    labels: normalizeLabels(labels),
    count: 1,
    totalMs: value,
    minMs: value,
    maxMs: value,
    samples: [value],
  })
}

function percentile(values: number[], p: number) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[index] ?? 0
}

export function getInMemoryMetricsSnapshot() {
  return {
    uptimeSec: Number(((Date.now() - startedAt) / 1000).toFixed(3)),
    counters: Array.from(counters.values()).sort((a, b) => a.name.localeCompare(b.name)),
    durations: Array.from(durations.values()).map((entry) => ({
      name: entry.name,
      labels: entry.labels,
      count: entry.count,
      avgMs: entry.count > 0 ? Number((entry.totalMs / entry.count).toFixed(3)) : 0,
      totalMs: Number(entry.totalMs.toFixed(3)),
      minMs: Number(entry.minMs.toFixed(3)),
      maxMs: Number(entry.maxMs.toFixed(3)),
      p95Ms: Number(percentile(entry.samples, 95).toFixed(3)),
    })).sort((a, b) => a.name.localeCompare(b.name)),
  }
}
