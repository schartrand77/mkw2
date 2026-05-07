import type { ReceiptViewModel } from './types'

function escapePdfText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function pushPdfObject(objects: string[], body: string) {
  objects.push(body)
}

function money(cents: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100)
}

function humanPaymentMethod(value: string) {
  const key = value.trim().toLowerCase()
  if (key === 'card') return 'Card'
  if (key === 'paypal') return 'PayPal'
  if (key === 'cash') return 'Cash at pickup'
  if (key === 'invoice') return 'Invoice'
  if (key === 'po') return 'Purchase order'
  if (key === 'quote') return 'Quote request'
  return 'Payment'
}

function humanPaymentStatus(value: string) {
  const key = value.trim().toLowerCase()
  if (key === 'paid' || key === 'succeeded') return 'Paid'
  if (key === 'pending') return 'Payment pending'
  if (key === 'processing') return 'Processing'
  if (key === 'quote') return 'Awaiting quote approval'
  if (key === 'failed') return 'Payment failed'
  if (key === 'canceled' || key === 'cancelled') return 'Canceled'
  return 'Status unavailable'
}

function humanContributionType(value: string) {
  const key = value.trim().toLowerCase()
  if (key === 'donated') return 'Donated production work'
  if (key === 'discounted') return 'Discounted production work'
  return 'Paid order'
}

function date(value: string) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(value))
}

export function buildReceiptPdfLines(model: ReceiptViewModel) {
  const lines: string[] = [
    'MakerWorks',
    model.title,
    `Order: ${model.orderNumber}`,
    `Issued: ${date(model.issuedAt)}`,
    `Generated: ${date(model.generatedAt)}`,
    '',
    `Customer: ${model.customerName}${model.customerEmail ? ` <${model.customerEmail}>` : ''}`,
    ...(model.organizationName ? [`Organization: ${model.organizationName}`] : []),
    `Payment method: ${humanPaymentMethod(model.paymentMethod)}`,
    `Payment status: ${humanPaymentStatus(model.paymentStatus)}`,
    `Shipping: ${model.shippingSummary}`,
  ]
  if (model.processorReference) lines.push(`Payment reference: ${model.processorReference}`)
  if (model.purchaseOrderNumber) lines.push(`Purchase order: ${model.purchaseOrderNumber}`)
  if (model.billingEmail) lines.push(`Billing email: ${model.billingEmail}`)
  if (model.billingContact) lines.push(`Billing contact: ${model.billingContact}`)
  lines.push('', 'Items')
  for (const item of model.items) {
    lines.push(`${item.quantity}x ${item.title} - ${money(item.totalCents, model.currency)}`)
    if (item.detail) lines.push(`   ${item.detail}`)
    lines.push(`   Unit: ${money(item.unitPriceCents, model.currency)}`)
  }
  lines.push('', `Subtotal: ${money(model.subtotalCents, model.currency)}`)
  if (model.discountPercent != null && model.discountPercent > 0) lines.push(`Discount: ${model.discountPercent}%`)
  lines.push(`Total: ${money(model.totalCents, model.currency)}`)
  if (model.refundedCents > 0) lines.push(`Refunded: ${money(model.refundedCents, model.currency)}`)
  lines.push(`Amount after refunds: ${money(model.netPaidCents, model.currency)}`)
  if (model.kind === 'community_contribution') {
    lines.push('', 'Contribution')
    lines.push(`Contribution type: ${humanContributionType(model.contributionType)}`)
    lines.push(`Contributed value: ${money(model.donatedAmountCents, model.currency)}`)
    lines.push(`Estimated material cost: ${money(model.materialCostCents, model.currency)}`)
    if (model.machineTimeMinutes != null) lines.push(`Machine time: ${model.machineTimeMinutes} minutes`)
    if (model.contributionNotes) lines.push(`Notes: ${model.contributionNotes}`)
  }
  if (model.notes.length > 0) {
    lines.push('', 'References')
    for (const note of model.notes) lines.push(`${note.label}: ${note.value}`)
  }
  return lines.slice(0, 54)
}

export function renderOrderReceiptPdf(model: ReceiptViewModel) {
  const lines = buildReceiptPdfLines(model)
  const content = [
    'BT',
    '/F1 11 Tf',
    '14 TL',
    '40 800 Td',
    ...lines.map((line, index) => `${index === 0 ? '' : 'T* ' }(${escapePdfText(line)}) Tj`).map((line) => line.trim()),
    'ET',
  ].join('\n')

  const objects: string[] = []
  pushPdfObject(objects, '<< /Type /Catalog /Pages 2 0 R >>')
  pushPdfObject(objects, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>')
  pushPdfObject(objects, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>')
  pushPdfObject(objects, `<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream`)
  pushPdfObject(objects, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = [0]
  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'))
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`
  }
  const xrefOffset = Buffer.byteLength(pdf, 'utf8')
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  return Buffer.from(pdf, 'utf8')
}
