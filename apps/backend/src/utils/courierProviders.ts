export const INTEGRATED_SERVICE_PROVIDERS = ['deliveryone', 'delhivery'] as const

export type IntegratedServiceProvider = (typeof INTEGRATED_SERVICE_PROVIDERS)[number]

export const VISIBLE_SERVICE_PROVIDERS = ['deliveryone'] as const

export type VisibleServiceProvider = (typeof VISIBLE_SERVICE_PROVIDERS)[number]

export const SERVICE_PROVIDER_LABELS: Record<string, string> = {
  delhivery: 'Delhivery',
  deliveryone: 'Delhivery',
  ekart: 'Ekart',
  xpressbees: 'Xpressbees',
}

const SERVICE_PROVIDER_ALIASES: Record<string, string> = {
  delhivery: 'delhivery',
  deliveryone: 'deliveryone',
  delivery1: 'deliveryone',
  delhiveryone: 'deliveryone',
  ekart: 'ekart',
  ekartlogistics: 'ekart',
  xpressbees: 'xpressbees',
  expressbees: 'xpressbees',
}

const compactProviderKey = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')

export const normalizeServiceProviderKey = (value: unknown): string => {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase()
  if (!raw) return ''

  return SERVICE_PROVIDER_ALIASES[compactProviderKey(raw)] || raw
}

export const isIntegratedServiceProvider = (
  value: unknown,
): value is IntegratedServiceProvider =>
  INTEGRATED_SERVICE_PROVIDERS.includes(
    normalizeServiceProviderKey(value) as IntegratedServiceProvider,
  )

export const isVisibleServiceProvider = (
  value: unknown,
): value is VisibleServiceProvider =>
  VISIBLE_SERVICE_PROVIDERS.includes(
    normalizeServiceProviderKey(value) as VisibleServiceProvider,
  )

export const getServiceProviderLabel = (value: unknown) => {
  const normalized = normalizeServiceProviderKey(value) as IntegratedServiceProvider
  return SERVICE_PROVIDER_LABELS[normalized] || String(value || '').trim()
}

export const supportedServiceProviderList = () => INTEGRATED_SERVICE_PROVIDERS.join(', ')

export const visibleServiceProviderList = () => VISIBLE_SERVICE_PROVIDERS.join(', ')
