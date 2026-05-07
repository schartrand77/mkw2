import { prisma } from '@/lib/db'
import { publicFilePath, saveBuffer } from '@/lib/storage'
import { buildOrderReceiptModel } from './order-receipt-model'
import { renderOrderReceiptPdf } from './pdf-renderer'

export function receiptStoragePath(orderId: string, orderNumber: string) {
  const safeNumber = orderNumber.replace(/[^a-z0-9_-]+/gi, '-')
  return `orders/${orderId}/receipts/${safeNumber}-receipt.pdf`
}

export async function findOrderForReceipt(orderId: string) {
  return prisma.printOrder.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      organization: { select: { name: true, category: true, charitableRegistrationNumber: true } },
    },
  })
}

export async function generateAndStoreOrderReceipt(orderId: string, opts: { generatedAt?: Date } = {}) {
  const order = await findOrderForReceipt(orderId)
  if (!order) throw new Error('Order not found')

  const model = buildOrderReceiptModel({ order, generatedAt: opts.generatedAt })
  const pdf = renderOrderReceiptPdf(model)
  const relPath = receiptStoragePath(order.id, model.orderNumber)
  await saveBuffer(relPath, pdf)
  const receiptUrl = publicFilePath(relPath)
  const priorMetadata = order.metadata && typeof order.metadata === 'object' && !Array.isArray(order.metadata)
    ? order.metadata as Record<string, unknown>
    : {}

  await prisma.printOrder.update({
    where: { id: order.id },
    data: {
      receiptUrl,
      receiptStatus: 'received',
      metadata: {
        ...priorMetadata,
        receipt: {
          kind: model.kind,
          title: model.title,
          generatedAt: model.generatedAt,
          path: relPath,
          url: receiptUrl,
        },
      },
    },
  } as any)

  return { model, pdf, relPath, receiptUrl }
}

export async function generateOrderReceiptBestEffort(orderId: string, source: string) {
  try {
    return await generateAndStoreOrderReceipt(orderId)
  } catch (err) {
    console.error(`Receipt generation failed (${source}):`, err)
    return null
  }
}
