/**
 * External API Helper Functions
 * These utilities are used across external API controllers
 */

import {
  IntegratedServiceProvider,
  normalizeServiceProviderKey,
} from './courierProviders'

// Map integration types to opaque codes that don't reveal the provider
const PROVIDER_CODE_MAP: Record<IntegratedServiceProvider, string> = {
  deliveryone: 'QH8L2',
  delhivery: 'QH8L2',
}

// Reverse map: provider code -> integration type
const PROVIDER_CODE_REVERSE_MAP: Record<string, string> = {
  QH8L2: 'deliveryone',
  R7M4K: 'deliveryone',
}

/**
 * Generate an opaque provider code from integration_type
 * This hides the actual service provider from external API users
 * The code is opaque and cannot be reverse-engineered to determine the provider
 */
export const getOpaqueProviderCode = (integrationType: string | null | undefined): string => {
  const normalizedType = normalizeServiceProviderKey(integrationType) || 'deliveryone'
  return PROVIDER_CODE_MAP[normalizedType as IntegratedServiceProvider] || 'QH8L2'
}

/**
 * Convert provider_code back to integration_type (for internal use only)
 * Used when external API users send provider_code in requests
 */
export const getIntegrationTypeFromProviderCode = (
  providerCode: string | null | undefined,
): IntegratedServiceProvider | null => {
  if (!providerCode) return null

  const normalizedCode = providerCode.trim().toUpperCase()
  const integrationType = PROVIDER_CODE_REVERSE_MAP[normalizedCode]

  if (integrationType) {
    return integrationType as IntegratedServiceProvider
  }

  return null
}
