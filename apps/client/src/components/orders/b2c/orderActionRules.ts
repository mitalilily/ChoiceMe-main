export type B2COrderActionShape = {
  id?: string | number
  order_number?: string | null
  awb_number?: string | null
  order_status?: string | null
  integration_type?: string | null
  courier_partner?: string | null
}

const B2C_CANCELLABLE_STATUSES = new Set(['pending', 'booked', 'confirmed', 'pickup_initiated'])
const B2C_CANCELLABLE_PROVIDERS = new Set(['delhivery', 'deliveryone', 'ekart', 'xpressbees'])
const B2C_MANIFESTABLE_STATUSES = new Set([
  'pending',
  'booked',
  'shipment_created',
  'manifest_failed',
  'pickup_initiated',
  'manifest_generated',
])

export const BULK_MANIFEST_LIMIT = 5

const normalizeActionValue = (value: unknown) => String(value || '').trim().toLowerCase()

export const getB2CManifestIdentifier = (order: B2COrderActionShape) =>
  order.order_number || order.awb_number || null

export const getB2CManifestProvider = (order: B2COrderActionShape) => {
  const integrationType = normalizeActionValue(order.integration_type)
  const courierPartner = normalizeActionValue(order.courier_partner)

  if (integrationType.includes('xpressbees') || courierPartner.includes('xpressbees')) {
    return 'xpressbees'
  }

  if (integrationType.includes('ekart') || courierPartner.includes('ekart')) {
    return 'ekart'
  }

  return 'delhivery'
}

export const isB2CManifestEligible = (order: B2COrderActionShape) => {
  const status = normalizeActionValue(order.order_status)
  return Boolean(getB2CManifestIdentifier(order)) && B2C_MANIFESTABLE_STATUSES.has(status)
}

export const isB2CCancelEligible = (order: B2COrderActionShape) => {
  const status = normalizeActionValue(order.order_status)
  const provider = normalizeActionValue(order.integration_type || order.courier_partner)

  return Boolean(order.id) && B2C_CANCELLABLE_STATUSES.has(status) && B2C_CANCELLABLE_PROVIDERS.has(provider)
}
