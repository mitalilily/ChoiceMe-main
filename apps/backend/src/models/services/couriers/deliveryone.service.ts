import axios from 'axios'
import qs from 'qs'
import { DelhiveryManifestError, HttpError } from '../../../utils/classes'
import {
  getDelhiveryModeCodeByShippingMode,
  getDelhiveryShippingModeByCourierId,
  normalizeDelhiveryShippingMode,
  normalizeCourierId,
} from '../../../utils/delhiveryCourier'
import { DeliveryOneConfig, getEffectiveCourierConfig } from '../courierCredentials.service'
import type { ShipmentParams } from '../shiprocket.service'

type DeliveryOnePincodeRecord = {
  postal_code?: {
    pickup?: string
    cod?: string
    pre_paid?: string
    remark?: string
    pin?: number | string
    city?: string
    state_code?: string
    [key: string]: any
  }
  [key: string]: any
}

export type DeliveryOnePincodeServiceabilityResponse = {
  serviceable: boolean
  pickupAvailable: boolean
  codAvailable: boolean
  prepaidAvailable: boolean
  embargoed: boolean
  record: DeliveryOnePincodeRecord | null
  raw: any
}

export type DeliveryOnePairServiceabilityResponse = {
  serviceable: boolean
  origin: DeliveryOnePincodeServiceabilityResponse
  destination: DeliveryOnePincodeServiceabilityResponse
  codAvailable: boolean
  prepaidAvailable: boolean
  raw: {
    origin: any
    destination: any
  }
}

export type DeliveryOneHeavyPincodeServiceabilityResponse = {
  serviceable: boolean
  codAvailable: boolean
  prepaidAvailable: boolean
  records: any[]
  raw: any
}

export type DeliveryOneWaybillFetchResponse = {
  mode: 'single' | 'bulk'
  requestedCount: number
  waybills: string[]
  raw: any
}

export type DeliveryOneShipmentEditPayload = {
  waybill: string
  name?: string
  phone?: string | string[]
  pt?: string
  payment_mode?: string
  paymentMode?: string
  cod?: number | string
  cod_amount?: number | string
  codAmount?: number | string
  add?: string
  address?: string
  products_desc?: string
  productsDesc?: string
  gm?: number | string
  weight?: number | string
  shipment_height?: number | string
  shipmentHeight?: number | string
  shipment_width?: number | string
  shipmentWidth?: number | string
  shipment_length?: number | string
  shipmentLength?: number | string
}

export type DeliveryOneShipmentEditResponse = {
  waybill: string
  payload: Record<string, any>
  raw: any
}

export type DeliveryOneEWaybillUpdatePayload = {
  waybill: string
  dcn?: string
  invoice_number?: string
  invoiceNumber?: string
  ewbn?: string
  ewb?: string
  ewaybill_number?: string
  ewaybillNumber?: string
  data?: Array<{
    dcn?: string
    invoice_number?: string
    invoiceNumber?: string
    ewbn?: string
    ewb?: string
    ewaybill_number?: string
    ewaybillNumber?: string
  }>
}

export type DeliveryOneEWaybillUpdateResponse = {
  waybill: string
  payload: {
    data: Array<{
      dcn: string
      ewbn: string
    }>
  }
  raw: any
}

export type DeliveryOneTrackingParams = {
  waybill?: string | string[]
  ref_ids?: string | string[]
  refIds?: string | string[]
}

export type DeliveryOneShippingCostParams = {
  md?: string
  billing_mode?: string
  billingMode?: string
  cgm?: number | string
  chargeable_weight?: number | string
  chargeableWeight?: number | string
  weight?: number | string
  o_pin?: number | string
  origin_pincode?: number | string
  originPincode?: number | string
  origin?: number | string
  d_pin?: number | string
  destination_pincode?: number | string
  destinationPincode?: number | string
  destination?: number | string
  ss?: string
  status?: string
  pt?: string
  payment_type?: string
  paymentType?: string
  l?: number | string
  length?: number | string
  b?: number | string
  breadth?: number | string
  width?: number | string
  h?: number | string
  height?: number | string
  ipkg_type?: string
  package_type?: string
  packageType?: string
}

export type DeliveryOneShippingCostResponse = {
  params: {
    md: 'E' | 'S'
    cgm: number
    o_pin: string
    d_pin: string
    ss: 'Delivered' | 'RTO' | 'DTO'
    pt: 'Pre-paid' | 'COD'
    l?: number
    b?: number
    h?: number
    ipkg_type?: string
  }
  charges: {
    total: number | null
    freight: number | null
    cod: number | null
    chargeableWeight: number | null
  }
  raw: any
}

export type DeliveryOneExpectedTatParams = {
  origin_pin?: string | number
  originPin?: string | number
  origin?: string | number
  destination_pin?: string | number
  destinationPin?: string | number
  destination?: string | number
  mot?: string
  mode?: string
  shipping_mode?: string
  shippingMode?: string
  pdt?: string
  product_type?: string
  productType?: string
  expected_pickup_date?: string
  expectedPickupDate?: string
}

export type DeliveryOneExpectedTatResponse = {
  params: {
    origin_pin: string
    destination_pin: string
    mot: 'S' | 'E' | 'N'
    pdt?: string
    expected_pickup_date?: string
  }
  tatDays: number | null
  expectedDeliveryDate: string | null
  raw: any
}

export type DeliveryOneLabelParams = {
  waybill?: string
  wbns?: string
  pdf?: boolean | string
  pdf_size?: 'A4' | '4R' | string
  pdfSize?: 'A4' | '4R' | string
}

export type DeliveryOneLabelResponse = {
  waybill: string
  pdf: boolean
  pdfSize?: 'A4' | '4R'
  labelUrl: string | null
  packages: any[]
  raw: any
}

export type DeliveryOneDocumentParams = {
  waybill?: string | number
  doc_type?: string
  docType?: string
}

export type DeliveryOneDocumentResponse = {
  waybill: string
  docType: string
  documentUrl: string | null
  raw: any
}

export type DeliveryOneNdrActionPayload = {
  waybill: string
  act: 'RE-ATTEMPT' | 'PICKUP_RESCHEDULE' | string
  action_data?: Record<string, any>
  actionData?: Record<string, any>
}

export type DeliveryOneNdrActionResponse = {
  payload: {
    data: Array<{
      waybill: string
      act: 'RE-ATTEMPT' | 'PICKUP_RESCHEDULE'
      action_data?: Record<string, any>
    }>
  }
  requestId: string | null
  raw: any
}

export type DeliveryOneNdrStatusResponse = {
  uplId: string
  verbose: boolean
  raw: any
}

export type DeliveryOnePickupRequestPayload = {
  pickup_time?: string
  pickupTime?: string
  pickup_date?: string | Date
  pickupDate?: string | Date
  pickup_location?: string
  pickupLocation?: string
  expected_package_count?: number | string
  expectedPackageCount?: number | string
  package_count?: number | string
  count?: number | string
}

export type DeliveryOnePickupRequestResponse = {
  payload: {
    pickup_time: string
    pickup_date: string
    pickup_location: string
    expected_package_count: number
  }
  existing?: boolean
  pickupId?: string | number | null
  raw: any
}

export type DeliveryOneWarehousePayload = {
  name?: string
  registered_name?: string
  registeredName?: string
  phone?: string | number
  email?: string
  address?: string
  city?: string
  pin?: string | number
  pincode?: string | number
  country?: string
  return_address?: string
  returnAddress?: string
  return_city?: string
  returnCity?: string
  return_pin?: string | number
  returnPin?: string | number
  return_state?: string
  returnState?: string
  return_country?: string
  returnCountry?: string
}

export type DeliveryOneWarehouseResponse = {
  payload: {
    name: string
    registered_name?: string
    phone: string
    email?: string
    address?: string
    city?: string
    pin: string
    country?: string
    return_address: string
    return_city?: string
    return_pin?: string
    return_state?: string
    return_country?: string
  }
  raw: any
}

export type DeliveryOneWarehouseUpdatePayload = {
  name?: string
  warehouseName?: string
  phone?: string | number
  address?: string
  pin?: string | number
  pincode?: string | number
}

export type DeliveryOneWarehouseUpdateResponse = {
  payload: {
    name: string
    phone?: string
    address?: string
    pin?: string
  }
  raw: any
}

export class DeliveryOneService {
  private apiBase =
    process.env.DELIVERY_ONE_API_BASE ||
    process.env.DELIVERYONE_API_BASE ||
    'https://track.delhivery.com'
  private apiKey = process.env.DELIVERY_ONE_API_KEY || process.env.DELIVERYONE_API_KEY || ''
  private static cachedConfig: DeliveryOneConfig | null | undefined

  static clearCachedConfig() {
    DeliveryOneService.cachedConfig = undefined
  }

  private normalizeBaseApi(value: string) {
    return (String(value || '').trim() || 'https://track.delhivery.com').replace(/\/+$/, '')
  }

  private maskToken(value: string) {
    const normalized = String(value || '').trim()
    if (!normalized) return ''
    if (normalized.length <= 8) return '********'
    return `${normalized.slice(0, 4)}${'*'.repeat(Math.max(normalized.length - 8, 0))}${normalized.slice(-4)}`
  }

  private log(prefix: string, details: Record<string, any>) {
    console.log(`[DeliveryOne] ${prefix}`, details)
  }

  private useEnvOnlyConfig() {
    return ['1', 'true', 'yes', 'y'].includes(
      String(process.env.DELIVERY_ONE_FORCE_ENV_CONFIG || '').trim().toLowerCase(),
    )
  }

  private async ensureConfigLoaded() {
    const forceEnvOnly = this.useEnvOnlyConfig()
    if (forceEnvOnly) {
      DeliveryOneService.cachedConfig = null
    } else if (DeliveryOneService.cachedConfig === undefined) {
      DeliveryOneService.cachedConfig = await getEffectiveCourierConfig<DeliveryOneConfig>(
        'deliveryone',
        'b2c',
      )
    }

    const cfg = DeliveryOneService.cachedConfig
    if (cfg) {
      this.apiBase = cfg.apiBase || this.apiBase
      this.apiKey = cfg.apiKey || this.apiKey
    }

    this.apiBase = this.normalizeBaseApi(this.apiBase)
    this.log('Config loaded', {
      apiBase: this.apiBase,
      hasApiKey: Boolean(this.apiKey),
      apiKey: this.maskToken(this.apiKey),
      source: forceEnvOnly
        ? 'forced_env'
        : cfg
          ? 'courier_credentials_or_env_fallback'
          : 'env_only',
    })
  }

  private async getHeaders({ includeContentType = true }: { includeContentType?: boolean } = {}) {
    await this.ensureConfigLoaded()

    if (!this.apiKey) {
      throw new HttpError(
        400,
        'Delhivery API key is not configured. Save the token in Courier Credentials first.',
      )
    }

    const headers: Record<string, string> = {
      Authorization: `Token ${this.apiKey}`,
      Accept: 'application/json',
    }
    if (includeContentType) headers['Content-Type'] = 'application/json'
    return headers
  }

  private async getToken() {
    await this.ensureConfigLoaded()

    if (!this.apiKey) {
      throw new HttpError(
        400,
        'Delhivery API key is not configured. Save the token in Courier Credentials first.',
      )
    }

    return this.apiKey
  }

  private isYes(value: unknown) {
    const normalized = String(value ?? '').trim().toLowerCase()
    return ['y', 'yes', 'true', '1', 'available', 'serviceable'].includes(normalized)
  }

  private isAnyYes(...values: unknown[]) {
    return values.some((value) => this.isYes(value))
  }

  private getRecords(raw: any): DeliveryOnePincodeRecord[] {
    if (Array.isArray(raw?.delivery_codes)) return raw.delivery_codes
    if (Array.isArray(raw?.data?.delivery_codes)) return raw.data.delivery_codes
    if (Array.isArray(raw)) return raw
    return []
  }

  private async postFormEncoded(path: string, payload: unknown) {
    const token = await this.getToken()
    const encodedData = qs.stringify({
      format: 'json',
      data: JSON.stringify(payload),
    })

    return axios.post(`${this.apiBase}${path}`, encodedData, {
      headers: {
        Authorization: `Token ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 30000,
    })
  }

  private extractErrorMessage(raw: any, fallback: string) {
    if (!raw) return fallback
    if (typeof raw === 'string') return raw
    const normalizedRemarks = (remarks: unknown): string[] => {
      if (!remarks) return []
      if (Array.isArray(remarks)) return remarks.flatMap((entry) => normalizedRemarks(entry))
      if (typeof remarks === 'object') {
        return Object.values(remarks as Record<string, unknown>).flatMap((entry) =>
          normalizedRemarks(entry),
        )
      }
      return [String(remarks).trim()].filter(Boolean)
    }

    return (
      raw?.detail ||
      raw?.message ||
      (typeof raw?.error === 'string' ? raw.error : normalizedRemarks(raw?.error).join(' | ')) ||
      raw?.error_message ||
      raw?.status_message ||
      raw?.reason ||
      normalizedRemarks(raw?.rmk).join(' | ') ||
      normalizedRemarks(raw?.remarks).join(' | ') ||
      fallback
    )
  }

  private extractWaybills(raw: any): string[] {
    const candidates = [
      raw?.waybill,
      raw?.waybills,
      raw?.data?.waybill,
      raw?.data?.waybills,
      raw?.data,
      raw,
    ]

    for (const candidate of candidates) {
      if (typeof candidate === 'string') {
        const normalized = candidate.trim()
        if (!normalized) continue

        return normalized
          .split(/[,\s]+/)
          .map((item) => item.trim())
          .filter(Boolean)
      }

      if (Array.isArray(candidate)) {
        const waybills = candidate
          .flatMap((item) => {
            if (typeof item === 'string' || typeof item === 'number') return [String(item)]
            if (item && typeof item === 'object') {
              return [
                item.waybill,
                item.wbn,
                item.awb,
                item.awb_number,
                item.waybill_number,
              ].filter(Boolean)
            }
            return []
          })
          .map((item) => String(item).trim())
          .filter(Boolean)

        if (waybills.length) return waybills
      }
    }

    return []
  }

  async fetchWaybills(count = 1): Promise<DeliveryOneWaybillFetchResponse> {
    const normalizedCount = Math.floor(Number(count || 1))
    if (!Number.isFinite(normalizedCount) || normalizedCount < 1) {
      throw new HttpError(400, 'Delhivery waybill count must be at least 1.')
    }
    if (normalizedCount > 10000) {
      throw new HttpError(400, 'Delhivery bulk waybill count cannot be more than 10,000.')
    }

    const token = await this.getToken()
    const mode = normalizedCount === 1 ? 'single' : 'bulk'
    const path =
      mode === 'single' ? '/waybill/api/fetch/json/' : '/waybill/api/bulk/json/'
    const url = `${this.apiBase}${path}`

    try {
      const response = await axios.get(url, {
        headers: { Accept: 'application/json' },
        params: {
          token,
          ...(mode === 'bulk' ? { count: normalizedCount } : {}),
        },
        timeout: 20000,
      })

      const waybills = this.extractWaybills(response.data)
      this.log('Fetch waybills', {
        mode,
        requestedCount: normalizedCount,
        status: response.status,
        receivedCount: waybills.length,
      })

      return {
        mode,
        requestedCount: normalizedCount,
        waybills,
        raw: response.data,
      }
    } catch (error: any) {
      const status = Number(error?.response?.status || 502)
      const message =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        (typeof error?.response?.data === 'string' ? error.response.data : '') ||
        error?.message ||
        'Delhivery waybill fetch failed'

      this.log('Fetch waybills failed', {
        mode,
        requestedCount: normalizedCount,
        status,
        response: error?.response?.data || null,
        message,
      })

      throw new HttpError(status, message)
    }
  }

  async fetchSingleWaybill(): Promise<DeliveryOneWaybillFetchResponse> {
    return this.fetchWaybills(1)
  }

  async editShipment(
    payload: DeliveryOneShipmentEditPayload,
  ): Promise<DeliveryOneShipmentEditResponse> {
    const sanitizeString = (value?: string | number | null) => {
      if (value === undefined || value === null) return ''
      return String(value).trim()
    }
    const sanitizePhone = (value?: string | number | null) => {
      const digits = String(value || '').replace(/\D/g, '')
      return digits.length >= 10 ? digits.slice(-10) : digits
    }
    const toNumber = (value: unknown) => {
      if (value === undefined || value === null || value === '') return undefined
      const parsed = Number(value)
      return Number.isFinite(parsed) ? parsed : undefined
    }
    const normalizePaymentMode = (value: unknown) => {
      const normalized = sanitizeString(value as any).toLowerCase()
      if (!normalized) return undefined
      if (normalized === 'cod') return 'COD'
      if (['prepaid', 'pre-paid', 'pre paid'].includes(normalized)) return 'Pre-paid'
      throw new HttpError(
        400,
        'Delhivery shipment edit payment mode must be COD or Pre-paid.',
      )
    }

    const waybill = sanitizeString(payload?.waybill)
    if (!waybill) {
      throw new HttpError(400, 'waybill is required to edit a Delhivery shipment.')
    }

    const editPayload: Record<string, any> = { waybill }
    const name = sanitizeString(payload.name)
    if (name) editPayload.name = name

    const phoneValues = Array.isArray(payload.phone) ? payload.phone : [payload.phone]
    const phones = phoneValues.map((phone) => sanitizePhone(phone)).filter(Boolean)
    if (phones.length) editPayload.phone = phones

    const paymentMode = normalizePaymentMode(payload.pt ?? payload.payment_mode ?? payload.paymentMode)
    if (paymentMode) editPayload.pt = paymentMode

    const codAmount = toNumber(payload.cod ?? payload.cod_amount ?? payload.codAmount)
    if (codAmount !== undefined) editPayload.cod = codAmount

    const address = sanitizeString(payload.add ?? payload.address)
    if (address) editPayload.add = address

    const productsDesc = sanitizeString(payload.products_desc ?? payload.productsDesc)
    if (productsDesc) editPayload.products_desc = productsDesc

    const weight = toNumber(payload.gm ?? payload.weight)
    if (weight !== undefined) editPayload.gm = weight

    const height = toNumber(payload.shipment_height ?? payload.shipmentHeight)
    if (height !== undefined) editPayload.shipment_height = height

    const width = toNumber(payload.shipment_width ?? payload.shipmentWidth)
    if (width !== undefined) editPayload.shipment_width = width

    const length = toNumber(payload.shipment_length ?? payload.shipmentLength)
    if (length !== undefined) editPayload.shipment_length = length

    if (Object.keys(editPayload).length === 1) {
      throw new HttpError(
        400,
        'Provide at least one editable field for Delhivery shipment edit.',
      )
    }
    if (editPayload.pt === 'COD' && !(Number(editPayload.cod) > 0)) {
      throw new HttpError(
        400,
        'Positive COD amount is required when converting a Delhivery shipment to COD.',
      )
    }

    const headers = await this.getHeaders()

    try {
      const response = await axios.post(`${this.apiBase}/api/p/edit`, editPayload, {
        headers,
        timeout: 20000,
      })
      const raw = response.data
      const explicitFailure =
        raw?.error === true ||
        (typeof raw?.error === 'string' && raw.error.trim().length > 0) ||
        raw?.success === false ||
        raw?.Success === false ||
        String(raw?.status || '').toLowerCase() === 'fail'

      this.log(explicitFailure ? 'Edit shipment rejected' : 'Edit shipment succeeded', {
        waybill,
        status: response.status,
        updatedFields: Object.keys(editPayload).filter((key) => key !== 'waybill'),
        response: explicitFailure ? raw : undefined,
      })

      if (explicitFailure) {
        throw new HttpError(
          502,
          this.extractErrorMessage(raw, 'Delhivery shipment edit failed.'),
        )
      }

      return {
        waybill,
        payload: editPayload,
        raw,
      }
    } catch (error: any) {
      if (error instanceof HttpError) {
        throw error
      }

      const status = Number(error?.response?.status || 502)
      const message =
        this.extractErrorMessage(error?.response?.data, '') ||
        error?.message ||
        'Delhivery shipment edit failed'

      this.log('Edit shipment failed', {
        waybill,
        status,
        response: error?.response?.data || null,
        message,
      })

      throw new HttpError(status, message)
    }
  }

  async cancelShipment(waybill: string) {
    const normalizedWaybill = String(waybill || '').trim()
    if (!normalizedWaybill) {
      throw new HttpError(400, 'waybill is required to cancel a Delhivery shipment.')
    }

    const payload = {
      waybill: normalizedWaybill,
      cancellation: 'true',
    }
    const headers = await this.getHeaders()

    try {
      const response = await axios.post(`${this.apiBase}/api/p/edit`, payload, {
        headers,
        timeout: 20000,
      })
      const raw = response.data
      const explicitFailure =
        raw?.error === true ||
        (typeof raw?.error === 'string' && raw.error.trim().length > 0) ||
        raw?.success === false ||
        raw?.Success === false ||
        String(raw?.status || '').toLowerCase() === 'fail'

      this.log(explicitFailure ? 'Cancel shipment rejected' : 'Cancel shipment succeeded', {
        waybill: normalizedWaybill,
        status: response.status,
        response: explicitFailure ? raw : undefined,
      })

      if (explicitFailure) {
        throw new HttpError(
          502,
          this.extractErrorMessage(raw, 'Delhivery shipment cancellation failed.'),
        )
      }

      return raw
    } catch (error: any) {
      if (error instanceof HttpError) {
        throw error
      }

      const status = Number(error?.response?.status || 502)
      const message =
        this.extractErrorMessage(error?.response?.data, '') ||
        error?.message ||
        'Delhivery shipment cancellation failed'

      this.log('Cancel shipment failed', {
        waybill: normalizedWaybill,
        status,
        response: error?.response?.data || null,
        message,
      })

      throw new HttpError(status, message)
    }
  }

  async updateEWaybill(
    payload: DeliveryOneEWaybillUpdatePayload,
  ): Promise<DeliveryOneEWaybillUpdateResponse> {
    const sanitizeString = (value?: string | number | null) => {
      if (value === undefined || value === null) return ''
      return String(value).trim()
    }

    const waybill = sanitizeString(payload?.waybill)
    if (!waybill) {
      throw new HttpError(400, 'waybill is required to update a Delhivery e-waybill.')
    }

    const recordsSource =
      Array.isArray(payload?.data) && payload.data.length
        ? payload.data
        : [
            {
              dcn: payload?.dcn ?? payload?.invoice_number ?? payload?.invoiceNumber,
              ewbn:
                payload?.ewbn ??
                payload?.ewb ??
                payload?.ewaybill_number ??
                payload?.ewaybillNumber,
            },
          ]

    const data = recordsSource
      .map((record) => ({
        dcn: sanitizeString(record?.dcn ?? record?.invoice_number ?? record?.invoiceNumber),
        ewbn: sanitizeString(
          record?.ewbn ?? record?.ewb ?? record?.ewaybill_number ?? record?.ewaybillNumber,
        ),
      }))
      .filter((record) => record.dcn && record.ewbn)

    if (!data.length) {
      throw new HttpError(
        400,
        'dcn (invoice number) and ewbn (e-waybill number) are required to update a Delhivery e-waybill.',
      )
    }

    const headers = await this.getHeaders()
    const requestPayload = { data }

    try {
      const response = await axios.put(
        `${this.apiBase}/api/rest/ewaybill/${encodeURIComponent(waybill)}/`,
        requestPayload,
        {
          headers,
          timeout: 20000,
        },
      )
      const raw = response.data
      const explicitFailure =
        raw?.error === true ||
        (typeof raw?.error === 'string' && raw.error.trim().length > 0) ||
        raw?.success === false ||
        raw?.Success === false ||
        String(raw?.status || '').toLowerCase() === 'fail'

      this.log(explicitFailure ? 'Update e-waybill rejected' : 'Update e-waybill succeeded', {
        waybill,
        status: response.status,
        records: data.length,
        response: explicitFailure ? raw : undefined,
      })

      if (explicitFailure) {
        throw new HttpError(
          502,
          this.extractErrorMessage(raw, 'Delhivery e-waybill update failed.'),
        )
      }

      return {
        waybill,
        payload: requestPayload,
        raw,
      }
    } catch (error: any) {
      if (error instanceof HttpError) {
        throw error
      }

      const status = Number(error?.response?.status || 502)
      const message =
        this.extractErrorMessage(error?.response?.data, '') ||
        error?.message ||
        'Delhivery e-waybill update failed'

      this.log('Update e-waybill failed', {
        waybill,
        status,
        response: error?.response?.data || null,
        message,
      })

      throw new HttpError(status, message)
    }
  }

  async trackShipment(params: string | DeliveryOneTrackingParams) {
    const normalizeList = (value: unknown) =>
      (Array.isArray(value) ? value : String(value || '').split(','))
        .map((item) => String(item || '').trim())
        .filter(Boolean)

    const waybills = typeof params === 'string' ? normalizeList(params) : normalizeList(params.waybill)
    const refIds =
      typeof params === 'string' ? [] : normalizeList(params.ref_ids ?? params.refIds)

    if (!waybills.length && !refIds.length) {
      throw new HttpError(400, 'waybill or ref_ids is required to track a Delhivery shipment.')
    }
    if (waybills.length > 50) {
      throw new HttpError(400, 'Delhivery tracking supports up to 50 waybills per request.')
    }

    const headers = await this.getHeaders({ includeContentType: false })

    try {
      const response = await axios.get(`${this.apiBase}/api/v1/packages/json/`, {
        headers,
        params: {
          ...(waybills.length ? { waybill: waybills.join(',') } : {}),
          ...(refIds.length ? { ref_ids: refIds.join(',') } : {}),
        },
        timeout: 20000,
      })
      const raw = response.data
      const explicitFailure =
        raw?.error === true ||
        (typeof raw?.error === 'string' && raw.error.trim().length > 0) ||
        raw?.success === false ||
        raw?.Success === false ||
        String(raw?.status || '').toLowerCase() === 'fail'

      this.log(explicitFailure ? 'Track shipment rejected' : 'Track shipment succeeded', {
        waybills: waybills.length,
        refIds: refIds.length,
        status: response.status,
        response: explicitFailure ? raw : undefined,
      })

      if (explicitFailure) {
        throw new HttpError(
          502,
          this.extractErrorMessage(raw, 'Delhivery tracking failed.'),
        )
      }

      return raw
    } catch (error: any) {
      if (error instanceof HttpError) {
        throw error
      }

      const status = Number(error?.response?.status || 502)
      const message =
        this.extractErrorMessage(error?.response?.data, '') ||
        error?.message ||
        'Delhivery tracking failed'

      this.log('Track shipment failed', {
        waybill: waybills.join(',') || null,
        refIds: refIds.join(',') || null,
        status,
        response: error?.response?.data || null,
        message,
      })

      throw new HttpError(status, message)
    }
  }

  async getExpectedTat(
    params: DeliveryOneExpectedTatParams,
  ): Promise<DeliveryOneExpectedTatResponse> {
    const sanitizeString = (value?: string | number | null) => {
      if (value === undefined || value === null) return ''
      return String(value).trim()
    }
    const sanitizePincode = (value?: string | number | null) =>
      sanitizeString(value).replace(/\D/g, '').slice(0, 6)
    const normalizeMot = (value: unknown): 'S' | 'E' | 'N' => {
      const normalized = sanitizeString(value as any).toLowerCase()
      if (['s', 'surface'].includes(normalized)) return 'S'
      if (['e', 'express', 'air'].includes(normalized)) return 'E'
      if (['n', 'ndd', 'next day delivery', 'next-day-delivery'].includes(normalized)) return 'N'
      throw new HttpError(400, 'mot must be S/Surface, E/Express, or N/NDD.')
    }
    const pickNumber = (raw: any, keys: string[]) => {
      for (const key of keys) {
        const value = key.split('.').reduce((acc, part) => acc?.[part], raw)
        if (value === undefined || value === null || value === '') continue
        const parsed = Number(String(value).replace(/,/g, ''))
        if (Number.isFinite(parsed)) return parsed
      }
      return null
    }
    const pickString = (raw: any, keys: string[]) => {
      for (const key of keys) {
        const value = key.split('.').reduce((acc, part) => acc?.[part], raw)
        if (value === undefined || value === null || value === '') continue
        return String(value).trim()
      }
      return null
    }

    const originPin = sanitizePincode(params.origin_pin ?? params.originPin ?? params.origin)
    const destinationPin = sanitizePincode(
      params.destination_pin ?? params.destinationPin ?? params.destination,
    )
    if (!/^\d{6}$/.test(originPin)) {
      throw new HttpError(400, 'A valid 6-digit origin_pin is required for Delhivery TAT.')
    }
    if (!/^\d{6}$/.test(destinationPin)) {
      throw new HttpError(
        400,
        'A valid 6-digit destination_pin is required for Delhivery TAT.',
      )
    }

    const expectedPickupDate = sanitizeString(
      params.expected_pickup_date ?? params.expectedPickupDate,
    )
    if (
      expectedPickupDate &&
      !/^\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2})?$/.test(expectedPickupDate)
    ) {
      throw new HttpError(
        400,
        'expected_pickup_date must be in YYYY-MM-DD or YYYY-MM-DD HH:mm format.',
      )
    }

    const requestParams: DeliveryOneExpectedTatResponse['params'] = {
      origin_pin: originPin,
      destination_pin: destinationPin,
      mot: normalizeMot(params.mot ?? params.mode ?? params.shipping_mode ?? params.shippingMode),
    }
    const productType = sanitizeString(params.pdt ?? params.product_type ?? params.productType)
    if (productType) requestParams.pdt = productType
    if (expectedPickupDate) requestParams.expected_pickup_date = expectedPickupDate

    const headers = await this.getHeaders({ includeContentType: false })

    try {
      const response = await axios.get(`${this.apiBase}/api/dc/expected_tat`, {
        headers,
        params: requestParams,
        timeout: 20000,
      })
      const raw = response.data
      const explicitFailure =
        raw?.error === true ||
        (typeof raw?.error === 'string' && raw.error.trim().length > 0) ||
        raw?.success === false ||
        raw?.Success === false ||
        String(raw?.status || '').toLowerCase() === 'fail'

      this.log(explicitFailure ? 'Expected TAT rejected' : 'Expected TAT fetched', {
        origin: originPin,
        destination: destinationPin,
        mot: requestParams.mot,
        status: response.status,
        response: explicitFailure ? raw : undefined,
      })

      if (explicitFailure) {
        throw new HttpError(
          502,
          this.extractErrorMessage(raw, 'Delhivery expected TAT lookup failed.'),
        )
      }

      return {
        params: requestParams,
        tatDays: pickNumber(raw, ['tat', 'TAT', 'data.tat', 'data.TAT', 'days', 'data.days']),
        expectedDeliveryDate: pickString(raw, [
          'expected_delivery_date',
          'expectedDeliveryDate',
          'edd',
          'data.expected_delivery_date',
          'data.expectedDeliveryDate',
          'data.edd',
        ]),
        raw,
      }
    } catch (error: any) {
      if (error instanceof HttpError) {
        throw error
      }

      const status = Number(error?.response?.status || 502)
      const message =
        this.extractErrorMessage(error?.response?.data, '') ||
        error?.message ||
        'Delhivery expected TAT lookup failed'

      this.log('Expected TAT failed', {
        origin: originPin,
        destination: destinationPin,
        mot: requestParams.mot,
        status,
        response: error?.response?.data || null,
        message,
      })

      throw new HttpError(status, message)
    }
  }

  async generateLabel(
    params: string | DeliveryOneLabelParams,
    options: Omit<DeliveryOneLabelParams, 'waybill' | 'wbns'> = {},
  ): Promise<DeliveryOneLabelResponse> {
    const sanitizeString = (value?: string | number | boolean | null) => {
      if (value === undefined || value === null) return ''
      return String(value).trim()
    }
    const normalizeBoolean = (value: unknown, fallback: boolean) => {
      if (value === undefined || value === null || value === '') return fallback
      if (typeof value === 'boolean') return value
      const normalized = String(value).trim().toLowerCase()
      if (['true', '1', 'yes', 'y'].includes(normalized)) return true
      if (['false', '0', 'no', 'n'].includes(normalized)) return false
      throw new HttpError(400, 'pdf must be true or false when provided.')
    }
    const normalizePdfSize = (value: unknown): 'A4' | '4R' | undefined => {
      const normalized = sanitizeString(value as any).toUpperCase()
      if (!normalized) return undefined
      if (normalized === 'A4' || normalized === '4R') return normalized
      throw new HttpError(400, 'pdf_size must be A4 or 4R when provided.')
    }
    const parseRaw = (raw: any) => {
      if (typeof raw !== 'string') return raw
      const trimmed = raw.trim()
      if (!trimmed) return raw
      try {
        return JSON.parse(trimmed)
      } catch {
        return raw
      }
    }
    const getPackages = (raw: any) => {
      if (Array.isArray(raw?.packages)) return raw.packages
      if (Array.isArray(raw?.data?.packages)) return raw.data.packages
      if (Array.isArray(raw?.Package)) return raw.Package
      if (Array.isArray(raw)) return raw
      if (raw?.packages) return [raw.packages]
      if (raw?.data?.packages) return [raw.data.packages]
      return []
    }
    const extractFirstUrl = (value: any): string | null => {
      if (!value) return null
      if (typeof value === 'string') {
        const directMatch = value.match(/https?:\/\/[^\s"'<>]+/i)
        return directMatch?.[0] ?? null
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          const url = extractFirstUrl(item)
          if (url) return url
        }
        return null
      }
      if (typeof value === 'object') {
        const preferredKeys = [
          'label',
          'label_url',
          'labelUrl',
          'pdf_url',
          'pdfUrl',
          'pdf_download_link',
          'download_url',
          's3_url',
          'url',
        ]
        for (const key of preferredKeys) {
          const url = extractFirstUrl(value[key])
          if (url) return url
        }
        for (const nestedValue of Object.values(value)) {
          const url = extractFirstUrl(nestedValue)
          if (url) return url
        }
      }
      return null
    }

    const source =
      typeof params === 'string'
        ? { waybill: params, ...options }
        : { ...(params || {}), ...options }
    const waybill = sanitizeString(source.waybill || source.wbns)
    if (!waybill) {
      throw new HttpError(400, 'waybill is required to generate a Delhivery shipping label.')
    }

    const pdf = normalizeBoolean(source.pdf, false)
    const pdfSize = normalizePdfSize(source.pdf_size ?? source.pdfSize)
    const headers = await this.getHeaders({ includeContentType: false })

    try {
      const response = await axios.get(`${this.apiBase}/api/p/packing_slip`, {
        headers,
        params: {
          wbns: waybill,
          pdf,
          ...(pdfSize ? { pdf_size: pdfSize } : {}),
        },
        timeout: 30000,
      })
      const raw = parseRaw(response.data)
      const explicitFailure =
        raw?.error === true ||
        (typeof raw?.error === 'string' && raw.error.trim().length > 0) ||
        raw?.success === false ||
        raw?.Success === false ||
        String(raw?.status || '').toLowerCase() === 'fail'

      this.log(explicitFailure ? 'Generate label rejected' : 'Generate label succeeded', {
        waybill,
        pdf,
        pdfSize: pdfSize || null,
        status: response.status,
        response: explicitFailure ? raw : undefined,
      })

      if (explicitFailure) {
        throw new HttpError(
          502,
          this.extractErrorMessage(raw, 'Delhivery shipping label generation failed.'),
        )
      }

      return {
        waybill,
        pdf,
        pdfSize,
        labelUrl: pdf ? extractFirstUrl(raw) : null,
        packages: getPackages(raw),
        raw,
      }
    } catch (error: any) {
      if (error instanceof HttpError) {
        throw error
      }

      const status = Number(error?.response?.status || 502)
      const responseData = parseRaw(error?.response?.data)
      const message =
        this.extractErrorMessage(responseData, '') ||
        error?.message ||
        'Delhivery shipping label generation failed'

      this.log('Generate label failed', {
        waybill,
        pdf,
        pdfSize: pdfSize || null,
        status,
        response: responseData || null,
        message,
      })

      throw new HttpError(status, message)
    }
  }

  async downloadDocument(params: DeliveryOneDocumentParams): Promise<DeliveryOneDocumentResponse> {
    const sanitizeString = (value?: string | number | null) => {
      if (value === undefined || value === null) return ''
      return String(value).trim()
    }
    const normalizeDocType = (value: unknown) => {
      const normalized = sanitizeString(value as any).toUpperCase()
      const allowed = ['SIGNATURE_URL', 'RVP_QC_IMAGE', 'EPOD', 'SELLER_RETURN_IMAGE']
      if (!allowed.includes(normalized)) {
        throw new HttpError(
          400,
          `doc_type must be one of: ${allowed.join(', ')}.`,
        )
      }
      return normalized
    }
    const extractFirstUrl = (value: any): string | null => {
      if (!value) return null
      if (typeof value === 'string') {
        const directMatch = value.match(/https?:\/\/[^\s"'<>]+/i)
        return directMatch?.[0] ?? null
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          const url = extractFirstUrl(item)
          if (url) return url
        }
        return null
      }
      if (typeof value === 'object') {
        const preferredKeys = [
          'document_url',
          'documentUrl',
          'doc_url',
          'docUrl',
          'signature_url',
          'signatureUrl',
          'epod',
          'url',
        ]
        for (const key of preferredKeys) {
          const url = extractFirstUrl(value[key])
          if (url) return url
        }
        for (const nestedValue of Object.values(value)) {
          const url = extractFirstUrl(nestedValue)
          if (url) return url
        }
      }
      return null
    }

    const waybill = sanitizeString(params.waybill)
    if (!waybill) {
      throw new HttpError(400, 'waybill is required to download a Delhivery document.')
    }
    const docType = normalizeDocType(params.doc_type ?? params.docType)
    const headers = await this.getHeaders({ includeContentType: false })

    try {
      const response = await axios.get(`${this.apiBase}/api/rest/fetch/pkg/document/`, {
        headers,
        params: {
          doc_type: docType,
          waybill,
        },
        timeout: 30000,
      })
      const raw = response.data
      const explicitFailure =
        raw?.error === true ||
        (typeof raw?.error === 'string' && raw.error.trim().length > 0) ||
        raw?.success === false ||
        raw?.Success === false ||
        String(raw?.status || '').toLowerCase() === 'fail'

      this.log(explicitFailure ? 'Document download rejected' : 'Document download fetched', {
        waybill,
        docType,
        status: response.status,
        response: explicitFailure ? raw : undefined,
      })

      if (explicitFailure) {
        throw new HttpError(
          502,
          this.extractErrorMessage(raw, 'Delhivery document download failed.'),
        )
      }

      return {
        waybill,
        docType,
        documentUrl: extractFirstUrl(raw),
        raw,
      }
    } catch (error: any) {
      if (error instanceof HttpError) {
        throw error
      }

      const status = Number(error?.response?.status || 502)
      const message =
        this.extractErrorMessage(error?.response?.data, '') ||
        error?.message ||
        'Delhivery document download failed'

      this.log('Document download failed', {
        waybill,
        docType,
        status,
        response: error?.response?.data || null,
        message,
      })

      throw new HttpError(status, message)
    }
  }

  async submitNdrAction(
    input:
      | DeliveryOneNdrActionPayload[]
      | { data?: DeliveryOneNdrActionPayload[]; actions?: DeliveryOneNdrActionPayload[] },
  ): Promise<DeliveryOneNdrActionResponse> {
    const sanitizeString = (value?: string | number | null) => {
      if (value === undefined || value === null) return ''
      return String(value).trim()
    }
    const normalizeAct = (value: unknown): 'RE-ATTEMPT' | 'PICKUP_RESCHEDULE' => {
      const normalized = sanitizeString(value as any).toUpperCase().replace(/\s+/g, '_')
      if (normalized === 'RE-ATTEMPT' || normalized === 'RE_ATTEMPT') return 'RE-ATTEMPT'
      if (normalized === 'PICKUP_RESCHEDULE' || normalized === 'DEFER_DLV') {
        return 'PICKUP_RESCHEDULE'
      }
      throw new HttpError(400, 'NDR act must be RE-ATTEMPT or PICKUP_RESCHEDULE.')
    }
    const extractRequestId = (raw: any): string | null => {
      const candidates = [
        raw?.request_id,
        raw?.requestId,
        raw?.upl,
        raw?.upl_id,
        raw?.UPL,
        raw?.Upl,
        raw?.data?.request_id,
        raw?.data?.requestId,
        raw?.data?.upl,
        raw?.data?.upl_id,
      ]
      for (const candidate of candidates) {
        const normalized = sanitizeString(candidate as any)
        if (normalized) return normalized
      }
      return null
    }

    const source = Array.isArray(input) ? input : input?.data ?? input?.actions ?? []
    if (!Array.isArray(source) || !source.length) {
      throw new HttpError(400, 'At least one NDR action is required.')
    }

    const data = source.map((action) => {
      const waybill = sanitizeString(action?.waybill)
      if (!waybill) throw new HttpError(400, 'waybill is required for every NDR action.')
      const actionData = action?.action_data ?? action?.actionData
      return {
        waybill,
        act: normalizeAct(action?.act),
        ...(actionData && Object.keys(actionData).length ? { action_data: actionData } : {}),
      }
    })

    const payload = { data }
    const headers = await this.getHeaders()

    try {
      const response = await axios.post(`${this.apiBase}/api/p/update`, payload, {
        headers,
        timeout: 30000,
      })
      const raw = response.data
      const explicitFailure =
        raw?.error === true ||
        (typeof raw?.error === 'string' && raw.error.trim().length > 0) ||
        raw?.success === false ||
        raw?.Success === false ||
        String(raw?.status || '').toLowerCase() === 'fail'

      this.log(explicitFailure ? 'NDR action rejected' : 'NDR action submitted', {
        count: data.length,
        status: response.status,
        response: explicitFailure ? raw : undefined,
      })

      if (explicitFailure) {
        throw new HttpError(
          502,
          this.extractErrorMessage(raw, 'Delhivery NDR action failed.'),
        )
      }

      return {
        payload,
        requestId: extractRequestId(raw),
        raw,
      }
    } catch (error: any) {
      if (error instanceof HttpError) {
        throw error
      }

      const status = Number(error?.response?.status || 502)
      const message =
        this.extractErrorMessage(error?.response?.data, '') ||
        error?.message ||
        'Delhivery NDR action failed'

      this.log('NDR action failed', {
        count: data.length,
        status,
        response: error?.response?.data || null,
        message,
      })

      throw new HttpError(status, message)
    }
  }

  async getNdrStatus(uplId: string, verbose = true): Promise<DeliveryOneNdrStatusResponse> {
    const normalizedUplId = String(uplId || '').trim()
    if (!normalizedUplId) {
      throw new HttpError(400, 'uplId is required to fetch Delhivery NDR status.')
    }

    const headers = await this.getHeaders({ includeContentType: false })

    try {
      const response = await axios.get(
        `${this.apiBase}/api/cmu/get_bulk_upl/${encodeURIComponent(normalizedUplId)}`,
        {
          headers,
          params: { verbose: verbose ? 'true' : 'false' },
          timeout: 30000,
        },
      )
      const raw = response.data
      const explicitFailure =
        raw?.error === true ||
        (typeof raw?.error === 'string' && raw.error.trim().length > 0) ||
        raw?.success === false ||
        raw?.Success === false ||
        String(raw?.status || '').toLowerCase() === 'fail'

      this.log(explicitFailure ? 'NDR status rejected' : 'NDR status fetched', {
        uplId: normalizedUplId,
        verbose,
        status: response.status,
        response: explicitFailure ? raw : undefined,
      })

      if (explicitFailure) {
        throw new HttpError(
          502,
          this.extractErrorMessage(raw, 'Delhivery NDR status lookup failed.'),
        )
      }

      return {
        uplId: normalizedUplId,
        verbose,
        raw,
      }
    } catch (error: any) {
      if (error instanceof HttpError) {
        throw error
      }

      const status = Number(error?.response?.status || 502)
      const message =
        this.extractErrorMessage(error?.response?.data, '') ||
        error?.message ||
        'Delhivery NDR status lookup failed'

      this.log('NDR status failed', {
        uplId: normalizedUplId,
        verbose,
        status,
        response: error?.response?.data || null,
        message,
      })

      throw new HttpError(status, message)
    }
  }

  async createPickupRequest(
    params: DeliveryOnePickupRequestPayload,
  ): Promise<DeliveryOnePickupRequestResponse> {
    const formatLocalDateOnly = (date: Date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    const sanitizeString = (value?: string | number | Date | null) => {
      if (value === undefined || value === null) return ''
      if (value instanceof Date) return formatLocalDateOnly(value)
      return String(value).trim()
    }
    const normalizeDate = (value: unknown) => {
      const normalized =
        value instanceof Date
          ? formatLocalDateOnly(value)
          : sanitizeString(value as any)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
        throw new HttpError(400, 'pickup_date must be in YYYY-MM-DD format.')
      }
      return normalized
    }
    const normalizeTime = (value: unknown) => {
      const normalized = sanitizeString(value as any)
      const withSeconds = /^\d{2}:\d{2}$/.test(normalized)
        ? `${normalized}:00`
        : normalized
      if (!/^\d{2}:\d{2}:\d{2}$/.test(withSeconds)) {
        throw new HttpError(400, 'pickup_time must be in hh:mm:ss format.')
      }
      return withSeconds
    }
    const normalizeCount = (value: unknown) => {
      const parsed = Number(value)
      if (!Number.isFinite(parsed) || parsed < 1) {
        throw new HttpError(400, 'expected_package_count must be at least 1.')
      }
      return Math.floor(parsed)
    }

    const payload = {
      pickup_time: normalizeTime(params.pickup_time ?? params.pickupTime),
      pickup_date: normalizeDate(params.pickup_date ?? params.pickupDate),
      pickup_location: sanitizeString(params.pickup_location ?? params.pickupLocation),
      expected_package_count: normalizeCount(
        params.expected_package_count ??
          params.expectedPackageCount ??
          params.package_count ??
          params.count,
      ),
    }

    if (!payload.pickup_location) {
      throw new HttpError(
        400,
        'pickup_location is required and must match the registered Delhivery warehouse name.',
      )
    }

    const headers = await this.getHeaders()

    try {
      const postPickupFormFields = async () => {
        const token = await this.getToken()
        return axios.post(`${this.apiBase}/fm/request/new/`, qs.stringify(payload), {
          headers: {
            Authorization: `Token ${token}`,
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 30000,
        })
      }

      let response
      try {
        response = await axios.post(`${this.apiBase}/fm/request/new/`, payload, {
          headers,
          timeout: 30000,
        })
      } catch (error: any) {
        const status = Number(error?.response?.status)
        if (![400, 415, 422].includes(status)) {
          throw error
        }

        this.log('Pickup request JSON rejected, retrying as form-encoded', {
          pickupDate: payload.pickup_date,
          pickupTime: payload.pickup_time,
          pickupLocation: payload.pickup_location,
          expectedPackageCount: payload.expected_package_count,
          status,
          response: error?.response?.data || null,
        })
        response = await postPickupFormFields()
      }
      const raw = response.data
      const extractedMessage = this.extractErrorMessage(raw, '')
      const pickupId = raw?.pickup_id ?? raw?.data?.pickup_id ?? null
      const rawText = (() => {
        try {
          return JSON.stringify(raw)
        } catch {
          return String(raw || '')
        }
      })().toLowerCase()
      const existingPickupRequest =
        raw?.pr_exist === true ||
        Number(raw?.error?.code || 0) === 669 ||
        extractedMessage.toLowerCase().includes('already exist') ||
        rawText.includes('pickup request') && rawText.includes('already exist')
      const statusText = String(raw?.status ?? raw?.Status ?? '').trim().toLowerCase()
      const accepted =
        existingPickupRequest ||
        Boolean(pickupId) ||
        raw?.success === true ||
        raw?.Success === true ||
        raw?.status === true ||
        ['success', 'succeeded', 'created', 'scheduled'].includes(statusText)
      const explicitFailure =
        !existingPickupRequest &&
        (raw?.error === true ||
          (typeof raw?.error === 'string' && raw.error.trim().length > 0) ||
          raw?.success === false ||
          raw?.Success === false ||
          ['fail', 'failed', 'error', 'false'].includes(statusText))

      this.log(
        existingPickupRequest
          ? 'Pickup request already exists'
          : explicitFailure || !accepted
            ? 'Pickup request rejected'
            : 'Pickup request created',
        {
          pickupDate: payload.pickup_date,
          pickupTime: payload.pickup_time,
          pickupLocation: payload.pickup_location,
          expectedPackageCount: payload.expected_package_count,
          status: response.status,
          response: explicitFailure || existingPickupRequest || !accepted ? raw : undefined,
        },
      )

      if (explicitFailure || !accepted) {
        throw new HttpError(
          502,
          this.extractErrorMessage(raw, 'Delhivery pickup request failed.'),
        )
      }

      return {
        payload,
        existing: existingPickupRequest,
        pickupId,
        raw,
      }
    } catch (error: any) {
      if (error instanceof HttpError) {
        throw error
      }

      const status = Number(error?.response?.status || 502)
      const message =
        this.extractErrorMessage(error?.response?.data, '') ||
        error?.message ||
        'Delhivery pickup request failed'

      this.log('Pickup request failed', {
        pickupDate: payload.pickup_date,
        pickupTime: payload.pickup_time,
        pickupLocation: payload.pickup_location,
        expectedPackageCount: payload.expected_package_count,
        status,
        response: error?.response?.data || null,
        message,
      })

      throw new HttpError(status, message)
    }
  }

  async createWarehouse(
    params: DeliveryOneWarehousePayload,
  ): Promise<DeliveryOneWarehouseResponse> {
    const sanitizeString = (value?: string | number | null) => {
      if (value === undefined || value === null) return ''
      return String(value).trim()
    }
    const sanitizePhone = (value?: string | number | null) => {
      const digits = String(value || '').replace(/\D/g, '')
      if (digits.length < 10) {
        throw new HttpError(400, 'phone must contain at least 10 digits.')
      }
      return digits.slice(-10)
    }
    const sanitizePincode = (value?: string | number | null, field = 'pin') => {
      const digits = String(value || '').replace(/\D/g, '').slice(0, 6)
      if (!/^\d{6}$/.test(digits)) {
        throw new HttpError(400, `${field} must be a valid 6-digit pincode.`)
      }
      return digits
    }
    const optionalPincode = (value?: string | number | null, field = 'return_pin') => {
      if (value === undefined || value === null || value === '') return undefined
      return sanitizePincode(value, field)
    }

    const address = sanitizeString(params.address)
    const returnAddress = sanitizeString(params.return_address ?? params.returnAddress) || address
    const resolvedAddress = address || returnAddress
    const country = sanitizeString(params.country) || 'India'
    const payload: DeliveryOneWarehouseResponse['payload'] = {
      name: sanitizeString(params.name),
      phone: sanitizePhone(params.phone),
      pin: sanitizePincode(params.pin ?? params.pincode, 'pin'),
      address: resolvedAddress,
      return_address: returnAddress || resolvedAddress,
    }

    if (!payload.name) {
      throw new HttpError(
        400,
        'name is required and is case-sensitive for Delhivery warehouse registration.',
      )
    }
    if (!payload.return_address) {
      throw new HttpError(400, 'return_address is required for Delhivery warehouse registration.')
    }
    if (!payload.address) {
      throw new HttpError(400, 'address is required for Delhivery warehouse registration.')
    }

    const registeredName = sanitizeString(params.registered_name ?? params.registeredName)
    const email = sanitizeString(params.email)
    const city = sanitizeString(params.city)
    const returnCity = sanitizeString(params.return_city ?? params.returnCity) || city
    const returnState = sanitizeString(params.return_state ?? params.returnState)
    const returnCountry =
      sanitizeString(params.return_country ?? params.returnCountry) || country
    const returnPin = optionalPincode(params.return_pin ?? params.returnPin, 'return_pin')

    if (registeredName) payload.registered_name = registeredName
    if (email) payload.email = email
    if (city) payload.city = city
    if (country) payload.country = country
    if (returnCity) payload.return_city = returnCity
    if (returnPin) payload.return_pin = returnPin
    if (returnState) payload.return_state = returnState
    if (returnCountry) payload.return_country = returnCountry

    const headers = await this.getHeaders()

    try {
      const response = await axios.post(
        `${this.apiBase}/api/backend/clientwarehouse/create/`,
        payload,
        {
          headers,
          timeout: 30000,
        },
      )
      const raw = response.data
      const explicitFailure =
        raw?.error === true ||
        (typeof raw?.error === 'string' && raw.error.trim().length > 0) ||
        (Array.isArray(raw?.error) && raw.error.length > 0) ||
        raw?.success === false ||
        raw?.Success === false ||
        String(raw?.status || '').toLowerCase() === 'fail'

      this.log(explicitFailure ? 'Warehouse creation rejected' : 'Warehouse created', {
        name: payload.name,
        pin: payload.pin,
        status: response.status,
        response: explicitFailure ? raw : undefined,
      })

      if (explicitFailure) {
        throw new HttpError(
          502,
          this.extractErrorMessage(raw, 'Delhivery warehouse creation failed.'),
        )
      }

      return {
        payload,
        raw,
      }
    } catch (error: any) {
      if (error instanceof HttpError) {
        throw error
      }

      const status = Number(error?.response?.status || 502)
      const message =
        this.extractErrorMessage(error?.response?.data, '') ||
        error?.message ||
        'Delhivery warehouse creation failed'

      this.log('Warehouse creation failed', {
        name: payload.name,
        pin: payload.pin,
        status,
        response: error?.response?.data || null,
        message,
      })

      throw new HttpError(status, message)
    }
  }

  async updateWarehouse(
    params: DeliveryOneWarehouseUpdatePayload,
  ): Promise<DeliveryOneWarehouseUpdateResponse> {
    const sanitizeString = (value?: string | number | null) => {
      if (value === undefined || value === null) return ''
      return String(value).trim()
    }
    const sanitizePhone = (value?: string | number | null) => {
      if (value === undefined || value === null || value === '') return undefined
      const digits = String(value).replace(/\D/g, '')
      if (digits.length < 10) {
        throw new HttpError(400, 'phone must contain at least 10 digits.')
      }
      return digits.slice(-10)
    }
    const sanitizePincode = (value?: string | number | null) => {
      if (value === undefined || value === null || value === '') return undefined
      const digits = String(value).replace(/\D/g, '').slice(0, 6)
      if (!/^\d{6}$/.test(digits)) {
        throw new HttpError(400, 'pin must be a valid 6-digit pincode.')
      }
      return digits
    }

    const payload: DeliveryOneWarehouseUpdateResponse['payload'] = {
      name: sanitizeString(params.name ?? params.warehouseName),
    }
    const address = sanitizeString(params.address)
    const phone = sanitizePhone(params.phone)
    const pin = sanitizePincode(params.pin ?? params.pincode)

    if (!payload.name) {
      throw new HttpError(
        400,
        'name is required and must match the existing Delhivery warehouse name.',
      )
    }
    if (address) payload.address = address
    if (phone) payload.phone = phone
    if (pin) payload.pin = pin
    if (!payload.address && !payload.phone && !payload.pin) {
      throw new HttpError(
        400,
        'Provide at least one warehouse field to update: address, pin, or phone.',
      )
    }

    const headers = await this.getHeaders()

    try {
      const response = await axios.post(
        `${this.apiBase}/api/backend/clientwarehouse/edit/`,
        payload,
        {
          headers,
          timeout: 30000,
        },
      )
      const raw = response.data
      const explicitFailure =
        raw?.error === true ||
        (typeof raw?.error === 'string' && raw.error.trim().length > 0) ||
        (Array.isArray(raw?.error) && raw.error.length > 0) ||
        raw?.success === false ||
        raw?.Success === false ||
        String(raw?.status || '').toLowerCase() === 'fail'

      this.log(explicitFailure ? 'Warehouse update rejected' : 'Warehouse updated', {
        name: payload.name,
        hasAddress: Boolean(payload.address),
        hasPhone: Boolean(payload.phone),
        hasPin: Boolean(payload.pin),
        status: response.status,
        response: explicitFailure ? raw : undefined,
      })

      if (explicitFailure) {
        throw new HttpError(
          502,
          this.extractErrorMessage(raw, 'Delhivery warehouse update failed.'),
        )
      }

      return {
        payload,
        raw,
      }
    } catch (error: any) {
      if (error instanceof HttpError) {
        throw error
      }

      const status = Number(error?.response?.status || 502)
      const message =
        this.extractErrorMessage(error?.response?.data, '') ||
        error?.message ||
        'Delhivery warehouse update failed'

      this.log('Warehouse update failed', {
        name: payload.name,
        status,
        response: error?.response?.data || null,
        message,
      })

      throw new HttpError(status, message)
    }
  }

  async calculateShippingCost(
    params: DeliveryOneShippingCostParams,
  ): Promise<DeliveryOneShippingCostResponse> {
    const sanitizeString = (value?: string | number | null) => {
      if (value === undefined || value === null) return ''
      return String(value).trim()
    }
    const sanitizePincode = (value?: string | number | null) =>
      sanitizeString(value).replace(/\D/g, '').slice(0, 6)
    const toInteger = (value: unknown, field: string, required = false) => {
      if (value === undefined || value === null || value === '') {
        if (required) throw new HttpError(400, `${field} is required.`)
        return undefined
      }
      const parsed = Number(value)
      if (!Number.isFinite(parsed) || parsed < 0) {
        throw new HttpError(400, `${field} must be a non-negative number.`)
      }
      return Math.round(parsed)
    }
    const normalizeBillingMode = (value: unknown): 'E' | 'S' => {
      const normalized = sanitizeString(value as any).toLowerCase()
      if (['e', 'express', 'air'].includes(normalized)) return 'E'
      if (['s', 'surface'].includes(normalized)) return 'S'
      throw new HttpError(400, 'md billing mode must be E/Express or S/Surface.')
    }
    const normalizeStatus = (value: unknown): 'Delivered' | 'RTO' | 'DTO' => {
      const normalized = sanitizeString(value as any).toLowerCase()
      if (normalized === 'delivered') return 'Delivered'
      if (normalized === 'rto') return 'RTO'
      if (normalized === 'dto') return 'DTO'
      throw new HttpError(400, 'ss shipment status must be Delivered, RTO, or DTO.')
    }
    const normalizePaymentType = (value: unknown): 'Pre-paid' | 'COD' => {
      const normalized = sanitizeString(value as any).toLowerCase()
      if (['cod', 'cash on delivery'].includes(normalized)) return 'COD'
      if (['pre-paid', 'prepaid', 'pre paid'].includes(normalized)) return 'Pre-paid'
      throw new HttpError(400, 'pt payment type must be Pre-paid or COD.')
    }
    const normalizePackageType = (value: unknown) => {
      const normalized = sanitizeString(value as any).toLowerCase()
      if (!normalized) return undefined
      if (['box', 'flyer'].includes(normalized)) return normalized
      throw new HttpError(400, 'ipkg_type must be box or flyer when provided.')
    }
    const firstRecord = (raw: any) => {
      if (Array.isArray(raw)) return raw[0] ?? null
      if (Array.isArray(raw?.data)) return raw.data[0] ?? null
      if (Array.isArray(raw?.charges)) return raw.charges[0] ?? null
      if (raw?.data && typeof raw.data === 'object') return raw.data
      return raw && typeof raw === 'object' ? raw : null
    }
    const pickNumber = (record: any, keys: string[]) => {
      if (!record) return null
      for (const key of keys) {
        const value = record?.[key]
        if (value === undefined || value === null || value === '') continue
        const parsed = Number(String(value).replace(/,/g, ''))
        if (Number.isFinite(parsed)) return parsed
      }
      return null
    }

    const originPincode = sanitizePincode(
      params.o_pin ?? params.origin_pincode ?? params.originPincode ?? params.origin,
    )
    const destinationPincode = sanitizePincode(
      params.d_pin ??
        params.destination_pincode ??
        params.destinationPincode ??
        params.destination,
    )
    if (!/^\d{6}$/.test(originPincode)) {
      throw new HttpError(400, 'A valid 6-digit origin pincode is required.')
    }
    if (!/^\d{6}$/.test(destinationPincode)) {
      throw new HttpError(400, 'A valid 6-digit destination pincode is required.')
    }

    const requestParams: DeliveryOneShippingCostResponse['params'] = {
      md: normalizeBillingMode(params.md ?? params.billing_mode ?? params.billingMode),
      cgm: toInteger(
        params.cgm ?? params.chargeable_weight ?? params.chargeableWeight ?? params.weight,
        'cgm chargeable weight',
        true,
      )!,
      o_pin: originPincode,
      d_pin: destinationPincode,
      ss: normalizeStatus(params.ss ?? params.status),
      pt: normalizePaymentType(params.pt ?? params.payment_type ?? params.paymentType),
    }

    const length = toInteger(params.l ?? params.length, 'l length')
    const breadth = toInteger(params.b ?? params.breadth ?? params.width, 'b breadth')
    const height = toInteger(params.h ?? params.height, 'h height')
    const packageType = normalizePackageType(
      params.ipkg_type ?? params.package_type ?? params.packageType,
    )

    if (length !== undefined) requestParams.l = length
    if (breadth !== undefined) requestParams.b = breadth
    if (height !== undefined) requestParams.h = height
    if (packageType) requestParams.ipkg_type = packageType

    const headers = await this.getHeaders({ includeContentType: false })

    try {
      const response = await axios.get(`${this.apiBase}/api/kinko/v1/invoice/charges/.json`, {
        headers,
        params: requestParams,
        timeout: 30000,
      })
      const raw = response.data
      const explicitFailure =
        raw?.error === true ||
        (typeof raw?.error === 'string' && raw.error.trim().length > 0) ||
        raw?.success === false ||
        raw?.Success === false ||
        String(raw?.status || '').toLowerCase() === 'fail'

      this.log(explicitFailure ? 'Shipping cost rejected' : 'Shipping cost calculated', {
        origin: requestParams.o_pin,
        destination: requestParams.d_pin,
        billingMode: requestParams.md,
        paymentType: requestParams.pt,
        status: response.status,
        response: explicitFailure ? raw : undefined,
      })

      if (explicitFailure) {
        throw new HttpError(
          502,
          this.extractErrorMessage(raw, 'Delhivery shipping cost calculation failed.'),
        )
      }

      const record = firstRecord(raw)
      return {
        params: requestParams,
        charges: {
          total: pickNumber(record, [
            'total_amount',
            'total_charge',
            'total_charges',
            'Total Amount',
            'Total Charge',
            'Total Charges',
            'amount',
          ]),
          freight: pickNumber(record, [
            'freight_charge',
            'freight_charges',
            'Freight Charge',
            'Freight Charges',
            'shipping_charge',
            'Shipping Charge',
          ]),
          cod: pickNumber(record, [
            'cod_charge',
            'cod_charges',
            'COD Charge',
            'COD Charges',
          ]),
          chargeableWeight: pickNumber(record, [
            'chargeable_weight',
            'Chargeable Weight',
            'ChargeableWeight',
            'Charge_Billable_Weight',
            'Charge_Weight',
            'cgm',
          ]),
        },
        raw,
      }
    } catch (error: any) {
      if (error instanceof HttpError) {
        throw error
      }

      const status = Number(error?.response?.status || 502)
      const message =
        this.extractErrorMessage(error?.response?.data, '') ||
        error?.message ||
        'Delhivery shipping cost calculation failed'

      this.log('Shipping cost failed', {
        origin: requestParams.o_pin,
        destination: requestParams.d_pin,
        billingMode: requestParams.md,
        paymentType: requestParams.pt,
        status,
        response: error?.response?.data || null,
        message,
      })

      throw new HttpError(status, message)
    }
  }

  async createShipment(params: ShipmentParams, providedWaybills?: string | string[]) {
    const sanitizeString = (value?: string | number | null) => {
      if (value === undefined || value === null) return ''
      return String(value).trim()
    }
    const sanitizePhone = (value?: string | number | null) => {
      const digits = String(value || '').replace(/\D/g, '')
      return digits.length >= 10 ? digits.slice(-10) : digits
    }
    const sanitizePincode = (value?: string | number | null) => {
      if (value === undefined || value === null) return ''
      return String(value).replace(/\D/g, '').slice(0, 6)
    }
    const sanitizeBoolean = (value?: boolean | string | number | null) => {
      if (value === undefined || value === null) return undefined
      if (typeof value === 'boolean') return value
      const normalized = String(value).trim().toLowerCase()
      return ['true', '1', 'yes', 'y'].includes(normalized)
    }
    const toPositiveNumber = (value: unknown, fallback: number) => {
      const parsed = Number(value)
      return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
    }
    const normalizeDate = (value: unknown) => {
      if (value instanceof Date) return value.toISOString().split('T')[0]
      const normalized = sanitizeString(value as any)
      return normalized || new Date().toISOString().split('T')[0]
    }
    const normalizeWaybillList = (...values: unknown[]) =>
      values
        .flatMap((value) => {
          if (Array.isArray(value)) return value
          if (typeof value === 'string') return value.split(/[,\s]+/)
          if (value === undefined || value === null) return []
          return [value]
        })
        .map((value) => sanitizeString(value as any))
        .filter(Boolean)

    const pickup = params.pickup || ({} as ShipmentParams['pickup'])
    const consignee = params.consignee || ({} as ShipmentParams['consignee'])
    const rto = params.rto
    const boxes = Array.isArray(params.boxes) ? params.boxes : []
    const orderItems = Array.isArray(params.order_items) ? params.order_items : []
    const orderNumber = sanitizeString(params.order_number)
    const orderAmount = Number(params.order_amount ?? 0)
    const invoiceNumber = sanitizeString(params.invoice_number) || orderNumber

    if (!orderNumber) {
      throw new HttpError(400, 'order_number is required to create a Delhivery shipment.')
    }
    if (orderAmount <= 0 || Number.isNaN(orderAmount)) {
      throw new HttpError(
        400,
        'order_amount is required and must be a positive number for Delhivery shipment creation.',
      )
    }

    const consigneePhone = sanitizePhone(consignee.phone)
    if (!consigneePhone) {
      throw new HttpError(
        400,
        'Consignee phone must contain at least 10 digits for Delhivery shipments.',
      )
    }

    const pickupPhone = sanitizePhone(pickup.phone)
    if (!pickupPhone) {
      throw new HttpError(400, 'Valid pickup phone is required for Delhivery shipments.')
    }

    const destinationPin = sanitizePincode(consignee.pincode)
    if (!/^\d{6}$/.test(destinationPin)) {
      throw new HttpError(400, 'A valid 6-digit destination pincode is required.')
    }

    const pickupLocationName = sanitizeString(pickup.warehouse_name || params.pickup_location_alias)
    if (!pickupLocationName) {
      throw new HttpError(
        400,
        'Delhivery pickup_location.name is required and must match the registered warehouse name.',
      )
    }

    const selectedShippingMode =
      getDelhiveryShippingModeByCourierId(normalizeCourierId(params.courier_id)) ||
      normalizeDelhiveryShippingMode((params as any).shipping_mode) ||
      'Surface'
    const selectedModeCode = getDelhiveryModeCodeByShippingMode(selectedShippingMode)
    const paymentType = sanitizeString(params.payment_type).toLowerCase()
    const paymentMode =
      paymentType === 'cod'
        ? 'COD'
        : paymentType === 'reverse'
          ? 'Pickup'
          : paymentType === 'replacement'
            ? 'REPL'
            : 'Prepaid'
    const codAmount = paymentMode === 'COD' ? Number((params as any).cod_amount ?? orderAmount) : 0
    const productNames = orderItems
      .map((item) => sanitizeString(item?.name))
      .filter((name) => name.length > 0)
    const productsDesc =
      sanitizeString((params as any).products_desc) ||
      (productNames.length ? productNames.join(', ') : 'General Merchandise')
    const hsnCodes = Array.from(
      new Set(
        orderItems
          .map((item) => sanitizeString(item?.hsn || item?.hsnCode))
          .filter((code) => code.length > 0),
      ),
    )
    const quantity =
      params.quantity !== undefined && params.quantity !== null
        ? sanitizeString(params.quantity)
        : String(orderItems.reduce((sum, item) => sum + Number(item?.qty ?? item?.quantity ?? 0), 0) || 1)
    const pickupAddress = [pickup.address, pickup.address_2]
      .map((part) => sanitizeString(part))
      .filter(Boolean)
      .join(', ')
    const sellerName = sanitizeString(params.company?.name || pickup.name || 'ChoiceMee')
    const sellerGst = sanitizeString(params.company?.gst || pickup.gst_number || '')
    const returnAddress =
      rto && (params.is_rto_different === 'yes' || paymentMode === 'Pickup' || paymentMode === 'REPL')
        ? rto
        : paymentMode === 'Pickup' || paymentMode === 'REPL'
          ? pickup
          : null
    const isMps = params.mps === true || boxes.length > 1 || String((params as any).shipment_type || '').toUpperCase() === 'MPS'
    const packageCount = isMps ? Math.max(boxes.length, 2) : 1
    let waybills = normalizeWaybillList(
      providedWaybills,
      (params as any).waybills,
      (params as any).waybill,
      boxes.map((box: any) => box?.waybill),
    )

    if (isMps && waybills.length < packageCount) {
      const fetched = await this.fetchWaybills(packageCount - waybills.length)
      waybills = [...waybills, ...fetched.waybills]
    }

    if (isMps && waybills.length < packageCount) {
      throw new HttpError(
        400,
        `Delhivery MPS shipment requires ${packageCount} prefetched waybills. Received ${waybills.length}.`,
      )
    }

    const baseShipment: Record<string, any> = {
      order: orderNumber,
      order_date: normalizeDate(params.order_date),
      name: sanitizeString(consignee.name),
      phone: consigneePhone,
      add: sanitizeString(consignee.address),
      city: sanitizeString(consignee.city),
      state: sanitizeString(consignee.state),
      pin: destinationPin,
      country: sanitizeString(consignee.country || params.country) || 'India',
      payment_mode: paymentMode,
      cod_amount: codAmount,
      total_amount: orderAmount,
      products_desc: productsDesc,
      hsn_code: hsnCodes.join(', '),
      seller_inv: invoiceNumber,
      quantity,
      seller_name: sellerName,
      seller_add: pickupAddress || pickupLocationName,
      shipment_width: toPositiveNumber(params.package_breadth ?? params.breadth, 10),
      shipment_height: toPositiveNumber(params.package_height ?? params.height, 10),
      shipment_length: toPositiveNumber(params.package_length ?? params.length, 10),
      weight: toPositiveNumber(params.package_weight ?? params.weight, 0.5),
      shipping_mode: selectedShippingMode,
      mot: selectedModeCode,
      address_type: sanitizeString(params.address_type),
    }

    const ewbnValue =
      params.ewbn || params.ewb || params.ewbn_number || params.ewaybill_number || undefined
    if (ewbnValue) baseShipment.ewbn = sanitizeString(ewbnValue)
    if (params.transport_speed) baseShipment.transport_speed = sanitizeString(params.transport_speed)
    if (params.dangerous_good !== undefined) {
      baseShipment.dangerous_good = sanitizeBoolean(params.dangerous_good)
    }
    if (params.fragile_shipment !== undefined) {
      baseShipment.fragile_shipment = sanitizeBoolean(params.fragile_shipment)
    }
    if (params.plastic_packaging !== undefined) {
      baseShipment.plastic_packaging = sanitizeBoolean(params.plastic_packaging)
    }

    if (returnAddress) {
      Object.assign(baseShipment, {
        return_name: sanitizeString(returnAddress.name),
        return_add: sanitizeString(returnAddress.address),
        return_address: sanitizeString(returnAddress.address),
        return_city: sanitizeString(returnAddress.city),
        return_state: sanitizeString(returnAddress.state),
        return_pin: sanitizePincode(returnAddress.pincode),
        return_phone: sanitizePhone(returnAddress.phone),
        return_country: sanitizeString(returnAddress.country) || 'India',
      })
    }

    const shipments = isMps
      ? Array.from({ length: packageCount }).map((_, index) => {
          const box = boxes[index] || {}
          return {
            ...baseShipment,
            order: sanitizeString(box.order || box.order_number) || orderNumber,
            weight: toPositiveNumber(box.weight ?? box.weight_g ?? params.package_weight, baseShipment.weight),
            shipment_length: toPositiveNumber(box.length ?? params.package_length, baseShipment.shipment_length),
            shipment_width: toPositiveNumber(
              box.breadth ?? box.width ?? params.package_breadth,
              baseShipment.shipment_width,
            ),
            shipment_height: toPositiveNumber(box.height ?? params.package_height, baseShipment.shipment_height),
            mps_amount: paymentMode === 'COD' ? Number((params as any).mps_amount ?? codAmount) : 0,
            mps_children: packageCount,
            master_id: sanitizeString((params as any).master_id) || waybills[0],
            shipment_type: 'MPS',
            waybill: waybills[index],
          }
        })
      : [
          {
            ...baseShipment,
            waybill: waybills[0] || undefined,
          },
        ]

    const payload = {
      shipments,
      pickup_location: {
        name: pickupLocationName,
      },
    }

    const getWarehouseErrorText = (error: any) =>
      [
        error?.message,
        error?.details,
        error?.response?.data,
        typeof error === 'string' ? error : '',
      ]
        .map((value) => {
          if (!value) return ''
          if (typeof value === 'string') return value
          try {
            return JSON.stringify(value)
          } catch {
            return String(value)
          }
        })
        .join(' ')
        .toLowerCase()

    const isMissingWarehouseError = (error: any) => {
      const text = getWarehouseErrorText(error)
      return (
        text.includes('clientwarehouse matching query does not exist') ||
        text.includes('clientwarehouse does not exist') ||
        text.includes('client warehouse does not exist') ||
        text.includes('warehouse does not exist') ||
        text.includes('warehouse does not exists') ||
        text.includes('warehouse not found')
      )
    }

    const isDuplicateWarehouseError = (error: any) => {
      const text = getWarehouseErrorText(error)
      return text.includes('already exists') && (text.includes('warehouse') || text.includes('client'))
    }

    const buildWarehouseRepairPayload = () => {
      const pickupPin =
        sanitizePincode(pickup.pincode ?? params.pickup_pincode ?? params.source_pincode ?? params.origin) ||
        sanitizePincode((params as any).pickup_pin)
      const returnSource = returnAddress || pickup
      const returnAddressText = [returnSource?.address, returnSource?.address_2]
        .map((part) => sanitizeString(part))
        .filter(Boolean)
        .join(', ')
      const warehouseAddress = pickupAddress || sanitizeString(pickup.address) || pickupLocationName

      return {
        name: pickupLocationName,
        registered_name: sellerName || 'ChoiceMee',
        phone: pickupPhone,
        email: sanitizeString((pickup as any).email || (pickup as any).contact_email),
        address: warehouseAddress,
        city: sanitizeString(pickup.city),
        pin: pickupPin,
        country: sanitizeString(pickup.country || params.country) || 'India',
        return_address: returnAddressText || warehouseAddress,
        return_city: sanitizeString(returnSource?.city || pickup.city),
        return_pin:
          sanitizePincode(returnSource?.pincode || pickup.pincode || pickupPin) || pickupPin,
        return_state: sanitizeString(returnSource?.state || pickup.state),
        return_country: sanitizeString(returnSource?.country || pickup.country || params.country) || 'India',
      }
    }

    this.log('Create shipment payload summary', {
      order: orderNumber,
      paymentMode,
      pickupLocation: pickupLocationName,
      shippingMode: selectedShippingMode,
      mot: selectedModeCode,
      mps: isMps,
      shipmentCount: shipments.length,
      hasWaybills: waybills.length,
    })

    const submitShipment = async (attempt: 'initial' | 'warehouse-retry' = 'initial') => {
      const response = await this.postFormEncoded('/api/cmu/create.json', payload)
      const responseData = response.data
      const rawPackages = responseData?.packages
      const packages: any[] =
        Array.isArray(rawPackages)
          ? rawPackages
          : rawPackages
            ? [rawPackages]
            : []
      const normalizedStatus = (value?: string) => String(value || '').toLowerCase()
      const normalizeRemarks = (remarks: unknown): string[] => {
        if (!remarks) return []
        if (Array.isArray(remarks)) {
          return remarks.flatMap((entry) => normalizeRemarks(entry)).filter(Boolean)
        }
        if (typeof remarks === 'object') {
          return Object.values(remarks as Record<string, unknown>)
            .flatMap((entry) => normalizeRemarks(entry))
            .filter(Boolean)
        }
        return [String(remarks).trim()].filter(Boolean)
      }
      const successfulPackages = packages.filter(
        (pkg) =>
          pkg?.waybill && pkg?.serviceable !== false && normalizedStatus(pkg?.status) !== 'fail',
      )
      const packageFailures = packages
        .filter(
          (pkg) =>
            normalizedStatus(pkg?.status) === 'fail' ||
            pkg?.serviceable === false ||
            !pkg?.waybill,
        )
        .map((pkg) => ({
          ...pkg,
          remarks: normalizeRemarks(pkg?.remarks),
        }))

      if (
        normalizedStatus(responseData?.status) === 'fail' ||
        responseData?.success === false ||
        responseData?.serviceable === false ||
        !successfulPackages.length
      ) {
        const failureReason =
          responseData?.message ||
          responseData?.status_message ||
          packageFailures
            .map((pkg) => {
              const joinedRemarks = pkg.remarks.join(' | ')
              return joinedRemarks || pkg?.message || pkg?.reason || pkg?.rmk || `status=${pkg?.status}`
            })
            .filter(Boolean)
            .join(' | ') ||
          normalizeRemarks(responseData?.rmk).join(' | ') ||
          'Delhivery reported a failure during shipment creation.'

        this.log('Create shipment rejected', {
          order: orderNumber,
          attempt,
          status: response.status,
          failureReason,
          response: responseData,
        })
        throw new DelhiveryManifestError(502, failureReason, responseData)
      }

      this.log('Create shipment succeeded', {
        order: orderNumber,
        attempt,
        status: response.status,
        packages: successfulPackages.length,
        awb: successfulPackages[0]?.waybill,
      })

      return responseData
    }

    try {
      try {
        return await submitShipment()
      } catch (error: any) {
        if (!(error instanceof DelhiveryManifestError) || !isMissingWarehouseError(error)) {
          throw error
        }

        const warehousePayload = buildWarehouseRepairPayload()
        this.log('Create shipment failed because pickup warehouse is missing; registering and retrying once', {
          order: orderNumber,
          pickupLocation: pickupLocationName,
          pin: warehousePayload.pin,
        })

        try {
          await this.createWarehouse(warehousePayload)
          this.log('Pickup warehouse registered before shipment retry', {
            order: orderNumber,
            pickupLocation: pickupLocationName,
          })
        } catch (warehouseError: any) {
          if (isDuplicateWarehouseError(warehouseError)) {
            this.log('Pickup warehouse already exists before shipment retry', {
              order: orderNumber,
              pickupLocation: pickupLocationName,
            })
          } else {
            this.log('Pickup warehouse repair failed before shipment retry', {
              order: orderNumber,
              pickupLocation: pickupLocationName,
              message: warehouseError?.message || warehouseError,
              response: warehouseError?.response?.data || null,
            })
            throw warehouseError
          }
        }

        return await submitShipment('warehouse-retry')
      }
    } catch (error: any) {
      if (error instanceof DelhiveryManifestError || error instanceof HttpError) {
        throw error
      }

      const status = Number(error?.response?.status || 502)
      const message =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        (typeof error?.response?.data === 'string' ? error.response.data : '') ||
        error?.message ||
        'Delhivery shipment creation failed'

      this.log('Create shipment failed', {
        order: orderNumber,
        status,
        response: error?.response?.data || null,
        message,
      })

      throw new HttpError(status, message)
    }
  }

  async checkPincodeServiceability(
    pincode: string | number,
  ): Promise<DeliveryOnePincodeServiceabilityResponse> {
    const normalizedPincode = String(pincode ?? '').replace(/\D/g, '').slice(0, 6)
    if (!/^\d{6}$/.test(normalizedPincode)) {
      throw new HttpError(400, 'A valid 6-digit pincode is required for Delhivery serviceability.')
    }

    const headers = await this.getHeaders({ includeContentType: false })
    const url = `${this.apiBase}/c/api/pin-codes/json/`

    try {
      const response = await axios.get(url, {
        headers,
        params: { filter_codes: normalizedPincode },
        timeout: 20000,
      })

      const records = this.getRecords(response.data)
      const record = records[0] ?? null
      const postalCode = record?.postal_code ?? {}
      const remarkText = [
        postalCode?.remark,
        postalCode?.remarks,
        postalCode?.status,
        postalCode?.sort_code,
        record?.remark,
        record?.remarks,
        record?.status,
      ]
        .filter((value) => value !== undefined && value !== null)
        .map((value) => String(value).trim())
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      const embargoed =
        this.isAnyYes(postalCode?.embargo, postalCode?.embargoed) ||
        /\b(embargo|nsz|non[-\s]?serviceable|not\s+serviceable|inactive|disabled)\b/i.test(
          remarkText,
        )
      const hasRecord = records.length > 0
      const pickupAvailable =
        hasRecord &&
        this.isAnyYes(
          postalCode?.pickup,
          postalCode?.pickup_available,
          postalCode?.pickupAvailable,
          postalCode?.pickup_enabled,
        )
      const codAvailable =
        hasRecord &&
        this.isAnyYes(
          postalCode?.cod,
          postalCode?.cod_available,
          postalCode?.codAvailable,
          postalCode?.cash,
          postalCode?.cash_on_delivery,
        )
      const prepaidAvailable =
        hasRecord &&
        this.isAnyYes(
          postalCode?.pre_paid,
          postalCode?.prepaid,
          postalCode?.prepaid_available,
          postalCode?.prepaidAvailable,
          postalCode?.pre_paid_available,
        )
      const serviceable = hasRecord && !embargoed

      this.log('B2C pincode serviceability', {
        pincode: normalizedPincode,
        status: response.status,
        records: records.length,
        pickupAvailable,
        codAvailable,
        prepaidAvailable,
        embargoed,
      })

      return {
        serviceable,
        pickupAvailable,
        codAvailable,
        prepaidAvailable,
        embargoed,
        record,
        raw: response.data,
      }
    } catch (error: any) {
      const status = Number(error?.response?.status || 502)
      const message =
        this.extractErrorMessage(error?.response?.data, '') ||
        error?.message ||
        'Delhivery pincode serviceability failed'

      this.log('B2C pincode serviceability failed', {
        pincode: normalizedPincode,
        status,
        response: error?.response?.data || null,
        message,
      })

      throw new HttpError(status, message)
    }
  }

  async checkPairServiceability(params: {
    originPincode: string | number
    destinationPincode: string | number
    paymentType?: 'cod' | 'prepaid' | string
  }): Promise<DeliveryOnePairServiceabilityResponse> {
    const [origin, destination] = await Promise.all([
      this.checkPincodeServiceability(params.originPincode),
      this.checkPincodeServiceability(params.destinationPincode),
    ])

    const requiresCod = String(params.paymentType || 'prepaid').toLowerCase() === 'cod'
    const destinationPaymentServiceable = requiresCod
      ? destination.codAvailable
      : destination.prepaidAvailable
    const serviceable =
      origin.serviceable &&
      origin.pickupAvailable &&
      destination.serviceable &&
      destinationPaymentServiceable

    return {
      serviceable,
      origin,
      destination,
      codAvailable: destination.codAvailable,
      prepaidAvailable: destination.prepaidAvailable,
      raw: {
        origin: origin.raw,
        destination: destination.raw,
      },
    }
  }

  async checkHeavyPincodeServiceability(
    pincode: string | number,
    productType = 'Heavy',
  ): Promise<DeliveryOneHeavyPincodeServiceabilityResponse> {
    const normalizedPincode = String(pincode ?? '').replace(/\D/g, '').slice(0, 6)
    if (!/^\d{6}$/.test(normalizedPincode)) {
      throw new HttpError(
        400,
        'A valid 6-digit pincode is required for Delhivery heavy serviceability.',
      )
    }

    const headers = await this.getHeaders({ includeContentType: false })
    const url = `${this.apiBase}/api/dc/fetch/serviceability/pincode`

    try {
      const response = await axios.get(url, {
        headers,
        params: {
          product_type: productType,
          pincode: normalizedPincode,
        },
        timeout: 20000,
      })

      const raw = response.data
      const records = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.data)
          ? raw.data
          : raw && typeof raw === 'object'
            ? [raw]
            : []

      const normalizedText = JSON.stringify(raw || {}).toLowerCase()
      const serviceable =
        records.length > 0 &&
        !records.some(
          (record: any) => String(record?.status || record?.remark || '').toUpperCase() === 'NSZ',
        ) &&
        !normalizedText.includes('"nsz"')

      const paymentTypes = records
        .map((record: any) =>
          String(record?.payment_type || record?.paymentType || '').toLowerCase(),
        )
        .filter(Boolean)
      const codAvailable =
        serviceable &&
        (paymentTypes.length === 0 || paymentTypes.some((type: string) => type.includes('cod')))
      const prepaidAvailable =
        serviceable &&
        (paymentTypes.length === 0 ||
          paymentTypes.some(
            (type: string) => type.includes('prepaid') || type.includes('pre-paid'),
          ))

      this.log('Heavy pincode serviceability', {
        pincode: normalizedPincode,
        productType,
        status: response.status,
        records: records.length,
        serviceable,
        codAvailable,
        prepaidAvailable,
      })

      return {
        serviceable,
        codAvailable,
        prepaidAvailable,
        records,
        raw,
      }
    } catch (error: any) {
      const status = Number(error?.response?.status || 502)
      const message =
        this.extractErrorMessage(error?.response?.data, '') ||
        error?.message ||
        'Delhivery heavy pincode serviceability failed'

      this.log('Heavy pincode serviceability failed', {
        pincode: normalizedPincode,
        productType,
        status,
        response: error?.response?.data || null,
        message,
      })

      throw new HttpError(status, message)
    }
  }
}

