import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server'

import { adminRouteGuards } from '../app/api/admin/_utils'
import { prisma } from '../lib/db'
import { stripePaymentAdminOps } from '../lib/stripe-payments'

function buildRequest(url: string, body: unknown) {
  return new NextRequest(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

test('admin stripe attach route rejects invalid payment intent ids', async () => {
  const { POST } = await import('../app/api/admin/orders/[orderId]/stripe-attach/route')
  const originalRequireAdmin = adminRouteGuards.requireAdmin
  adminRouteGuards.requireAdmin = async () => 'admin_1'

  try {
    const res = await POST(buildRequest('http://localhost/api/admin/orders/order_123/stripe-attach', {
      paymentIntentId: 'bad_123',
    }), {
      params: Promise.resolve({ orderId: 'order_123' }),
    } as any)

    assert.equal(res.status, 400)
    const payload = await res.json()
    assert.equal(payload.error, 'A valid Stripe PaymentIntent ID is required.')
  } finally {
    adminRouteGuards.requireAdmin = originalRequireAdmin
  }
})

test('admin stripe attach route rejects payment intents already linked to another order', async () => {
  const { POST } = await import('../app/api/admin/orders/[orderId]/stripe-attach/route')
  const originalRequireAdmin = adminRouteGuards.requireAdmin
  const originalSync = stripePaymentAdminOps.syncStripePaymentIntent
  const originalOrderFindUnique = (prisma.printOrder as any).findUnique
  const originalOrderFindFirst = (prisma.printOrder as any).findFirst
  let syncCallCount = 0

  adminRouteGuards.requireAdmin = async () => 'admin_1'
  stripePaymentAdminOps.syncStripePaymentIntent = async () => {
    syncCallCount += 1
    return {
      paymentStatus: 'paid',
      updatedOrders: 1,
    } as any
  }
  ;(prisma.printOrder as any).findUnique = async ({ where }: any) => {
    if (where?.id === 'order_123') {
      return { id: 'order_123', metadata: { cartItems: [] } }
    }
    return { id: 'order_999' }
  }
  ;(prisma.printOrder as any).findFirst = async () => ({ id: 'order_999' }) as any

  try {
    const res = await POST(buildRequest('http://localhost/api/admin/orders/order_123/stripe-attach', {
      paymentIntentId: 'pi_existing123',
    }), {
      params: Promise.resolve({ orderId: 'order_123' }),
    } as any)

    assert.equal(res.status, 409)
    const payload = await res.json()
    assert.equal(payload.error, 'That Stripe PaymentIntent is already linked to another order.')
    assert.equal(syncCallCount, 0)
  } finally {
    adminRouteGuards.requireAdmin = originalRequireAdmin
    stripePaymentAdminOps.syncStripePaymentIntent = originalSync
    ;(prisma.printOrder as any).findUnique = originalOrderFindUnique
    ;(prisma.printOrder as any).findFirst = originalOrderFindFirst
  }
})

test('admin stripe attach route stores the payment intent and syncs Stripe metadata', async () => {
  const { POST } = await import('../app/api/admin/orders/[orderId]/stripe-attach/route')
  const originalRequireAdmin = adminRouteGuards.requireAdmin
  const originalSync = stripePaymentAdminOps.syncStripePaymentIntent
  const originalOrderFindUnique = (prisma.printOrder as any).findUnique
  const originalOrderFindFirst = (prisma.printOrder as any).findFirst
  const originalOrderUpdate = (prisma.printOrder as any).update
  let updateArgs: any = null
  let syncArgs: any[] | null = null

  adminRouteGuards.requireAdmin = async () => 'admin_1'
  stripePaymentAdminOps.syncStripePaymentIntent = async (...args: any[]) => {
    syncArgs = args
    return {
      paymentStatus: 'paid',
      updatedOrders: 1,
    } as any
  }
  ;(prisma.printOrder as any).findUnique = async () => ({
    id: 'order_123',
    metadata: { cartItems: [{ modelId: 'model_1' }], stripe: { chargeId: 'ch_old' } },
  }) as any
  ;(prisma.printOrder as any).findFirst = async () => null as any
  ;(prisma.printOrder as any).update = async (args: any) => {
    updateArgs = args
    return { id: 'order_123', stripePaymentIntentId: args.data.stripePaymentIntentId } as any
  }

  try {
    const res = await POST(buildRequest('http://localhost/api/admin/orders/order_123/stripe-attach', {
      paymentIntentId: 'pi_3TOcQ9KDk5eLYEvN1CcNe2UG',
    }), {
      params: Promise.resolve({ orderId: 'order_123' }),
    } as any)

    assert.equal(res.status, 200)
    const payload = await res.json()
    assert.equal(payload.ok, true)
    assert.equal(payload.paymentIntentId, 'pi_3TOcQ9KDk5eLYEvN1CcNe2UG')
    assert.equal(payload.paymentStatus, 'paid')
    assert.equal(updateArgs.data.stripePaymentIntentId, 'pi_3TOcQ9KDk5eLYEvN1CcNe2UG')
    assert.equal(updateArgs.data.metadata.stripe.paymentIntentId, 'pi_3TOcQ9KDk5eLYEvN1CcNe2UG')
    assert.deepEqual(updateArgs.data.metadata.cartItems, [{ modelId: 'model_1' }])
    assert.deepEqual(syncArgs, ['pi_3TOcQ9KDk5eLYEvN1CcNe2UG', 'admin.attach'])
  } finally {
    adminRouteGuards.requireAdmin = originalRequireAdmin
    stripePaymentAdminOps.syncStripePaymentIntent = originalSync
    ;(prisma.printOrder as any).findUnique = originalOrderFindUnique
    ;(prisma.printOrder as any).findFirst = originalOrderFindFirst
    ;(prisma.printOrder as any).update = originalOrderUpdate
  }
})
