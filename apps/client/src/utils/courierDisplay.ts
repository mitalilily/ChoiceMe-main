import { courierLogos, defaultLogo, deliveryOneLogo } from './constants'

type CourierLike =
  | string
  | null
  | undefined
  | {
      name?: string | null
      courier_name?: string | null
      id?: string | number | null
      courier_id?: string | number | null
      courierId?: string | number | null
      displayName?: string | null
      serviceProvider?: string | null
      service_provider?: string | null
      integration_type?: string | null
      provider?: string | null
      mode?: string | null
      shipping_mode?: string | null
      service_type?: string | null
    }

export const DELHIVERY_SURFACE_DISPLAY_NAME = 'Delhivery Surface'
export const DELHIVERY_EXPRESS_DISPLAY_NAME = 'Delhivery Express'
const DELIVERY_ONE_LOGO = deliveryOneLogo
const DELIVERY_ONE_SURFACE_ID = 99
const DELIVERY_ONE_EXPRESS_ID = 100

export const DELHIVERY_COURIER_FILTER_OPTIONS_BY_ID = [
  { label: DELHIVERY_SURFACE_DISPLAY_NAME, value: String(DELIVERY_ONE_SURFACE_ID) },
  { label: DELHIVERY_EXPRESS_DISPLAY_NAME, value: String(DELIVERY_ONE_EXPRESS_ID) },
]

export const DELHIVERY_COURIER_FILTER_OPTIONS_BY_NAME = [
  { label: DELHIVERY_SURFACE_DISPLAY_NAME, value: DELHIVERY_SURFACE_DISPLAY_NAME },
  { label: DELHIVERY_EXPRESS_DISPLAY_NAME, value: DELHIVERY_EXPRESS_DISPLAY_NAME },
]

// Catalog/filter visibility is independent of live shipment availability.
export const B2C_COURIER_FILTER_OPTIONS_BY_NAME = [
  ...DELHIVERY_COURIER_FILTER_OPTIONS_BY_NAME,
  { label: 'Shadowfax', value: 'Shadowfax' },
]

const normalizeToken = (value?: string | null) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')

const getCourierValues = (courier: CourierLike) => {
  if (typeof courier === 'string') return [courier]
  if (!courier) return []

  return [
    courier.displayName,
    courier.courier_name,
    courier.name,
    courier.serviceProvider,
    courier.service_provider,
    courier.integration_type,
    courier.provider,
    courier.mode,
    courier.shipping_mode,
    courier.service_type,
  ].filter(Boolean) as string[]
}

const isDeliveryOneValue = (value?: string | null) => {
  const normalized = normalizeToken(value)
  return (
    normalized === 'deliveryone' ||
    normalized === 'delivery1' ||
    normalized === 'delhiveryone' ||
    normalized === 'delhivery' ||
    normalized.startsWith('deliveryone') ||
    normalized.startsWith('delhiveryone') ||
    normalized.startsWith('delhiverysurface') ||
    normalized.startsWith('delhiveryexpress') ||
    normalized.startsWith('delhiveryair')
  )
}

export const isDelhiveryCourier = (courier: CourierLike) =>
  getCourierValues(courier).some((value) => isDeliveryOneValue(value))

const getDeliveryOneVariant = (courier: CourierLike) => {
  const values = getCourierValues(courier)
  const normalizedValues = values.map(normalizeToken)

  if (normalizedValues.some((value) => value.includes('surface') || value.includes('ground'))) {
    return 'surface'
  }

  if (normalizedValues.some((value) => value.includes('express') || value.includes('air'))) {
    return 'express'
  }

  if (typeof courier !== 'string' && courier) {
    const courierId = Number(courier.id ?? courier.courier_id ?? courier.courierId)
    if (courierId === DELIVERY_ONE_SURFACE_ID) return 'surface'
    if (courierId === DELIVERY_ONE_EXPRESS_ID) return 'express'
  }

  return ''
}

const getDeliveryOneDisplayName = (courier: CourierLike) => {
  const variant = getDeliveryOneVariant(courier)
  if (variant === 'express') return DELHIVERY_EXPRESS_DISPLAY_NAME
  return DELHIVERY_SURFACE_DISPLAY_NAME
}

export const getCourierDisplayName = (courier: CourierLike, fallback = 'Unknown Courier') => {
  const values = getCourierValues(courier)
  if (values.some(isDeliveryOneValue)) return getDeliveryOneDisplayName(courier)
  if (typeof courier === 'string') return courier || fallback
  return courier?.displayName || courier?.courier_name || courier?.name || fallback
}

export const getCourierLogo = (courier: CourierLike, fallback = defaultLogo) => {
  const values = getCourierValues(courier)
  if (values.some(isDeliveryOneValue)) {
    const displayName = getDeliveryOneDisplayName(courier)
    return courierLogos[displayName] || courierLogos.deliveryone || DELIVERY_ONE_LOGO
  }

  const normalizedValues = values.map((value) => value.toLowerCase())
  const logo = Object.entries(courierLogos || {}).find(([key]) =>
    normalizedValues.some((value) => value.includes(key.toLowerCase())),
  )?.[1]

  return logo || fallback
}
