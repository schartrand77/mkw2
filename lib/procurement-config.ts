export type ProcurementDepartment = {
  code: string
  name: string
  monthlyBudgetCents?: number | null
}

export type ProcurementRoutingRule = {
  thresholdCents: number
  approverRole: string
  label?: string | null
}

export type ProcurementConfig = {
  departments: ProcurementDepartment[]
  approvalRouting: ProcurementRoutingRule[]
}

function normalizeCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9_-]+/g, '')
}

export function parseProcurementConfig(raw: unknown): ProcurementConfig {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { departments: [], approvalRouting: [] }
  }
  const record = raw as Record<string, unknown>
  const departments: ProcurementDepartment[] = Array.isArray(record.departments)
    ? record.departments.flatMap((entry) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return []
        const item = entry as Record<string, unknown>
        const code = normalizeCode(String(item.code || ''))
        const name = String(item.name || '').trim()
        const monthlyBudgetCents = Number(item.monthlyBudgetCents)
        if (!code || !name) return []
        return [{
          code,
          name,
          monthlyBudgetCents: Number.isFinite(monthlyBudgetCents) && monthlyBudgetCents > 0 ? Math.round(monthlyBudgetCents) : null,
        }]
      })
    : []
  const approvalRouting: ProcurementRoutingRule[] = Array.isArray(record.approvalRouting)
    ? record.approvalRouting.flatMap((entry) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return []
        const item = entry as Record<string, unknown>
        const thresholdCents = Number(item.thresholdCents)
        const approverRole = String(item.approverRole || '').trim().toLowerCase()
        const label = String(item.label || '').trim()
        if (!Number.isFinite(thresholdCents) || thresholdCents < 0 || !approverRole) return []
        return [{
          thresholdCents: Math.round(thresholdCents),
          approverRole,
          label: label || null,
        }]
      })
    : []
  return {
    departments,
    approvalRouting: approvalRouting.sort((a, b) => a.thresholdCents - b.thresholdCents),
  }
}
