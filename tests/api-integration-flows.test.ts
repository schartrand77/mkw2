import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server'

import { POST as checkoutPost } from '../app/api/checkout/route'
import { POST as loginPost } from '../app/api/login/route'
import { POST as registerPost } from '../app/api/register/route'
import { POST as customerOrderMessagePost } from '../app/api/customer/orders/[orderId]/messages/route'
import { PATCH as updateJobPatch } from '../app/api/jobs/[paymentIntentId]/route'
import { prisma } from '../lib/db'
import { hashPassword } from '../lib/auth'

function jsonRequest(url: string, body: unknown) {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

test('checkout rejects shipping address when required fields are missing', async () => {
  const req = jsonRequest('http://localhost/api/checkout', {
    items: [
      {
        modelId: 'model_1',
        qty: 1,
        colors: ['#ffffff'],
      },
    ],
    shipping: {
      method: 'ship',
      address: { name: 'A' },
    },
  })
  const res = await checkoutPost(req, {} as any)
  assert.equal(res.status, 400)
  const payload = await res.json()
  assert.equal(payload.error, 'Shipping address is incomplete')
})

test('checkout blocks cash payments when shipping is requested', async () => {
  const req = jsonRequest('http://localhost/api/checkout', {
    paymentMethod: 'cash',
    items: [
      {
        modelId: 'model_1',
        qty: 1,
        colors: ['#ffffff'],
      },
    ],
    shipping: {
      method: 'ship',
      address: {
        name: 'Ada',
        line1: '123 Test Street',
        city: 'Testville',
        postalCode: '12345',
        country: 'US',
      },
    },
  })
  const res = await checkoutPost(req, {} as any)
  assert.equal(res.status, 400)
  const payload = await res.json()
  assert.equal(payload.error, 'Cash payments are only available for local pickup')
})

test('login returns 400 for invalid payload', async () => {
  const req = jsonRequest('http://localhost/api/login', {
    email: 'not-an-email',
    password: '123',
  })
  const res = await loginPost(req)
  assert.equal(res.status, 400)
})

test('login failure responses do not reveal account state', async () => {
  const originalUserFindUnique = (prisma.user as any).findUnique
  const originalRateLimitFindUnique = (prisma.rateLimit as any).findUnique
  const originalRateLimitCreate = (prisma.rateLimit as any).create
  const passwordHash = await hashPassword('correct-password')
  const baseUser = {
    id: 'user_1',
    email: 'member@example.com',
    name: 'Member',
    passwordHash,
    isSuspended: false,
    emailVerified: true,
  }

  ;(prisma.rateLimit as any).findUnique = async () => null
  ;(prisma.rateLimit as any).create = async () => ({ key: 'login:test', count: 1 })

  try {
    const cases = [
      { user: null, password: 'wrong-password' },
      { user: baseUser, password: 'wrong-password' },
      { user: { ...baseUser, isSuspended: true }, password: 'correct-password' },
      { user: { ...baseUser, emailVerified: false }, password: 'correct-password' },
    ]
    const responses = []

    for (const testCase of cases) {
      ;(prisma.user as any).findUnique = async () => testCase.user
      const res = await loginPost(jsonRequest('http://localhost/api/login', {
        email: 'member@example.com',
        password: testCase.password,
      }))
      responses.push({ status: res.status, body: await res.json() })
    }

    assert.deepEqual(
      responses,
      responses.map(() => ({ status: 401, body: { error: 'Invalid email or password' } })),
    )
  } finally {
    ;(prisma.user as any).findUnique = originalUserFindUnique
    ;(prisma.rateLimit as any).findUnique = originalRateLimitFindUnique
    ;(prisma.rateLimit as any).create = originalRateLimitCreate
  }
})

test('register rejects mismatched passwords', async () => {
  const originalFindUnique = (prisma.rateLimit as any).findUnique
  const originalCreate = (prisma.rateLimit as any).create
  ;(prisma.rateLimit as any).findUnique = async () => null
  ;(prisma.rateLimit as any).create = async () => ({ key: 'register:test', count: 1 })

  const req = jsonRequest('http://localhost/api/register', {
    email: 'test@example.com',
    name: 'Test User',
    password: 'password1',
    confirmPassword: 'password2',
  })
  try {
    const res = await registerPost(req)
    assert.equal(res.status, 400)
    const payload = await res.json()
    assert.equal(payload.error, 'Passwords must match')
  } finally {
    ;(prisma.rateLimit as any).findUnique = originalFindUnique
    ;(prisma.rateLimit as any).create = originalCreate
  }
})

test('customer order messaging requires authentication', async () => {
  const req = jsonRequest('http://localhost/api/customer/orders/order_123/messages', {
    body: 'Hello from test',
  })
  const res = await customerOrderMessagePost(req, {
    params: Promise.resolve({ orderId: 'order_123' }),
  })
  assert.equal(res.status, 401)
})

test('admin order status patch requires authentication', async () => {
  const req = new Request('http://localhost/api/jobs/pi_123', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'sent' }),
  })
  const res = await updateJobPatch(req, {
    params: Promise.resolve({ paymentIntentId: 'pi_123' }),
  })
  assert.equal(res.status, 401)
})
