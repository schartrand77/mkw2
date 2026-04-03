import type { JobForm, User } from '@prisma/client'
import { normalizePaymentMethod, normalizePaymentStatus } from '@/lib/orderworks-status'

export type JobWithUser = JobForm & {
  user: Pick<User, 'id' | 'name' | 'email'> | null
}

type SerializedStatus = 'pending' | 'sent'

export function serializeJob(job: JobWithUser) {
  const status: SerializedStatus = job.status === 'sent' ? 'sent' : 'pending'
  return {
    id: job.id,
    paymentIntentId: job.paymentIntentId,
    userId: job.userId,
    customerEmail: job.customerEmail,
    status,
    totalCents: job.totalCents,
    currency: job.currency,
    lineItems: job.lineItems,
    shipping: job.shipping,
    metadata: job.metadata,
    paymentMethod: normalizePaymentMethod(job.paymentMethod) ?? null,
    paymentStatus: normalizePaymentStatus(job.paymentStatus) ?? null,
    fulfillmentStatus: job.fulfillmentStatus,
    fulfilledAt: job.fulfilledAt ? job.fulfilledAt.toISOString() : null,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    user: job.user
      ? { id: job.user.id, name: job.user.name, email: job.user.email }
      : null,
  }
}
