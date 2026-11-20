import axios, { AxiosInstance } from 'axios'
import { createHash } from 'crypto'

export type ShadowfaxDirection = 'forward' | 'reverse'
export type ShadowfaxConfig = {
  apiBase?: string
  apiKey?: string
  clientId?: string
  password?: string // OAuth client secret; same storage convention as other couriers
  webhookSecret?: string
}
export const SHADOWFAX_BASES = {
  staging: 'https://dale.staging.shadowfax.in/api',
  production: 'https://dale.shadowfax.in/api',
} as const
export const SHADOWFAX_COURIER_ID = 101

export class ShadowfaxError extends Error {
  constructor(message: string, public statusCode = 502, public ambiguous = false) {
    super(message)
    this.name = 'ShadowfaxError'
  }
}

export function shadowfaxBase(value?: string) {
  const base = String(value || SHADOWFAX_BASES.staging).trim().replace(/\/+$/, '')
  if (!Object.values(SHADOWFAX_BASES).includes(base as any)) {
    throw new ShadowfaxError('Use an official Shadowfax staging or production API URL.', 400)
  }
  return base
}
const required = (value: unknown, name: string, max = 200) => {
  const text = String(value ?? '').trim()
  if (!text || text.length > max) throw new ShadowfaxError(`Invalid ${name}.`, 400)
  return text
}
const awb = (value: unknown) => {
  const text = required(value, 'AWB', 100)
  if (!/^[a-zA-Z0-9]+$/.test(text)) throw new ShadowfaxError('Invalid Shadowfax AWB.', 400)
  return text
}
export const shadowfaxPin = (value: unknown) => {
  const text = String(value ?? '')
  if (!/^[1-9][0-9]{5}$/.test(text)) throw new ShadowfaxError('Invalid six-digit pincode.', 400)
  return Number(text)
}
const positiveCount = (value: unknown, max: number) => {
  const count = Number(value)
  if (!Number.isInteger(count) || count < 1 || count > max) {
    throw new ShadowfaxError(`Count must be between 1 and ${max}.`, 400)
  }
  return count
}
const awbs = (values: unknown, max: number) => {
  if (!Array.isArray(values) || !values.length || values.length > max) {
    throw new ShadowfaxError(`Provide 1–${max} AWBs.`, 400)
  }
  return [...new Set(values.map(awb))]
}
const isFailure = (data: any) => {
  const message = String(data?.message || '').trim().toLowerCase()
  const status = String(data?.status || '').trim().toLowerCase()
  return data?.success === false || data?.status === false ||
    ['failure', 'failed', 'error'].includes(message) ||
    ['failure', 'failed', 'error'].includes(status) ||
    (data?.responseCode != null && Number(data.responseCode) >= 400) ||
    (data?.errors != null && data.errors !== '' &&
      (typeof data.errors !== 'object' || Object.keys(data.errors).length > 0))
}

// Shared across short-lived adapter instances; keys are hashes, never raw credentials.
const oauthCache = new Map<string, { token: string; expires: number }>()
const oauthPending = new Map<string, Promise<string>>()

/** No transport retries for mutations: reverse idempotency expires after 30 minutes. */
export class ShadowfaxService {
  readonly base: string
  constructor(readonly config: ShadowfaxConfig, private http: AxiosInstance = axios.create()) {
    this.base = shadowfaxBase(config.apiBase)
  }

  async authorization(): Promise<string> {
    if (this.config.apiKey?.trim()) return `Token ${this.config.apiKey.trim()}`
    if (!this.config.clientId || !this.config.password) {
      throw new ShadowfaxError('Shadowfax credentials are not configured.', 503)
    }
    const key = createHash('sha256').update(`${this.base}:${this.config.clientId}:${this.config.password}`).digest('hex')
    const cached = oauthCache.get(key)
    if (cached && cached.expires > Date.now()) return `Bearer ${cached.token}`
    if (!oauthPending.has(key)) {
      const exchange = (async () => {
        try {
          const response = await this.http.request({
            method: 'POST', url: `${this.base}/v1/clients/token/`,
            headers: {
              Authorization: `Basic ${Buffer.from(`${this.config.clientId}:${this.config.password}`).toString('base64')}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            data: 'grant_type=client_credentials', timeout: 20000, maxRedirects: 0,
          })
          const token = response.data?.access_token
          if (typeof token !== 'string' || !token) throw new Error('Invalid token response')
          const ttl = Number(response.data?.expires_in)
          oauthCache.set(key, { token, expires: Date.now() + Math.max(0, (Number.isFinite(ttl) ? ttl : 3600) - 60) * 1000 })
          // Bound memory if credentials are repeatedly rotated.
          if (oauthCache.size > 32) oauthCache.delete(oauthCache.keys().next().value!)
          return token
        } catch {
          throw new ShadowfaxError('Shadowfax authentication failed. Check the environment and credentials.', 503)
        }
      })()
      oauthPending.set(key, exchange)
    }
    try { return `Bearer ${await oauthPending.get(key)!}` }
    finally { oauthPending.delete(key) }
  }

  private async request(method: 'GET' | 'POST', path: string, data?: any, params?: any) {
    const authorization = await this.authorization()
    try {
      const response = await this.http.request({
        method, url: `${this.base}${path}`, data, params,
        headers: { Authorization: authorization, 'Content-Type': 'application/json' },
        timeout: 20000, maxRedirects: 0,
      })
      if (isFailure(response.data)) throw new ShadowfaxError('Shadowfax rejected the request. Check shipment details and serviceability.', 422)
      return response.data
    } catch (error: any) {
      if (error instanceof ShadowfaxError) throw error
      const status = Number(error?.response?.status || 0)
      // Never propagate Axios config/headers, tokens, customer addresses, or raw error bodies.
      throw new ShadowfaxError(
        status === 401 || status === 403 ? 'Shadowfax credentials were rejected.' :
        status === 429 ? 'Shadowfax rate limit reached. Please try later.' :
        status >= 400 && status < 500 ? 'Shadowfax rejected the shipment request.' :
        'Shadowfax is unavailable. Do not repeat booking until its result is reconciled.',
        status === 429 ? 429 : status >= 400 && status < 500 ? 422 : 502,
        method === 'POST' && (!status || status >= 500),
      )
    }
  }

  async placeOrder(direction: ShadowfaxDirection, payload: Record<string, any>) {
    validateShadowfaxOrder(direction, payload)
    const result = await this.request('POST', direction === 'forward' ? '/v3/clients/orders/' : '/v1/clients/pickup/orders/', payload)
    // Reverse duplicate response is a flat tracking object, not the fresh-order envelope.
    if (direction === 'reverse' && result?.request_type === 'pickup' && result?.client_request_id &&
      result.client_order_number === payload.order_details.client_order_id) {
      return { message: 'Success', data: { awb_number: awb(result.client_request_id), status: result.status } }
    }
    if (String(result?.message).toLowerCase() !== 'success' || !result?.data?.awb_number) {
      // A malformed response may still mean the order exists remotely.
      throw new ShadowfaxError('Shadowfax booking result could not be confirmed. Reconcile before retrying.', 502, true)
    }
    awb(result.data.awb_number)
    return result
  }
  updateOrder(direction: ShadowfaxDirection, payload: Record<string, any>) {
    awb(payload.awb_number)
    if (direction === 'reverse' && payload.status_update) throw new ShadowfaxError('Reverse status cannot be changed using the update API.', 400)
    return this.request('POST', '/v3/clients/order_update/', payload)
  }
  async cancelOrder(direction: ShadowfaxDirection, requestId: string, remarks = 'Seller requested cancellation') {
    const result = await this.request('POST', direction === 'forward' ? '/v3/clients/orders/cancel/' : '/v2/clients/requests/mark_cancel', {
      request_id: required(requestId, 'request ID'), cancel_remarks: required(remarks, 'cancellation reason', 1000),
    })
    const accepted = Number(result?.responseCode) === 200 ||
      /^(success|request.*cancelled|order.*cancelled)/i.test(String(result?.message || result?.responseMsg || ''))
    if (!accepted) throw new ShadowfaxError('Shadowfax cancellation was not confirmed; local order is unchanged.', 502)
    return { ...result, success: true }
  }
  trackOrder(direction: ShadowfaxDirection, number: string) {
    const id = awb(number)
    return this.request('GET', direction === 'forward' ? `/v4/clients/orders/${id}/track/` : `/v4/clients/requests/${id}`)
  }
  bulkTrack(direction: ShadowfaxDirection, numbers: string[]) {
    const ids = awbs(numbers, 50)
    return this.request('POST', direction === 'forward' ? '/v4/clients/bulk_track/' : '/v4/clients/requests/bulk_query',
      direction === 'forward' ? { awb_numbers: ids } : { request_ids: ids })
  }
  serviceability(service: string, pincodes?: (string | number)[], page = 1, count = 25) {
    const services = ['marketplace', 'regular', 'seller_pickup', 'seller_delivery', 'customer_delivery', 'warehouse_pickup', 'warehouse_return', 'customer_pickup']
    if (!services.includes(service)) throw new ShadowfaxError('Invalid Shadowfax service.', 400)
    if (pincodes && (!Array.isArray(pincodes) || !pincodes.length || pincodes.length > 500)) throw new ShadowfaxError('Provide 1–500 pincodes.', 400)
    return this.request('GET', '/v1/clients/serviceability/', undefined, {
      service, ...(pincodes ? { pincodes: pincodes.map(shadowfaxPin).join(',') } : {}),
      page: positiveCount(page, 1000000), count: positiveCount(count, 500),
    })
  }
  async checkRoute(direction: ShadowfaxDirection, origin: string, destination: string, returnPin = origin) {
    // Existing workflow uses Marketplace/Regular, not Warehouse/D2D/Surface.
    const legs = direction === 'forward'
      ? [['seller_pickup', origin, 'Marketplace'], ['customer_delivery', destination, 'Regular'], ['seller_delivery', returnPin, 'RTS']]
      : [['customer_pickup', origin, 'Regular'], ['seller_delivery', destination, 'RTS']]
    const results = await Promise.all(legs.map(async ([service, pin, tier]) => {
      const rows = await this.serviceability(service, [pin])
      return Array.isArray(rows) && rows.some((r: any) => Number(r.code) === Number(pin) &&
        Array.isArray(r.services) && r.services.some((s: string) => s.toLowerCase() === tier.toLowerCase()))
    }))
    return results.every(Boolean)
  }
  async rate(origin: string | number, destination: string | number, service: 'forward' | 'reverse' | 'reverse_qc', weight: number) {
    if (!['forward', 'reverse', 'reverse_qc'].includes(service) || !Number.isFinite(weight) || weight <= 0) throw new ShadowfaxError('Invalid rate service or kilogram weight.', 400)
    const result = await this.request('POST', '/v1/clients/rate_calculator/', {
      origin_pincode: shadowfaxPin(origin), destination_pincode: shadowfaxPin(destination), service, weight,
    })
    // Null is not a zero-cost quote. Preserve it for admin diagnostics, but never book with it.
    return { ...result, total: result?.shipping_rate == null || result?.gst == null ? null : Number(result.shipping_rate) + Number(result.gst) }
  }
  label(number: string, fileType: 'pdf' | 'prn' = 'pdf') {
    if (!['pdf', 'prn'].includes(fileType)) throw new ShadowfaxError('Invalid label file type.', 400)
    return this.request('POST', '/client/generate_label/', { awb_number: awb(number), file_type: fileType })
  }
  pod(numbers: string[]) { return this.request('POST', '/v1/clients/pod_details/', { awb_numbers: awbs(numbers, 100) }) }
  escalationCategories(number: string) {
    return this.request('GET', '/v1/clients/support/issue/', undefined, { awb_number: awb(number) })
  }
  async raiseEscalation(number: string, category: number, comments = '') {
    const id = awb(number)
    const categories = await this.escalationCategories(id)
    if (!Number.isInteger(category) || !Object.values(categories?.client_issue_category_mapping || {}).includes(category)) throw new ShadowfaxError('Select a currently available escalation category.', 400)
    if (typeof comments !== 'string' || comments.length > 1000) throw new ShadowfaxError('Comments must be at most 1000 characters.', 400)
    return this.request('POST', '/v1/clients/support/issue/', { awb_number: id, issue_category: category, comments })
  }
  generateAwbs(direction: ShadowfaxDirection, count = 10) {
    return this.request('POST', direction === 'forward' ? '/v3/clients/generate_marketplace_awb/' : '/v3/clients/orders/generate_awb/', {
      count: positiveCount(count, direction === 'forward' ? 100000 : 350000),
    })
  }
  requestFreshAwbs(direction: ShadowfaxDirection, count = 1000) {
    return this.request('POST', '/v1/clients/awb/', { awb_count: positiveCount(count, 100000), request_type: direction === 'forward' ? 'fwd' : 'rev' })
  }
  pollFreshAwbs(requestId: number) {
    return this.request('GET', `/v1/clients/awb/${positiveCount(requestId, Number.MAX_SAFE_INTEGER)}/`)
  }
}

export function validateShadowfaxOrder(direction: ShadowfaxDirection, payload: Record<string, any>) {
  const reverse = direction === 'reverse'
  const address = (value: any, addressKey: string) => {
    if (!value || typeof value !== 'object') throw new ShadowfaxError('Address is required.', 400)
    required(value.name, 'contact name', 100)
    if (!/^[0-9+]{10,14}$/.test(String(value.contact || ''))) throw new ShadowfaxError('Invalid contact phone.', 400)
    required(value[addressKey], 'address', 2000)
    required(value.city, 'city', 50)
    shadowfaxPin(value.pincode)
  }
  address(payload.customer_details, reverse ? 'address' : 'address_line_1')
  address(payload.return_details, reverse ? 'address' : 'address_line_1')
  if (!['seller', 'origin', 'warehouse'].includes(payload.return_details.return_type)) throw new ShadowfaxError('Invalid return type.', 400)
  if (!reverse) address(payload.pickup_details, 'address_line_1')
  const order = payload.order_details || {}
  required(order.client_order_id, 'client order ID', reverse ? 200 : 100)
  const value = Number(reverse ? order.price : order.product_value)
  if (!Number.isFinite(value) || value < 0) throw new ShadowfaxError('Invalid product value.', 400)
  if (!reverse && (!['prepaid', 'cod'].includes(order.payment_mode) || !Number.isFinite(order.cod_amount) ||
      (order.payment_mode === 'prepaid' ? order.cod_amount !== 0 : order.cod_amount <= 0))) throw new ShadowfaxError('Invalid payment mode or COD amount.', 400)
  if (order.awb_number) awb(order.awb_number)
  for (const key of ['actual_weight', 'volumetric_weight']) {
    if (order[key] != null && (!Number.isFinite(order[key]) || order[key] < 0)) throw new ShadowfaxError('Weights must be nonnegative kilograms.', 400)
  }
  const items = reverse ? payload.sku_details : payload.product_details
  if (!Array.isArray(items) || !items.length) throw new ShadowfaxError('At least one SKU is required.', 400)
  for (const item of items) {
    required(item.sku_name, 'SKU name')
    if (!reverse) required(item.sku_id, 'SKU ID', 100)
    if (!Number.isFinite(item.price) || item.price < 0) throw new ShadowfaxError('Invalid SKU price.', 400)
  }
  if (value >= 50000 && (!/^\d{12}$/.test(String(order.eway_bill || '')) ||
    !items.some((item: any) => item.seller_details?.gstin_number))) throw new ShadowfaxError('High-value shipments require a 12-digit e-way bill and seller GSTIN.', 400)
}
