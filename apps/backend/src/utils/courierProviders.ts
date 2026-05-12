export const INTEGRATED_SERVICE_PROVIDERS = [
  'delhivery',
  'deliveryone',
  'ekart',
  'xpressbees',
] as const

export type IntegratedServiceProvider = (typeof INTEGRATED_SERVICE_PROVIDERS)[number]

export const SERVICE_PROVIDER_LABELS: Record<IntegratedServiceProvider, string> = {
  delhivery: 'Delhivery',
  deliveryone: 'Delivery One',
  ekart: 'Ekart',
  xpressbees: 'Xpressbees',
}

const SERVICE_PROVIDER_ALIASES: Record<string, IntegratedServiceProvider> = {
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

export const getServiceProviderLabel = (value: unknown) => {
  const normalized = normalizeServiceProviderKey(value) as IntegratedServiceProvider
  return SERVICE_PROVIDER_LABELS[normalized] || String(value || '').trim()
}

export const supportedServiceProviderList = () => INTEGRATED_SERVICE_PROVIDERS.join(', ')
