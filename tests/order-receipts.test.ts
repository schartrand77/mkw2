import assert from 'node:assert/strict'
import test from 'node:test'

import { buildOrderReceiptModel } from '../lib/receipts/order-receipt-model'
import { receiptStoragePath } from '../lib/receipts/order-receipts'
import { buildReceiptPdfLines, renderOrderReceiptPdf } from '../lib/receipts/pdf-renderer'
import { classifyReceiptDocument } from '../lib/receipts/types'

test('classifies paid card and paypal transactions as payment receipts', () => {
  assert.equal(classifyReceiptDocument({ paymentMethod: 'card', paymentStatus: 'paid', totalCents: 2500 }).kind, 'payment_receipt')
  assert.equal(classifyReceiptDocument({ paymentMethod: 'paypal', paymentStatus: 'paid', totalCents: 2500 }).kind, 'payment_receipt')
})

test('classifies deferred payment methods as acknowledgements', () => {
  assert.equal(classifyReceiptDocument({ paymentMethod: 'cash', paymentStatus: 'pending', totalCents: 2500 }).kind, 'cash_receipt')
  assert.equal(classifyReceiptDocument({ paymentMethod: 'invoice', paymentStatus: 'pending', totalCents: 2500 }).kind, 'invoice_acknowledgement')
  assert.equal(classifyReceiptDocument({ paymentMethod: 'po', paymentStatus: 'pending', totalCents: 2500 }).kind, 'purchase_order_acknowledgement')
  assert.equal(classifyReceiptDocument({ paymentMethod: 'quote', paymentStatus: 'quote', totalCents: 2500 }).kind, 'quote_request')
})

test('classifies contribution and free orders before normal payment methods', () => {
  assert.equal(classifyReceiptDocument({ paymentMethod: 'cash', paymentStatus: 'pending', totalCents: 0 }).kind, 'complimentary_receipt')
  assert.equal(classifyReceiptDocument({ paymentMethod: 'comped', paymentStatus: 'free', totalCents: 2500 }).kind, 'complimentary_receipt')
  assert.equal(classifyReceiptDocument({ paymentMethod: 'cash', paymentStatus: 'pending', totalCents: 2500, contributionType: 'donated' }).kind, 'community_contribution')
  assert.equal(classifyReceiptDocument({ paymentMethod: 'card', paymentStatus: 'paid', totalCents: 2500, contributionType: 'discounted' }).kind, 'community_contribution')
})

test('includes refunded state in payment receipt classification', () => {
  const result = classifyReceiptDocument({ paymentMethod: 'card', paymentStatus: 'paid', totalCents: 2500, refundedCents: 500 })
  assert.equal(result.kind, 'payment_receipt')
  assert.equal(result.refunded, true)
})

test('builds a receipt model with order totals, payment details, and item lines', () => {
  const model = buildOrderReceiptModel({
    order: {
      id: 'order_1',
      orderNumber: 42,
      customerName: 'Jane Buyer',
      customerEmail: 'jane@example.com',
      paymentMethod: 'po',
      paymentStatus: 'pending',
      subtotalCents: 5000,
      discountPercent: 10,
      totalCents: 4500,
      refundedCents: 0,
      currency: 'CAD',
      contributionType: 'paid',
      donatedAmountCents: null,
      materialCostCents: null,
      machineTimeMinutes: null,
      contributionNotes: null,
      shippingMethod: 'pickup',
      shippingAddress: null,
      stripePaymentIntentId: null,
      stripeChargeId: null,
      stripeInvoiceId: null,
      hostedInvoiceUrl: null,
      invoicePdfUrl: null,
      receiptUrl: null,
      notes: null,
      createdAt: new Date('2026-05-01T12:00:00Z'),
      metadata: {
        paymentDetails: {
          purchaseOrderNumber: 'PO-7788',
          billingEmail: 'ap@example.com',
          billingContact: 'Accounts Payable',
        },
      },
      organization: { name: 'Test Org' },
      items: [
        {
          modelTitle: 'Bracket',
          partName: 'Left',
          material: 'PLA',
          colors: ['Black'],
          finish: 'standard',
          infillPct: 20,
          quantity: 2,
          unitPriceCents: 2500,
          totalCents: 5000,
        },
      ],
    },
    generatedAt: new Date('2026-05-02T12:00:00Z'),
  } as any)

  assert.equal(model.orderNumber, 'MW-00042')
  assert.equal(model.title, 'Purchase Order Acknowledgement')
  assert.equal(model.customerName, 'Jane Buyer')
  assert.equal(model.organizationName, 'Test Org')
  assert.equal(model.purchaseOrderNumber, 'PO-7788')
  assert.equal(model.items[0].detail, 'Left | PLA | Black | Infill 20%')
  assert.equal(model.netPaidCents, 4500)
})

test('renders a PDF buffer for receipt models', () => {
  const pdf = renderOrderReceiptPdf({
    orderId: 'order_1',
    orderNumber: 'MW-00042',
    title: 'Payment Receipt',
    kind: 'payment_receipt',
    generatedAt: '2026-05-02T12:00:00.000Z',
    issuedAt: '2026-05-01T12:00:00.000Z',
    customerName: 'Jane Buyer',
    customerEmail: 'jane@example.com',
    organizationName: null,
    currency: 'CAD',
    subtotalCents: 5000,
    discountPercent: null,
    totalCents: 5000,
    refundedCents: 0,
    netPaidCents: 5000,
    paymentMethod: 'card',
    paymentStatus: 'paid',
    processorReference: 'pi_123',
    purchaseOrderNumber: null,
    billingEmail: null,
    billingContact: null,
    contributionType: 'paid',
    donatedAmountCents: 0,
    materialCostCents: 0,
    machineTimeMinutes: null,
    contributionNotes: null,
    shippingSummary: 'Pickup',
    items: [{ title: 'Bracket', detail: 'PLA | Black', quantity: 2, unitPriceCents: 2500, totalCents: 5000 }],
    notes: [{ label: 'Payment reference', value: 'pi_123' }],
  })
  assert.equal(pdf.subarray(0, 8).toString('utf8'), '%PDF-1.4')
  assert.ok(pdf.length > 500)
})

test('receipt PDF text model uses plain-English labels', () => {
  const model = buildOrderReceiptModel({
    order: {
      id: 'order_1',
      orderNumber: 42,
      customerName: 'Jane Buyer',
      customerEmail: 'jane@example.com',
      paymentMethod: 'card',
      paymentStatus: 'paid',
      subtotalCents: 5000,
      discountPercent: null,
      totalCents: 5000,
      refundedCents: 0,
      currency: 'CAD',
      contributionType: 'paid',
      donatedAmountCents: null,
      materialCostCents: null,
      machineTimeMinutes: null,
      contributionNotes: null,
      shippingMethod: 'pickup',
      shippingAddress: null,
      stripePaymentIntentId: 'pi_123',
      stripeChargeId: 'ch_123',
      stripeInvoiceId: null,
      hostedInvoiceUrl: null,
      invoicePdfUrl: null,
      receiptUrl: null,
      notes: null,
      createdAt: new Date('2026-05-01T12:00:00Z'),
      metadata: { paymentIntentId: 'pi_123' },
      organization: null,
      items: [],
    },
    generatedAt: new Date('2026-05-02T12:00:00Z'),
  } as any)
  const visibleText = buildReceiptPdfLines(model).join('\n')
  assert.equal(model.notes.some((note) => note.label === 'paymentIntentId'), false)
  assert.equal(model.notes.some((note) => note.label === 'stripePaymentIntentId'), false)
  assert.ok(model.notes.some((note) => note.label === 'Payment reference'))
  assert.match(visibleText, /Payment method: Card/)
  assert.match(visibleText, /Payment status: Paid/)
  assert.doesNotMatch(visibleText, /paymentIntentId|stripePaymentIntentId|receiptStatus|metadata|machineTimeMinutes/)
})

test('receipt PDF text describes comped payment without cash wording', () => {
  const lines = buildReceiptPdfLines({
    orderId: 'order_1',
    orderNumber: 'MW-00042',
    title: 'Complimentary Order Receipt',
    kind: 'complimentary_receipt',
    generatedAt: '2026-05-02T12:00:00.000Z',
    issuedAt: '2026-05-01T12:00:00.000Z',
    customerName: 'Turtles Kingston',
    customerEmail: '',
    organizationName: 'Turtles Kingston',
    currency: 'CAD',
    subtotalCents: 5000,
    discountPercent: 100,
    totalCents: 0,
    refundedCents: 0,
    netPaidCents: 0,
    paymentMethod: 'comped',
    paymentStatus: 'free',
    processorReference: null,
    purchaseOrderNumber: null,
    billingEmail: null,
    billingContact: null,
    contributionType: 'paid',
    donatedAmountCents: 0,
    materialCostCents: 0,
    machineTimeMinutes: null,
    contributionNotes: null,
    shippingSummary: 'Pickup',
    items: [],
    notes: [],
  }).join('\n')

  assert.match(lines, /Payment method: No-charge contribution/)
  assert.doesNotMatch(lines, /Cash at pickup/)
})

test('uses stable storage path for generated order receipt PDF', () => {
  assert.equal(receiptStoragePath('order_123', 'MW-00042'), 'orders/order_123/receipts/MW-00042-receipt.pdf')
})
