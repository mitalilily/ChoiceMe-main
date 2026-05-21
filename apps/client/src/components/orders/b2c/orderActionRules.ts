export type B2COrderActionShape = {
  id?: string | number
  order_number?: string | null
  awb_number?: string | null
  order_status?: string | null
  pickup_status?: string | null
  integration_type?: string | null
  courier_partner?: string | null
  manifest?: string | null
}

const B2C_CANCELLABLE_STATUSES = new Set([
  'pending',
  'booked',
  'confirmed',
  'shipment_booked',
  'pickup_initiated',
  'manifest_generated',
])
const B2C_CANCELLABLE_PROVIDERS = new Set(['deliveryone'])
const B2C_MANIFESTABLE_STATUSES = new Set(['pending', 'booked', 'shipment_created'])
const B2C_CANCELLED_STATUSES = new Set(['cancelled', 'canceled', 'cancellation_requested'])

export const BULK_MANIFEST_LIMIT = 5

export const normalizeB2CActionValue = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')

const getB2CActionProvider = (order: B2COrderActionShape) => {
  const integrationType = normalizeB2CActionValue(order.integration_type)
  const courierPartner = normalizeB2CActionValue(order.courier_partner)
  const combinedProvider = `${integrationType} ${courierPartner}`.trim()

  if (
    combinedProvider.includes('deliveryone') ||
    combinedProvider.includes('delivery_one') ||
    combinedProvider.includes('delhiveryone') ||
    combinedProvider.includes('delhivery_one')
  ) {
    return 'deliveryone'
  }

  return integrationType || courierPartner
}

export const getB2CManifestIdentifier = (order: B2COrderActionShape) =>
  order.order_number || order.awb_number || null

export const getB2CManifestProvider = (order: B2COrderActionShape) => {
  return getB2CActionProvider(order) || 'deliveryone'
}

export const isB2CCancelledStatus = (status: unknown) => {
  return B2C_CANCELLED_STATUSES.has(normalizeB2CActionValue(status))
}

export const isB2CManifestEligible = (order: B2COrderActionShape) => {
  const status = normalizeB2CActionValue(order.order_status)
  const manifestReference = normalizeB2CActionValue(order.manifest)

  return (
    !manifestReference &&
    Boolean(getB2CManifestIdentifier(order)) &&
    B2C_MANIFESTABLE_STATUSES.has(status)
  )
}

export const isB2CCancelEligible = (order: B2COrderActionShape) => {
  const status = normalizeB2CActionValue(order.order_status)
  const provider = getB2CActionProvider(order)

  return (
    Boolean(order.id) &&
    !isB2CCancelledStatus(status) &&
    B2C_CANCELLABLE_STATUSES.has(status) &&
    B2C_CANCELLABLE_PROVIDERS.has(provider)
  )
}
