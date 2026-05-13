import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server'

import { adminRouteGuards } from '../app/api/admin/_utils'
import { prisma } from '../lib/db'

function buildRequest(body: unknown) {
  return new NextRequest('http://localhost/api/admin/orders/order_123/printlab-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const routeContext = {
  params: Promise.resolve({ orderId: 'order_123' }),
} as any

test('admin PrintLab link route stores exact successful G-code data and triggers StockWorks', async () => {
  const route = await import('../app/api/admin/orders/[orderId]/printlab-link/route')
  const originalRequireAdmin = adminRouteGuards.requireAdmin
  const originalOrderFindUnique = (prisma.printOrder as any).findUnique
  const originalOrderUpdate = (prisma.printOrder as any).update
  const originalFetchSuccessful = route.printLabOrderLinkRouteOps.fetchPrintLabSuccessfulGcodes
  const originalConsume = route.printLabOrderLinkRouteOps.maybeConsumeStockForOrder
  const originalAudit = route.printLabOrderLinkRouteOps.recordAdminAuditEvent
  let updateArgs: any = null
  let consumeArgs: any[] | null = null

  adminRouteGuards.requireAdmin = async () => 'admin_1'
  ;(prisma.printOrder as any).findUnique = async () => ({
    id: 'order_123',
    status: 'printing',
    metadata: { keep: 'value' },
  }) as any
  ;(prisma.printOrder as any).update = async (args: any) => {
    updateArgs = args
    return { id: 'order_123' } as any
  }
  route.printLabOrderLinkRouteOps.fetchPrintLabSuccessfulGcodes = async () => [
    {
      id: 'gcode_1',
      printer_name: 'X1C',
      file_name: 'fixture.gcode.3mf',
      plate_gcode: 'Metadata/plate_1.gcode',
      plate_index: 1,
      material_usage: [{ material: 'PLA', grams: 18.4, colors: ['Black'] }],
      completed_at: '2026-05-12T15:00:00.000Z',
    },
  ] as any
  route.printLabOrderLinkRouteOps.maybeConsumeStockForOrder = async (...args: any[]) => {
    consumeArgs = args
    return { ok: true, movements: 1 } as any
  }
  route.printLabOrderLinkRouteOps.recordAdminAuditEvent = async () => undefined

  try {
    const res = await route.POST(buildRequest({
      mode: 'successful_gcode',
      id: 'gcode_1',
      note: 'matched after print completed',
    }), routeContext)

    assert.equal(res.status, 200)
    const payload = await res.json()
    assert.equal(payload.ok, true)
    assert.equal(payload.attachment.successfulGcodeId, 'gcode_1')
    assert.equal(payload.attachment.plateGcode, 'Metadata/plate_1.gcode')
    assert.deepEqual(updateArgs.data.metadata.slicerStats.materials, [
      { material: 'PLA', grams: 18.4, colors: ['Black'], source: 'printlab' },
    ])
    assert.equal(updateArgs.data.status, 'completed')
    assert.deepEqual(consumeArgs, ['order_123', 'printlab-admin-link'])
    assert.deepEqual(payload.stockworks, { ok: true, movements: 1 })
  } finally {
    adminRouteGuards.requireAdmin = originalRequireAdmin
    ;(prisma.printOrder as any).findUnique = originalOrderFindUnique
    ;(prisma.printOrder as any).update = originalOrderUpdate
    route.printLabOrderLinkRouteOps.fetchPrintLabSuccessfulGcodes = originalFetchSuccessful
    route.printLabOrderLinkRouteOps.maybeConsumeStockForOrder = originalConsume
    route.printLabOrderLinkRouteOps.recordAdminAuditEvent = originalAudit
  }
})

test('admin PrintLab link route does not trigger StockWorks without exact grams', async () => {
  const route = await import('../app/api/admin/orders/[orderId]/printlab-link/route')
  const originalRequireAdmin = adminRouteGuards.requireAdmin
  const originalOrderFindUnique = (prisma.printOrder as any).findUnique
  const originalOrderUpdate = (prisma.printOrder as any).update
  const originalFetchSuccessful = route.printLabOrderLinkRouteOps.fetchPrintLabSuccessfulGcodes
  const originalConsume = route.printLabOrderLinkRouteOps.maybeConsumeStockForOrder
  const originalAudit = route.printLabOrderLinkRouteOps.recordAdminAuditEvent
  let consumeCallCount = 0

  adminRouteGuards.requireAdmin = async () => 'admin_1'
  ;(prisma.printOrder as any).findUnique = async () => ({
    id: 'order_123',
    status: 'queued',
    metadata: {},
  }) as any
  ;(prisma.printOrder as any).update = async () => ({ id: 'order_123' }) as any
  route.printLabOrderLinkRouteOps.fetchPrintLabSuccessfulGcodes = async () => [
    { id: 'gcode_2', printer_name: 'P1S', completed_at: '2026-05-12T15:00:00.000Z' },
  ] as any
  route.printLabOrderLinkRouteOps.maybeConsumeStockForOrder = async () => {
    consumeCallCount += 1
    return { ok: true, movements: 1 } as any
  }
  route.printLabOrderLinkRouteOps.recordAdminAuditEvent = async () => undefined

  try {
    const res = await route.POST(buildRequest({ mode: 'successful_gcode', id: 'gcode_2' }), routeContext)

    assert.equal(res.status, 200)
    const payload = await res.json()
    assert.equal(payload.ok, true)
    assert.equal(payload.stockworks.ok, false)
    assert.match(payload.stockworks.warning, /exact material grams/)
    assert.equal(consumeCallCount, 0)
  } finally {
    adminRouteGuards.requireAdmin = originalRequireAdmin
    ;(prisma.printOrder as any).findUnique = originalOrderFindUnique
    ;(prisma.printOrder as any).update = originalOrderUpdate
    route.printLabOrderLinkRouteOps.fetchPrintLabSuccessfulGcodes = originalFetchSuccessful
    route.printLabOrderLinkRouteOps.maybeConsumeStockForOrder = originalConsume
    route.printLabOrderLinkRouteOps.recordAdminAuditEvent = originalAudit
  }
})

test('admin PrintLab link route rejects manual links without any PrintLab id', async () => {
  const route = await import('../app/api/admin/orders/[orderId]/printlab-link/route')
  const originalRequireAdmin = adminRouteGuards.requireAdmin
  adminRouteGuards.requireAdmin = async () => 'admin_1'

  try {
    const res = await route.POST(buildRequest({
      mode: 'manual',
      manual: { status: 'completed', printerName: 'X1C' },
    }), routeContext)

    assert.equal(res.status, 400)
    const payload = await res.json()
    assert.match(payload.error, /PrintLab job ID or successful G-code ID/)
  } finally {
    adminRouteGuards.requireAdmin = originalRequireAdmin
  }
})
