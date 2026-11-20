import { ShadowfaxError, SHADOWFAX_BASES } from './shadowfax.service'

/** Token-only UI contract. A client cannot override host, OAuth or activation flags. */
export function shadowfaxProductionTokenValues(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
    Object.keys(input).some(key => key !== 'productionToken')) {
    throw new ShadowfaxError('Only the productionToken field is accepted.', 400)
  }
  const value = (input as { productionToken?: unknown }).productionToken
  if (typeof value !== 'string') throw new ShadowfaxError('Production token is required.', 400)
  const apiKey = value.trim().replace(/^Token\s+/i, '')
  if (!/^[A-Za-z0-9_-]{20,255}$/.test(apiKey)) throw new ShadowfaxError('Enter a valid Shadowfax production token.', 400)
  return { provider: 'shadowfax', apiBase: SHADOWFAX_BASES.production, apiKey }
}
