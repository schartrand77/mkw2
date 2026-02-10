import { prisma } from '@/lib/db'

type JsonRecord = Record<string, unknown>

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as JsonRecord
}

export function extractPaymentIntentId(metadata: unknown): string | null {
  const record = asRecord(metadata)
  if (!record) return null
  const raw = record.paymentIntentId
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null
}

export function extractJobFormId(metadata: unknown): string | null {
  const record = asRecord(metadata)
  if (!record) return null
  const raw = record.jobFormId
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null
}

export function extractOrderId(metadata: unknown): string | null {
  const record = asRecord(metadata)
  if (!record) return null
  const raw = record.orderId
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null
}

export async function findLinkedJobForOrder(orderId: string, metadata?: unknown) {
  const paymentIntentId = extractPaymentIntentId(metadata)
  const jobFormId = extractJobFormId(metadata)
  const whereOr: any[] = [{ metadata: { path: ['orderId'], equals: orderId } }]
  if (paymentIntentId) whereOr.push({ paymentIntentId })
  if (jobFormId) whereOr.push({ id: jobFormId })
  return prisma.jobForm.findFirst({
    where: { OR: whereOr },
    orderBy: { createdAt: 'desc' },
    select: { id: true, paymentIntentId: true, fulfillmentStatus: true },
  })
}

export async function findLinkedOrderForJob(params: { paymentIntentId: string; jobFormId?: string; metadata?: unknown }) {
  const metadataOrderId = extractOrderId(params.metadata)
  const whereOr: any[] = [{ metadata: { path: ['paymentIntentId'], equals: params.paymentIntentId } }]
  if (params.jobFormId) whereOr.push({ metadata: { path: ['jobFormId'], equals: params.jobFormId } })
  if (metadataOrderId) whereOr.push({ id: metadataOrderId })
  return prisma.printOrder.findFirst({
    where: { OR: whereOr },
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true },
  })
}
