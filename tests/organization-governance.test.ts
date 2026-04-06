import assert from 'node:assert/strict'
import test from 'node:test'

import {
  applyGovernancePolicyPack,
  buildApprovalGraph,
  summarizeGovernanceRisk,
} from '../lib/organization-governance'

test('policy packs preserve existing departments while applying stricter routing controls', () => {
  const result = applyGovernancePolicyPack({
    packId: 'enterprise_strict',
    currentProcurementConfig: {
      departments: [
        { code: 'ENG', name: 'Engineering', monthlyBudgetCents: 900000 },
      ],
      approvalRouting: [],
    },
  })

  assert.equal(result.quoteApprovalRequired, true)
  assert.equal(result.requirePoAboveCents, 250000)
  assert.equal(result.procurementConfig.departments.length, 1)
  assert.equal(result.procurementConfig.approvalRouting.length >= 2, true)
})

test('approval graph orders quote, po, and routing gates by threshold', () => {
  const result = buildApprovalGraph({
    quoteApprovalRequired: true,
    requirePoAboveCents: 100000,
    procurementConfig: {
      departments: [],
      approvalRouting: [
        { thresholdCents: 50000, approverRole: 'approver', label: 'Manager review' },
        { thresholdCents: 250000, approverRole: 'finance', label: 'Finance review' },
      ],
    },
  })

  assert.equal(result[0]?.gate, 'quote')
  assert.equal(result[1]?.thresholdCents, 50000)
  assert.equal(result[2]?.gate, 'purchase_order')
  assert.equal(result[3]?.approverRole, 'finance')
})

test('governance risk summary escalates missing approvers and over-budget departments', () => {
  const result = summarizeGovernanceRisk({
    memberCounts: { requester: 3 },
    procurementConfig: {
      departments: [
        { code: 'ENG', name: 'Engineering', monthlyBudgetCents: 500000 },
        { code: 'OPS', name: 'Operations', monthlyBudgetCents: null },
      ],
      approvalRouting: [],
    },
    usage90dDepartments: [
      { overBudget: true, monthlyBudgetCents: 500000 },
      { overBudget: false, monthlyBudgetCents: null },
    ],
    pendingApprovalRequests: 5,
  })

  assert.equal(result.riskLevel, 'high')
  assert.equal(result.missingApprovers, true)
  assert.equal(result.overBudgetDepartments, 1)
  assert.equal(result.reasons.some((reason) => /No active approver/i.test(reason)), true)
})
