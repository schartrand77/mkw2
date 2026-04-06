type OrderItemLike = {
  modelTitle?: string | null
  partName?: string | null
  quantity?: number | null
  unitPriceCents?: number | null
  totalCents?: number | null
  material?: string | null
  finish?: string | null
}

type OrderLike = {
  id: string
  orderNumber?: number | null
  status: string
  shippingMethod?: string | null
  customerName?: string | null
  customerEmail?: string | null
  subtotalCents?: number | null
  totalCents?: number | null
  currency?: string | null
  organization?: { name?: string | null } | null
  shippingAddress?: unknown
  metadata?: unknown
  items: OrderItemLike[]
}

export type ConnectorBetaId = 'shopify_draft_order' | 'shipping_manifest'

export type ConnectorBetaStatus = {
  id: ConnectorBetaId
  label: string
  summary: string
  readiness: 'beta'
  eligible: boolean
  orderId: string | null
  orderNumber: number | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function formatOrderRef(order: Pick<OrderLike, 'orderNumber' | 'id'>) {
  return order.orderNumber ? `MW-${String(order.orderNumber).padStart(5, '0')}` : order.id
}

function parseShippingAddress(raw: unknown) {
  const record = asRecord(raw)
  if (!record) return null
  return {
    name: typeof record.name === 'string' ? record.name : null,
    line1: typeof record.line1 === 'string' ? record.line1 : null,
    line2: typeof record.line2 === 'string' ? record.line2 : null,
    city: typeof record.city === 'string' ? record.city : null,
    state: typeof record.state === 'string' ? record.state : null,
    postalCode: typeof record.postalCode === 'string' ? record.postalCode : null,
    country: typeof record.country === 'string' ? record.country : null,
  }
}

function parseMetadata(raw: unknown) {
  return asRecord(raw) || {}
}

export function buildShopifyDraftOrderPayload(order: OrderLike) {
  const metadata = parseMetadata(order.metadata)
  const shippingAddress = parseShippingAddress(order.shippingAddress)
  const tags = [
    'makerworks',
    order.organization?.name ? `org:${order.organization.name}` : null,
    typeof metadata.departmentCode === 'string' ? `department:${metadata.departmentCode}` : null,
    typeof metadata.projectCode === 'string' ? `project:${metadata.projectCode}` : null,
  ].filter(Boolean)

  return {
    draft_order: {
      note: `Exported from MakerWorks ${formatOrderRef(order)}`,
      email: order.customerEmail || undefined,
      currency: (order.currency || 'USD').toUpperCase(),
      tags: tags.join(', '),
      line_items: order.items.map((item) => ({
        title: item.partName || item.modelTitle || 'MakerWorks item',
        quantity: Math.max(1, item.quantity || 1),
        original_unit_price: Number(((item.unitPriceCents || 0) / 100).toFixed(2)),
        sku: [item.material, item.finish].filter(Boolean).join('-') || undefined,
        properties: [
          item.material ? { name: 'material', value: item.material } : null,
          item.finish ? { name: 'finish', value: item.finish } : null,
          { name: 'makerworks_order', value: formatOrderRef(order) },
        ].filter((entry): entry is { name: string; value: string } => Boolean(entry)),
      })),
      shipping_address: shippingAddress ? {
        name: shippingAddress.name || order.customerName || undefined,
        address1: shippingAddress.line1 || undefined,
        address2: shippingAddress.line2 || undefined,
        city: shippingAddress.city || undefined,
        province: shippingAddress.state || undefined,
        zip: shippingAddress.postalCode || undefined,
        country: shippingAddress.country || undefined,
      } : undefined,
      custom_attributes: [
        { key: 'makerworks_order_id', value: order.id },
        { key: 'makerworks_order_number', value: formatOrderRef(order) },
        typeof metadata.projectCode === 'string' ? { key: 'project_code', value: metadata.projectCode } : null,
        typeof metadata.departmentCode === 'string' ? { key: 'department_code', value: metadata.departmentCode } : null,
      ].filter((entry): entry is { key: string; value: string } => Boolean(entry)),
    },
  }
}

export function buildShippingManifestPayload(order: OrderLike) {
  const metadata = parseMetadata(order.metadata)
  const shippingInfo = asRecord(metadata.shippingInfo)
  const shippingAddress = parseShippingAddress(order.shippingAddress)

  return {
    shipment: {
      external_order_id: order.id,
      reference: formatOrderRef(order),
      status: order.status,
      recipient: {
        name: shippingAddress?.name || order.customerName || 'Unknown recipient',
        email: order.customerEmail || undefined,
        address1: shippingAddress?.line1 || undefined,
        address2: shippingAddress?.line2 || undefined,
        city: shippingAddress?.city || undefined,
        state: shippingAddress?.state || undefined,
        postalCode: shippingAddress?.postalCode || undefined,
        country: shippingAddress?.country || undefined,
      },
      carrier: typeof shippingInfo?.carrier === 'string' ? shippingInfo.carrier : undefined,
      service: typeof shippingInfo?.service === 'string' ? shippingInfo.service : undefined,
      trackingNumber: typeof shippingInfo?.trackingNumber === 'string' ? shippingInfo.trackingNumber : undefined,
      trackingUrl: typeof shippingInfo?.trackingUrl === 'string' ? shippingInfo.trackingUrl : undefined,
      labelUrl: typeof shippingInfo?.labelUrl === 'string' ? shippingInfo.labelUrl : undefined,
      shippedAt: typeof shippingInfo?.shippedAt === 'string' ? shippingInfo.shippedAt : undefined,
      items: order.items.map((item) => ({
        description: item.partName || item.modelTitle || 'MakerWorks item',
        quantity: Math.max(1, item.quantity || 1),
        declaredValue: Number((((item.totalCents || 0) / 100)).toFixed(2)),
        material: item.material || undefined,
      })),
    },
  }
}

export function getConnectorBetaStatuses(args: {
  orders: OrderLike[]
}) {
  const latestShopifyOrder = args.orders.find((order) => order.items.length > 0) || null
  const latestShippingOrder = args.orders.find((order) => (order.shippingMethod || '').toLowerCase() === 'ship') || null

  return [
    {
      id: 'shopify_draft_order',
      label: 'Shopify Draft Order Beta',
      summary: 'Transforms MakerWorks orders into a draft-order payload for commerce sync and operator review.',
      readiness: 'beta',
      eligible: Boolean(latestShopifyOrder),
      orderId: latestShopifyOrder?.id || null,
      orderNumber: latestShopifyOrder?.orderNumber || null,
    },
    {
      id: 'shipping_manifest',
      label: 'Shipping Manifest Beta',
      summary: 'Transforms shipped orders into a carrier-ready shipment manifest payload with tracking metadata.',
      readiness: 'beta',
      eligible: Boolean(latestShippingOrder),
      orderId: latestShippingOrder?.id || null,
      orderNumber: latestShippingOrder?.orderNumber || null,
    },
  ] satisfies ConnectorBetaStatus[]
}
