import { prisma } from '@/lib/db'
import { findLinkedJobForOrder } from '@/lib/orderworks-link'
import { submitPrintLabMakerWorksJob } from '@/lib/printlab'
import { buildPrintLabSubmitPayloads, shouldAutoSubmitOrderToPrintLab } from '@/lib/printlab-submit'

type SubmitOptions = {
  actor: string
  adminId?: string | null
  throwOnFailure?: boolean
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err || 'PrintLab submission failed')
}

function jsonString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export async function submitOrderToPrintLab(orderId: string, options: SubmitOptions) {
  const order = await prisma.printOrder.findUnique({
    where: { id: orderId },
    include: { items: true },
  })
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 })
  if (!shouldAutoSubmitOrderToPrintLab(order)) {
    throw Object.assign(new Error('Order is not ready for PrintLab submission.'), { status: 400 })
  }

  const linkedJob = await findLinkedJobForOrder(order.id, order.metadata)
  const payloads = buildPrintLabSubmitPayloads(order, linkedJob)
  const submitted: any[] = []
  const errors: Array<{ itemId: string | null; message: string }> = []

  for (const payload of payloads) {
    try {
      submitted.push(await submitPrintLabMakerWorksJob(payload))
    } catch (err) {
      errors.push({
        itemId: jsonString(payload.metadata?.item_id),
        message: errorMessage(err),
      })
    }
  }

  const now = new Date().toISOString()
  const current = await prisma.printOrder.findUnique({
    where: { id: order.id },
    select: { metadata: true },
  })
  const priorMetadata = asRecord(current?.metadata)
  const priorSubmissions = Array.isArray(priorMetadata.printLabSubmissions) ? priorMetadata.printLabSubmissions : []
  const submissionSummary = submitted.map((job: any, index) => ({
    at: now,
    actor: options.actor,
    adminId: options.adminId ?? null,
    itemId: jsonString(payloads[index]?.metadata?.item_id),
    idempotencyKey: payloads[index]?.idempotency_key ?? null,
    printLabJobId: job?.id ?? null,
    status: job?.status ?? null,
    printerId: job?.printer_id ?? null,
    printerName: job?.printer_name ?? null,
    queueItemId: job?.queue_item_id ?? null,
  }))
  const failureSummary = errors.map((entry) => ({
    at: now,
    actor: options.actor,
    adminId: options.adminId ?? null,
    itemId: entry.itemId,
    status: 'failed',
    error: entry.message,
  }))

  await prisma.printOrder.update({
    where: { id: order.id },
    data: {
      metadata: {
        ...priorMetadata,
        printLabSubmissions: [...priorSubmissions, ...submissionSummary, ...failureSummary],
        lastPrintLabSubmission: [...submissionSummary, ...failureSummary].at(-1) ?? null,
      },
    },
  })

  if (errors.length > 0 && options.throwOnFailure) {
    const message = errors.map((entry) => entry.message).join('; ')
    throw Object.assign(new Error(message), { status: 400, submitted, errors })
  }

  return { ok: errors.length === 0, submitted, errors }
}

export async function autoSubmitOrderToPrintLab(orderId: string, actor: string) {
  try {
    return await submitOrderToPrintLab(orderId, { actor, throwOnFailure: false })
  } catch (err) {
    console.error('PrintLab auto-submit failed:', err)
    return { ok: false, submitted: [], errors: [{ message: errorMessage(err) }] }
  }
}
