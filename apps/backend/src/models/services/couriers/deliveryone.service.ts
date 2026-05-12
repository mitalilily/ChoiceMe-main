import axios from 'axios'
import qs from 'qs'
import { DelhiveryManifestError, HttpError } from '../../../utils/classes'
import {
  getDelhiveryShippingModeByCourierId,
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

  private async ensureConfigLoaded() {
    if (DeliveryOneService.cachedConfig === undefined) {
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
      source: cfg ? 'courier_credentials_or_env_fallback' : 'env_only',
    })
  }

  private async getHeaders() {
    await this.ensureConfigLoaded()

    if (!this.apiKey) {
      throw new HttpError(
        400,
        'Delivery One API key is not configured. Save the token in Courier Credentials first.',
      )
    }

    return {
      Authorization: `Token ${this.apiKey}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }
  }

  private async getToken() {
    await this.ensureConfigLoaded()

    if (!this.apiKey) {
      throw new HttpError(
        400,
        'Delivery One API key is not configured. Save the token in Courier Credentials first.',
      )
    }

    return this.apiKey
  }

  private isYes(value: unknown) {
    const normalized = String(value ?? '').trim().toLowerCase()
    return ['y', 'yes', 'true', '1', 'available', 'serviceable'].includes(normalized)
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
      throw new HttpError(400, 'Delivery One waybill count must be at least 1.')
    }
    if (normalizedCount > 10000) {
      throw new HttpError(400, 'Delivery One bulk waybill count cannot be more than 10,000.')
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
        'Delivery One waybill fetch failed'

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
        'Delivery One shipment edit payment mode must be COD or Pre-paid.',
      )
    }

    const waybill = sanitizeString(payload?.waybill)
    if (!waybill) {
      throw new HttpError(400, 'waybill is required to edit a Delivery One shipment.')
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
        'Provide at least one editable field for Delivery One shipment edit.',
      )
    }
    if (editPayload.pt === 'COD' && !(Number(editPayload.cod) > 0)) {
      throw new HttpError(
        400,
        'Positive COD amount is required when converting a Delivery One shipment to COD.',
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
        typeof raw?.error === 'string' ||
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
          this.extractErrorMessage(raw, 'Delivery One shipment edit failed.'),
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
        'Delivery One shipment edit failed'

      this.log('Edit shipment failed', {
        waybill,
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
      throw new HttpError(400, 'order_number is required to create a Delivery One shipment.')
    }
    if (orderAmount <= 0 || Number.isNaN(orderAmount)) {
      throw new HttpError(
        400,
        'order_amount is required and must be a positive number for Delivery One shipment creation.',
      )
    }

    const consigneePhone = sanitizePhone(consignee.phone)
    if (!consigneePhone) {
      throw new HttpError(
        400,
        'Consignee phone must contain at least 10 digits for Delivery One shipments.',
      )
    }

    const pickupPhone = sanitizePhone(pickup.phone)
    if (!pickupPhone) {
      throw new HttpError(400, 'Valid pickup phone is required for Delivery One shipments.')
    }

    const destinationPin = sanitizePincode(consignee.pincode)
    if (!/^\d{6}$/.test(destinationPin)) {
      throw new HttpError(400, 'A valid 6-digit destination pincode is required.')
    }

    const pickupLocationName = sanitizeString(pickup.warehouse_name || params.pickup_location_alias)
    if (!pickupLocationName) {
      throw new HttpError(
        400,
        'Delivery One pickup_location.name is required and must match the registered warehouse name.',
      )
    }

    const selectedShippingMode =
      sanitizeString((params as any).shipping_mode) ||
      getDelhiveryShippingModeByCourierId(normalizeCourierId(params.courier_id)) ||
      'Surface'
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
    const sellerName = sanitizeString(params.company?.name || pickup.name || 'ChoiceMe')
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
        `Delivery One MPS shipment requires ${packageCount} prefetched waybills. Received ${waybills.length}.`,
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

    this.log('Create shipment payload summary', {
      order: orderNumber,
      paymentMode,
      pickupLocation: pickupLocationName,
      shippingMode: selectedShippingMode,
      mps: isMps,
      shipmentCount: shipments.length,
      hasWaybills: waybills.length,
    })

    try {
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
          'Delivery One reported a failure during shipment creation.'

        this.log('Create shipment rejected', {
          order: orderNumber,
          status: response.status,
          failureReason,
          response: responseData,
        })
        throw new DelhiveryManifestError(502, failureReason, responseData)
      }

      this.log('Create shipment succeeded', {
        order: orderNumber,
        status: response.status,
        packages: successfulPackages.length,
        awb: successfulPackages[0]?.waybill,
      })

      return responseData
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
        'Delivery One shipment creation failed'

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
      throw new HttpError(400, 'A valid 6-digit pincode is required for Delivery One serviceability.')
    }

    const headers = await this.getHeaders()
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
      const remark = String(postalCode?.remark ?? '').trim()
      const embargoed = remark.toLowerCase() === 'embargo'
      const hasRecord = records.length > 0
      const pickupAvailable = hasRecord && this.isYes(postalCode?.pickup)
      const codAvailable = hasRecord && this.isYes(postalCode?.cod)
      const prepaidAvailable = hasRecord && this.isYes(postalCode?.pre_paid)
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
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        'Delivery One pincode serviceability failed'

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
        'A valid 6-digit pincode is required for Delivery One heavy serviceability.',
      )
    }

    const headers = await this.getHeaders()
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
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        'Delivery One heavy pincode serviceability failed'

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
