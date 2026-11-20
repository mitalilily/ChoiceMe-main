const normalizeToken = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')

const isDeliveryOneValue = (value) => {
  const normalized = normalizeToken(value)
  return (
    ['deliveryone', 'delivery1', 'delhiveryone', 'delhivery'].includes(normalized) ||
    normalized.startsWith('deliveryone') ||
    normalized.startsWith('delhiveryone') ||
    normalized.startsWith('delhiverysurface') ||
    normalized.startsWith('delhiveryexpress') ||
    normalized.startsWith('delhiveryair')
  )
}

const DELIVERY_ONE_SURFACE_ID = 99
const DELIVERY_ONE_EXPRESS_ID = 100

const getCourierValues = (courierOrName) => {
  if (typeof courierOrName === 'string') return [courierOrName]

  return [
    courierOrName?.displayName,
    courierOrName?.courier_name,
    courierOrName?.name,
    courierOrName?.service_provider,
    courierOrName?.serviceProvider,
    courierOrName?.provider,
    courierOrName?.integration_type,
    courierOrName?.mode,
    courierOrName?.shipping_mode,
    courierOrName?.service_type,
  ].filter(Boolean)
}

const getDeliveryOneVariant = (courierOrName) => {
  const normalizedValues = getCourierValues(courierOrName).map(normalizeToken)

  if (normalizedValues.some((value) => value.includes('surface') || value.includes('ground'))) {
    return 'surface'
  }

  if (normalizedValues.some((value) => value.includes('express') || value.includes('air'))) {
    return 'express'
  }

  if (typeof courierOrName !== 'string' && courierOrName) {
    const courierId = Number(courierOrName.id ?? courierOrName.courier_id)
    if (courierId === DELIVERY_ONE_SURFACE_ID) return 'surface'
    if (courierId === DELIVERY_ONE_EXPRESS_ID) return 'express'
  }

  return ''
}

const getDeliveryOneDisplayName = (courierOrName) => {
  const variant = getDeliveryOneVariant(courierOrName)
  if (variant === 'express') return 'Delhivery Express'
  return 'Delhivery Surface'
}

export const getCourierDisplayName = (courierOrName, fallback = 'N/A') => {
  if (typeof courierOrName === 'string') {
    if (isDeliveryOneValue(courierOrName)) return getDeliveryOneDisplayName(courierOrName)
    return courierOrName || fallback
  }

  const values = getCourierValues(courierOrName)

  if (values.some(isDeliveryOneValue)) return getDeliveryOneDisplayName(courierOrName)
  return courierOrName?.displayName || courierOrName?.courier_name || courierOrName?.name || fallback
}

export const getProviderDisplayName = (provider, fallback = 'Not selected') =>
  isDeliveryOneValue(provider) ? 'Delhivery' : provider === 'shadowfax' ? 'Shadowfax' : provider || fallback
