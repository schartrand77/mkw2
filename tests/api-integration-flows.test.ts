import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server'

import { POST as checkoutPost } from '../app/api/checkout/route'
import { POST as quotePost } from '../app/api/models/[id]/quote/route'
import { POST as loginPost } from '../app/api/login/route'
import { POST as registerPost } from '../app/api/register/route'
import { POST as customerOrderMessagePost } from '../app/api/customer/orders/[orderId]/messages/route'
import { PATCH as updateJobPatch } from '../app/api/jobs/[paymentIntentId]/route'
import { prisma } from '../lib/db'

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

test('quote returns 400 for an invalid quote payload contract', async () => {
  const req = jsonRequest('http://localhost/api/models/model_1/quote', {
    qty: 0,
    colors: ['#ffffff'],
  })
  const res = await quotePost(req, {
    params: Promise.resolve({ id: 'model_1' }),
  })
  assert.equal(res.status, 400)
  const payload = await res.json()
  assert.equal(payload.error, 'Invalid quote payload')
})

test('quote returns 404 when the requested model does not exist', async () => {
  const originalModelFindUnique = (prisma.model as any).findUnique
  ;(prisma.model as any).findUnique = async () => null

  const req = jsonRequest('http://localhost/api/models/missing/quote', {
    qty: 1,
    colors: ['#ffffff'],
  })
  try {
    const res = await quotePost(req, {
      params: Promise.resolve({ id: 'missing' }),
    })
    assert.equal(res.status, 404)
    const payload = await res.json()
    assert.equal(payload.error, 'Model not found')
  } finally {
    ;(prisma.model as any).findUnique = originalModelFindUnique
  }
})

test('quote enforces model color-slot limits', async () => {
  const originalModelFindUnique = (prisma.model as any).findUnique
  const originalSiteConfigFindUnique = (prisma.siteConfig as any).findUnique
  ;(prisma.model as any).findUnique = async () => ({
    id: 'model_color_limit',
    title: 'Panel',
    material: 'PLA',
    volumeMm3: 1000,
    sizeXmm: 10,
    sizeYmm: 10,
    sizeZmm: 10,
    salePriceUsd: 5,
    flatRatePricing: false,
    supportRatio: 0.05,
    colorSlotCount: 1,
    allowedColors: ['#ffffff', '#000000'],
  })
  ;(prisma.siteConfig as any).findUnique = async () => ({ id: 'main' })

  const req = jsonRequest('http://localhost/api/models/model_color_limit/quote', {
    qty: 1,
    colors: ['#ffffff', '#000000'],
  })
  try {
    const res = await quotePost(req, {
      params: Promise.resolve({ id: 'model_color_limit' }),
    })
    assert.equal(res.status, 400)
    const payload = await res.json()
    assert.equal(payload.error, 'This model allows up to 1 color slots.')
  } finally {
    ;(prisma.model as any).findUnique = originalModelFindUnique
    ;(prisma.siteConfig as any).findUnique = originalSiteConfigFindUnique
  }
})

test('checkout returns a stable preview payload for quote-based carts', async () => {
  const originalUserFindUnique = (prisma.user as any).findUnique
  const originalModelFindMany = (prisma.model as any).findMany
  const originalSiteConfigFindUnique = (prisma.siteConfig as any).findUnique
  const originalModelPartFindMany = (prisma.modelPart as any).findMany
  const originalPrinterFindMany = (prisma.printer as any).findMany
  const originalJobFormFindMany = (prisma.jobForm as any).findMany
  const originalPrintOrderFindMany = (prisma.printOrder as any).findMany

  ;(prisma.user as any).findUnique = async () => null
  ;(prisma.model as any).findMany = async () => [
    {
      id: 'model_preview_1',
      title: 'Preview Bracket',
      priceUsd: 18,
      effectivePriceUsd: 18,
      salePriceUsd: 18,
      disableCustomerDiscounts: false,
      flatRatePricing: false,
      volumeMm3: 12000,
      material: 'PLA',
      sizeXmm: 100,
      sizeYmm: 50,
      sizeZmm: 30,
      supportRatio: 0.08,
      printabilityScore: 0.91,
      failureRiskScore: 0.06,
      orientationSuggestion: 'Lay flat',
      supportLikelihood: 'low',
      colorSlotCount: 2,
      allowedColors: ['#ffffff', '#000000'],
      filePath: '/models/preview-bracket.3mf',
      viewerFilePath: '/models/preview-bracket.3mf',
      _count: { parts: 0 },
    },
  ]
  ;(prisma.siteConfig as any).findUnique = async () => ({
    id: 'main',
    minimumPriceUsd: 1,
    minimumOrderSubtotalUsd: null,
  })
  ;(prisma.modelPart as any).findMany = async () => []
  ;(prisma.printer as any).findMany = async () => [
    { id: 'printer_preview_1', name: 'X1C', active: true, status: 'available' },
  ]
  ;(prisma.jobForm as any).findMany = async () => []
  ;(prisma.printOrder as any).findMany = async () => []

  const req = jsonRequest('http://localhost/api/checkout', {
    paymentMethod: 'quote',
    items: [
      {
        modelId: 'model_preview_1',
        qty: 2,
        colors: ['#ffffff'],
        material: 'PLA',
      },
    ],
    shipping: { method: 'pickup' },
  })

  try {
    const res = await checkoutPost(req, {} as any)
    assert.equal(res.status, 200)
    const payload = await res.json()
    assert.equal(payload.committed, false)
    assert.equal(payload.paymentMethod, 'quote')
    assert.match(payload.paymentIntentId, /^quote_preview_/)
    assert.equal(payload.lineItems.length, 1)
    assert.equal(payload.lineItems[0].modelId, 'model_preview_1')
    assert.equal(payload.lineItems[0].qty, 2)
    assert.equal(payload.shipping.method, 'pickup')
    assert.equal(payload.printLabSubmission, null)
    assert.ok(payload.amount > 0)
    assert.ok(payload.estimatedTotal > 0)
  } finally {
    ;(prisma.user as any).findUnique = originalUserFindUnique
    ;(prisma.model as any).findMany = originalModelFindMany
    ;(prisma.siteConfig as any).findUnique = originalSiteConfigFindUnique
    ;(prisma.modelPart as any).findMany = originalModelPartFindMany
    ;(prisma.printer as any).findMany = originalPrinterFindMany
    ;(prisma.jobForm as any).findMany = originalJobFormFindMany
    ;(prisma.printOrder as any).findMany = originalPrintOrderFindMany
  }
})

test('checkout returns 404 when a requested model is unavailable', async () => {
  const originalUserFindUnique = (prisma.user as any).findUnique
  const originalModelFindMany = (prisma.model as any).findMany
  const originalSiteConfigFindUnique = (prisma.siteConfig as any).findUnique

  ;(prisma.user as any).findUnique = async () => null
  ;(prisma.model as any).findMany = async () => []
  ;(prisma.siteConfig as any).findUnique = async () => ({ id: 'main' })

  const req = jsonRequest('http://localhost/api/checkout', {
    paymentMethod: 'quote',
    items: [
      {
        modelId: 'missing_model',
        qty: 1,
        colors: ['#ffffff'],
      },
    ],
    shipping: { method: 'pickup' },
  })

  try {
    const res = await checkoutPost(req, {} as any)
    assert.equal(res.status, 404)
    const payload = await res.json()
    assert.equal(payload.error, 'One or more models are unavailable')
  } finally {
    ;(prisma.user as any).findUnique = originalUserFindUnique
    ;(prisma.model as any).findMany = originalModelFindMany
    ;(prisma.siteConfig as any).findUnique = originalSiteConfigFindUnique
  }
})

test('checkout finalize requires paymentIntentId for card payments', async () => {
  const envSnapshot = {
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  }
  process.env.STRIPE_SECRET_KEY = 'sk_test_contract'
  const originalUserFindUnique = (prisma.user as any).findUnique
  const originalModelFindMany = (prisma.model as any).findMany
  const originalSiteConfigFindUnique = (prisma.siteConfig as any).findUnique
  const originalModelPartFindMany = (prisma.modelPart as any).findMany
  const originalPrinterFindMany = (prisma.printer as any).findMany
  const originalJobFormFindMany = (prisma.jobForm as any).findMany
  const originalPrintOrderFindMany = (prisma.printOrder as any).findMany

  ;(prisma.user as any).findUnique = async () => null
  ;(prisma.model as any).findMany = async () => [
    {
      id: 'model_card_1',
      title: 'Card Bracket',
      priceUsd: 22,
      effectivePriceUsd: 22,
      salePriceUsd: 22,
      disableCustomerDiscounts: false,
      flatRatePricing: false,
      volumeMm3: 12000,
      material: 'PLA',
      sizeXmm: 80,
      sizeYmm: 40,
      sizeZmm: 20,
      supportRatio: 0.05,
      printabilityScore: 0.95,
      failureRiskScore: 0.03,
      orientationSuggestion: 'Lay flat',
      supportLikelihood: 'low',
      colorSlotCount: 2,
      allowedColors: ['#ffffff'],
      filePath: '/models/card-bracket.3mf',
      viewerFilePath: '/models/card-bracket.3mf',
      _count: { parts: 0 },
    },
  ]
  ;(prisma.siteConfig as any).findUnique = async () => ({
    id: 'main',
    minimumPriceUsd: 1,
    minimumOrderSubtotalUsd: null,
  })
  ;(prisma.modelPart as any).findMany = async () => []
  ;(prisma.printer as any).findMany = async () => [
    { id: 'printer_card_1', name: 'A1', active: true, status: 'available' },
  ]
  ;(prisma.jobForm as any).findMany = async () => []
  ;(prisma.printOrder as any).findMany = async () => []

  const req = jsonRequest('http://localhost/api/checkout', {
    commit: true,
    paymentMethod: 'card',
    items: [
      {
        modelId: 'model_card_1',
        qty: 1,
        colors: ['#ffffff'],
        material: 'PLA',
      },
    ],
    shipping: { method: 'pickup' },
  })

  try {
    const res = await checkoutPost(req, {} as any)
    assert.equal(res.status, 400)
    const payload = await res.json()
    assert.equal(payload.error, 'paymentIntentId is required to finalize checkout.')
  } finally {
    for (const [key, value] of Object.entries(envSnapshot)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    ;(prisma.user as any).findUnique = originalUserFindUnique
    ;(prisma.model as any).findMany = originalModelFindMany
    ;(prisma.siteConfig as any).findUnique = originalSiteConfigFindUnique
    ;(prisma.modelPart as any).findMany = originalModelPartFindMany
    ;(prisma.printer as any).findMany = originalPrinterFindMany
    ;(prisma.jobForm as any).findMany = originalJobFormFindMany
    ;(prisma.printOrder as any).findMany = originalPrintOrderFindMany
  }
})

test('login returns 400 for invalid payload', async () => {
  const req = jsonRequest('http://localhost/api/login', {
    email: 'not-an-email',
    password: '123',
  })
  const res = await loginPost(req)
  assert.equal(res.status, 400)
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
