import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server'

test('customer orders list API requires authentication', async () => {
  const route = await import('../app/api/customer/orders/route')
  const res = await route.GET(new NextRequest('http://localhost/api/customer/orders'))

  assert.equal(res.status, 401)
})

test('customer order detail API requires authentication', async () => {
  const route = await import('../app/api/customer/orders/[orderId]/route')
  const res = await route.GET(new NextRequest('http://localhost/api/customer/orders/order_1'), {
    params: Promise.resolve({ orderId: 'order_1' }),
  } as any)

  assert.equal(res.status, 401)
})

test('customer workspaces list API requires authentication', async () => {
  const route = await import('../app/api/customer/workspaces/route')
  const res = await route.GET(new NextRequest('http://localhost/api/customer/workspaces'))

  assert.equal(res.status, 401)
})

test('customer workspace detail API requires authentication', async () => {
  const route = await import('../app/api/customer/workspaces/[organizationId]/[projectCode]/route')
  const res = await route.GET(new NextRequest('http://localhost/api/customer/workspaces/org_1/project-alpha'), {
    params: Promise.resolve({ organizationId: 'org_1', projectCode: 'project-alpha' }),
  } as any)

  assert.equal(res.status, 401)
})
