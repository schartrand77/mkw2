import assert from 'node:assert/strict'
import test from 'node:test'

test('customer receipt route rejects unauthenticated users', async () => {
  const { GET } = await import('../app/api/customer/orders/[orderId]/receipt/route')
  const res = await GET(new Request('http://localhost/api/customer/orders/order_1/receipt') as any, {
    params: Promise.resolve({ orderId: 'order_1' }),
  })
  assert.equal(res.status, 401)
})

test('admin receipt route rejects unauthenticated users', async () => {
  const { GET } = await import('../app/api/admin/orders/[orderId]/receipt/route')
  const res = await GET(new Request('http://localhost/api/admin/orders/order_1/receipt') as any, {
    params: Promise.resolve({ orderId: 'order_1' }),
  })
  assert.equal(res.status, 401)
})
