import type { JobForm, User } from '@prisma/client'

export type JobWithUser = JobForm & {
  user: Pick<User, 'id' | 'name' | 'email'> | null
}

export function serializeJob(job: JobWithUser) {
  return {
    id: job.id,
    paymentIntentId: job.paymentIntentId,
    userId: job.userId,
    customerEmail: job.customerEmail,
    status: job.status,
    totalCents: job.totalCents,
    currency: job.currency,
    lineItems: job.lineItems,
    shipping: job.shipping,
    metadata: job.metadata,
    webhookAttempts: job.webhookAttempts,
    lastAttemptAt: job.lastAttemptAt ? job.lastAttemptAt.toISOString() : null,
    lastError: job.lastError,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    user: job.user
      ? { id: job.user.id, name: job.user.name, email: job.user.email }
      : null,
  }
}
