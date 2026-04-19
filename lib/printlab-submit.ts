import type { PrintLabMakerWorksSubmitPayload } from '@/lib/printlab'

type OrderItemForPrintLab = {
  id: string
  modelId?: string | null
  modelTitle: string
  material: string
  colors?: unknown
  quantity: number
  configuration?: unknown
}

type OrderForPrintLab = {
  id: string
  orderNumber?: number | null
  paymentMethod?: string | null
  paymentStatus?: string | null
  shippingMethod?: string | null
  customerEmail?: string | null
  items: OrderItemForPrintLab[]
}

type LinkedJobForPrintLab = {
  id?: string | null
  paymentIntentId?: string | null
}

function orderLabel(orderNumber?: number | null) {
  return orderNumber && orderNumber > 0 ? `MW-${orderNumber.toString().padStart(5, '0')}` : null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function normalizeColors(colors: unknown) {
  return Array.isArray(colors)
    ? colors.map((color) => String(color || '').trim()).filter(Boolean)
    : []
}

function sourceJobId(order: OrderForPrintLab, linkedJob?: LinkedJobForPrintLab | null) {
  return linkedJob?.id || linkedJob?.paymentIntentId || `order:${order.id}`
}

export function buildPrintLabSubmitPayloads(
  order: OrderForPrintLab,
  linkedJob?: LinkedJobForPrintLab | null,
): PrintLabMakerWorksSubmitPayload[] {
  const label = orderLabel(order.orderNumber)
  const jobId = sourceJobId(order, linkedJob)

  return order.items
    .filter((item) => typeof item.modelId === 'string' && item.modelId.trim().length > 0)
    .map((item) => {
      const configuration = asRecord(item.configuration)
      const colors = normalizeColors(item.colors)
      return {
        model_id: item.modelId!.trim(),
        idempotency_key: `makerworks-order:${order.id}:item:${item.id}`,
        source_job_id: jobId,
        source_order_id: order.id,
        route_only: true,
        metadata: {
          source: 'makerworks_admin',
          order_id: order.id,
          order_number: order.orderNumber ?? null,
          order_label: label,
          item_id: item.id,
          model_title: item.modelTitle,
          quantity: item.quantity,
          material: item.material,
          colors,
          payment_method: order.paymentMethod ?? null,
          payment_status: order.paymentStatus ?? null,
          shipping_method: order.shippingMethod ?? null,
          storage_url: typeof configuration?.storageUrl === 'string' ? configuration.storageUrl : null,
          storage_path: typeof configuration?.storagePath === 'string' ? configuration.storagePath : null,
        },
      }
    })
}

export function shouldAutoSubmitOrderToPrintLab(order: OrderForPrintLab & { status?: string | null }) {
  if (order.status !== 'queued') return false
  return buildPrintLabSubmitPayloads(order).length > 0
}
