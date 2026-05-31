import axios from 'axios'
import qs from 'qs'
import { DelhiveryManifestError, HttpError } from '../../../utils/classes'
import {
  getDelhiveryShippingModeByCourierId,
  normalizeDelhiveryShippingMode,
  normalizeCourierId,
} from '../../../utils/delhiveryCourier'
import { getDelhiveryCredentials } from '../delhiveryCredentials.service'
import { ShipmentParams } from '../shiprocket.service'

type DelhiveryPickupRequestPayload = {
  pickup_date?: string | Date
  pickup_time?: string
  pickup_location?: string
  pickupLocation?: string
  expected_package_count?: number | string
  expectedPackageCount?: number | string
  package_count?: number | string
  count?: number | string
}

export class DelhiveryService {
  private apiBase = 'https://track.delhivery.com'
  private token = ''
  private clientName = ''

  private async ensureCredentials() {
    const credentials = await getDelhiveryCredentials()
    this.apiBase = credentials.apiBase
    this.token = credentials.apiKey
    this.clientName = credentials.clientName
  }

  private getHeaders({ includeContentType = true }: { includeContentType?: boolean } = {}) {
    const headers: Record<string, string> = {
      Authorization: `Token ${this.token}`,
      Accept: 'application/json',
    }
    if (includeContentType) headers['Content-Type'] = 'application/json'
    return headers
  }

  private async postFormEncoded(path: string, payload: unknown) {
    await this.ensureCredentials()
    const encodedData = qs.stringify({
      format: 'json',
      data: JSON.stringify(payload),
    })

    return axios.post(`${this.apiBase}${path}`, encodedData, {
      headers: {
        Authorization: `Token ${this.token}`,
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 30000,
    })
  }

  // 🔹 1. Check Serviceability
  async checkServiceability(pincode: string) {
    try {
      await this.ensureCredentials()
      const url = `${this.apiBase}/c/api/pin-codes/json/?filter_codes=${pincode}`
      const res = await axios.get(url, { headers: this.getHeaders({ includeContentType: false }), timeout: 20000 })

      // Log the full response structure
      console.log('📦 Delhivery Serviceability API Response:', {
        url,
        status: res.status,
        data: JSON.stringify(res.data, null, 2),
        dataType: typeof res.data,
        isArray: Array.isArray(res.data),
        keys: res.data ? Object.keys(res.data) : [],
      })

      return res.data
    } catch (err: any) {
      console.error('❌ Delhivery serviceability error:', {
        pincode,
        status: err.response?.status,
        data: JSON.stringify(err.response?.data, null, 2),
        message: err.message,
      })
      throw new Error('Failed to fetch Delhivery serviceability')
    }
  }

  // 🔹 2. Expected TAT (Transit Time)
  async getExpectedTAT(
    origin: string,
    destination: string,
    mot: 'S' | 'E' = 'S',
    pdt: 'B2B' | 'B2C' = 'B2C',
  ) {
    try {
      await this.ensureCredentials()
      const url = `${this.apiBase}/api/dc/expected_tat?origin_pin=${origin}&destination_pin=${destination}&mot=${mot}&pdt=${pdt}`
      const res = await axios.get(url, { headers: this.getHeaders({ includeContentType: false }), timeout: 20000 })
      const tat = res.data?.data?.tat
      return typeof tat === 'number' || typeof tat === 'string' ? Number(tat) : null
    } catch (err: any) {
      console.error('Delhivery TAT API error:', err.response?.data || err.message)
      return null
    }
  }

  // 🔹 3. Fetch Waybills
  async calculateShippingCost(params: {
    md?: 'E' | 'S' | 'Express' | 'Surface' | string
    cgm?: number | string
    chargeable_weight?: number | string
    chargeableWeight?: number | string
    weight?: number | string
    o_pin?: string | number
    origin_pincode?: string | number
    originPincode?: string | number
    origin?: string | number
    d_pin?: string | number
    destination_pincode?: string | number
    destinationPincode?: string | number
    destination?: string | number
    ss?: 'Delivered' | 'RTO' | 'DTO' | string
    status?: string
    pt?: 'Pre-paid' | 'COD' | string
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
  }) {
    const sanitizeString = (value?: string | number | null) =>
      value === undefined || value === null ? '' : String(value).trim()
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
      if (!normalized || normalized === 'delivered') return 'Delivered'
      if (normalized === 'rto') return 'RTO'
      if (normalized === 'dto') return 'DTO'
      throw new HttpError(400, 'ss shipment status must be Delivered, RTO, or DTO.')
    }
    const normalizePaymentType = (value: unknown): 'Pre-paid' | 'COD' => {
      const normalized = sanitizeString(value as any).toLowerCase()
      if (['cod', 'cash on delivery'].includes(normalized)) return 'COD'
      if (!normalized || ['pre-paid', 'prepaid', 'pre paid'].includes(normalized)) {
        return 'Pre-paid'
      }
      throw new HttpError(400, 'pt payment type must be Pre-paid or COD.')
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

    await this.ensureCredentials()

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

    const requestParams: Record<string, string | number> = {
      md: normalizeBillingMode(params.md),
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
    const packageType = sanitizeString(
      params.ipkg_type ?? params.package_type ?? params.packageType,
    )

    if (length !== undefined) requestParams.l = length
    if (breadth !== undefined) requestParams.b = breadth
    if (height !== undefined) requestParams.h = height
    if (packageType) requestParams.ipkg_type = packageType

    try {
      const response = await axios.get(`${this.apiBase}/api/kinko/v1/invoice/charges/.json`, {
        headers: this.getHeaders({ includeContentType: false }),
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

      if (explicitFailure) {
        throw new HttpError(
          502,
          typeof raw?.error === 'string' && raw.error.trim()
            ? raw.error.trim()
            : 'Delhivery shipping cost calculation failed.',
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
          cod: pickNumber(record, ['cod_charge', 'cod_charges', 'COD Charge', 'COD Charges']),
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
    } catch (err: any) {
      if (err instanceof HttpError) throw err
      console.error('Delhivery shipping cost API error:', err.response?.data || err.message)
      throw new HttpError(
        Number(err?.response?.status || 502),
        err?.response?.data?.error || err?.message || 'Delhivery shipping cost calculation failed',
      )
    }
  }

  async fetchWaybills(count: number = 10) {
    try {
      await this.ensureCredentials()
      const normalizedCount = Math.max(1, Number(count || 1))
      const isBulk = normalizedCount > 1
      const path = isBulk ? '/waybill/api/bulk/json/' : '/waybill/api/fetch/json/'
      const query = qs.stringify({
        cl: this.clientName,
        token: this.token,
        ...(isBulk ? { count: normalizedCount } : {}),
      })
      const url = `${this.apiBase}${path}?${query}`
      const res = await axios.get(url, { headers: this.getHeaders({ includeContentType: false }) })
      return res.data?.waybill ?? res.data?.waybills ?? res.data
    } catch (err: any) {
      console.error('Delhivery waybill fetch error:', err.response?.data || err.message)
      throw new Error('Failed to fetch Delhivery waybill')
    }
  }

  // 🔹 4. Create Shipment (Manifestation)
  async createShipment(params: ShipmentParams, waybill?: string) {
    try {
      const normalizedCourierId = normalizeCourierId(params.courier_id)
      if (normalizedCourierId === null) {
        throw new HttpError(
          400,
          'Delhivery courier_id is required for bookings.',
        )
      }
      const shippingMode =
        getDelhiveryShippingModeByCourierId(normalizedCourierId) ||
        normalizeDelhiveryShippingMode(params.shipping_mode)
      if (!shippingMode) {
        throw new HttpError(
          400,
          `Unable to resolve Delhivery shipping mode for courier_id: ${normalizedCourierId}. Please include shipping_mode as Surface or Express.`,
        )
      }

      const sanitizeString = (value?: string | null) => {
        if (!value) return ''
        return String(value).trim()
      }
      const sanitizePhone = (value?: string | null) => {
        const digits = String(value || '').replace(/\\D/g, '')
        return digits.length >= 10 ? digits.slice(-10) : digits
      }
      const sanitizePincode = (value?: string | number | null) => {
        if (value === undefined || value === null) return ''
        return String(value).trim()
      }
      const sanitizeBoolean = (value?: boolean | string | number | null) => {
        if (value === undefined || value === null) return undefined
        if (typeof value === 'boolean') return value
        const normalized = String(value).trim().toLowerCase()
        return ['true', '1', 'yes', 'y'].includes(normalized)
      }

      const pickup = params.pickup || ({} as ShipmentParams['pickup'])
      const consignee = params.consignee || ({} as ShipmentParams['consignee'])
      const boxes = Array.isArray(params.boxes) ? params.boxes : []
      const orderNumber = sanitizeString(params.order_number)
      const invoiceNumber = sanitizeString(params.invoice_number)
      const resolvedInvoiceNumber = invoiceNumber || orderNumber
      const orderAmount = Number(params.order_amount ?? 0)
      const orderItems = Array.isArray(params.order_items) ? params.order_items : []
      const hsnCodes = Array.from(
        new Set(
          orderItems
            .map((item) => (item?.hsn || item?.hsnCode || '').toString().trim())
            .filter((code) => code.length > 0),
        ),
      )

      if (!orderNumber) {
        throw new HttpError(400, 'order_number is required to create a Delhivery shipment.')
      }
      if (!invoiceNumber) {
        console.warn(
          `ℹ️ Delhivery invoice_number missing for order ${orderNumber}; using order_number as fallback.`,
        )
      }
      // if (!invoiceNumber) {
      //   throw new HttpError(
      //     400,
      //     'invoice_number (invoice_reference) is mandatory for Delhivery B2C manifests. Please provide the seller invoice number.',
      //   )
      // }
      // if (!hsnCodes.length) {
      //   throw new HttpError(
      //     400,
      //     'Delhivery requires HSN/SAC codes for at least one of the products you are shipping. Attach HSN codes to your order items.',
      //   )
      // }
      if (orderAmount <= 0 || Number.isNaN(orderAmount)) {
        throw new HttpError(
          400,
          'order_amount is required and must be a positive number when booking with Delhivery.',
        )
      }
      if ((params.mps || boxes.length > 1) && !waybill) {
        throw new HttpError(
          400,
          'Delhivery multi-piece shipment is not supported in the current B2C flow. Use a single-package shipment.',
        )
      }

      const pickupAddressParts = [
        sanitizeString(pickup.address),
        sanitizeString(pickup.address_2),
      ].filter((part) => part.length > 0)
      const pickupAddress =
        pickupAddressParts.length > 0
          ? pickupAddressParts.join(', ')
          : sanitizeString(pickup.warehouse_name)

      const sellerName = sanitizeString(params.company?.name || pickup.name || 'ChoiceMe')
      const sellerGst = sanitizeString(params.company?.gst || pickup.gst_number || '')
      const productNames = orderItems
        .map((item) => sanitizeString(item?.name))
        .filter((name) => name.length > 0)
      const productsDesc = productNames.length ? productNames.join(', ') : 'General Merchandise'

      const consigneePhone = sanitizePhone(consignee.phone)
      if (!consigneePhone) {
        throw new HttpError(
          400,
          'Consignee phone must contain at least 10 digits for Delhivery shipments.',
        )
      }
      const pickupPhone = sanitizePhone(pickup.phone)
      if (!pickupPhone) {
        throw new HttpError(400, 'Valid pickup phone is required for Delhivery manifests.')
      }

      const orderDate =
        params.order_date instanceof Date
          ? params.order_date.toISOString().split('T')[0]
          : sanitizeString(params.order_date) || new Date().toISOString().split('T')[0]
      const invoiceDate =
        params.invoice_date && sanitizeString(params.invoice_date)
          ? sanitizeString(params.invoice_date)
          : orderDate
      const paymentMode =
        params.payment_type === 'cod'
          ? 'COD'
          : params.payment_type === 'reverse'
            ? 'Pickup'
            : params.payment_type === 'replacement'
              ? 'REPL'
              : 'Prepaid'
      const codAmount = paymentMode === 'COD' ? orderAmount : 0

      const manifestShipment: Record<string, any> = {
        order: orderNumber,
        order_date: orderDate,
        name: sanitizeString(consignee.name),
        phone: consigneePhone,
        add: sanitizeString(consignee.address),
        city: sanitizeString(consignee.city),
        state: sanitizeString(consignee.state),
        pin: sanitizePincode(consignee.pincode),
        country: 'India',
        payment_mode: paymentMode,
        cod_amount: codAmount,
        total_amount: orderAmount,
        products_desc: productsDesc,
        hsn_code: hsnCodes.join(', '),
        weight: Number(params.package_weight ?? 0.5),
        shipment_length: Number(params.package_length ?? 10),
        shipment_width: Number(params.package_breadth ?? 10),
        shipment_height: Number(params.package_height ?? 10),
        seller_name: sellerName,
        seller_add: pickupAddress,
        seller_city: sanitizeString(pickup.city),
        seller_state: sanitizeString(pickup.state),
        seller_pin: sanitizePincode(pickup.pincode),
        seller_phone: pickupPhone,
        seller_gst_tin: sellerGst,
        seller_inv: resolvedInvoiceNumber,
        invoice_reference: resolvedInvoiceNumber,
        invoice_date: invoiceDate,
        pickup_location: sanitizeString(pickup.warehouse_name) || 'Default Warehouse',
        pickup_address: pickupAddress,
        pickup_city: sanitizeString(pickup.city),
        pickup_state: sanitizeString(pickup.state),
        pickup_pin: sanitizePincode(pickup.pincode),
        pickup_phone: pickupPhone,
        pickup_country: 'India',
        shipping_mode: shippingMode,
        client_name: this.clientName || sellerName,
        client_gst_tin: sellerGst,
        waybill: waybill || undefined,
      }

      if (params.transport_speed) {
        manifestShipment.transport_speed = sanitizeString(params.transport_speed)
      }
      if (params.address_type) {
        manifestShipment.address_type = sanitizeString(params.address_type)
      }
      const ewbnValue =
        params.ewbn || params.ewb || params.ewbn_number || params.ewaybill_number || undefined
      if (ewbnValue) {
        manifestShipment.ewbn = sanitizeString(ewbnValue)
      }
      if (params.dangerous_good !== undefined) {
        manifestShipment.dangerous_good = sanitizeBoolean(params.dangerous_good)
      }
      if (params.fragile_shipment !== undefined) {
        manifestShipment.fragile_shipment = sanitizeBoolean(params.fragile_shipment)
      }
      if (params.plastic_packaging !== undefined) {
        manifestShipment.plastic_packaging = sanitizeBoolean(params.plastic_packaging)
      }
      if (params.quantity !== undefined && params.quantity !== null) {
        manifestShipment.quantity = sanitizeString(String(params.quantity))
      }
      if (params.country) {
        manifestShipment.country = sanitizeString(params.country)
      }

      const resolvedReturnAddress =
        params.rto && params.is_rto_different === 'yes'
          ? params.rto
          : paymentMode === 'REPL'
            ? (params.rto ?? params.pickup)
            : null

      if (resolvedReturnAddress) {
        Object.assign(manifestShipment, {
          return_name: resolvedReturnAddress.name,
          return_add: resolvedReturnAddress.address,
          return_address: resolvedReturnAddress.address,
          return_city: resolvedReturnAddress.city,
          return_state: resolvedReturnAddress.state,
          return_pin: resolvedReturnAddress.pincode,
          return_phone: resolvedReturnAddress.phone,
          return_country: 'India',
        })
      }

      const payload = {
        shipments: [manifestShipment],
        pickup_location: {
          name: sanitizeString(pickup.warehouse_name) || 'Default Warehouse',
        },
      }

      console.log('📤 Delhivery createShipment payload summary', {
        order: orderNumber,
        pickup_location: payload.shipments[0].pickup_location,
        payment_mode: paymentMode,
        hsn_present: hsnCodes.length,
        invoice_number: invoiceNumber,
        shipping_mode: shippingMode,
        cod_amount: codAmount,
      })

      const res = await this.postFormEncoded('/api/cmu/create.json', payload)
      const responseData = res.data

      const packages: any[] =
        Array.isArray(responseData?.packages) && responseData.packages.length
          ? responseData.packages
          : responseData?.packages
            ? [responseData.packages]
            : []

      const normalizedStatus = (value?: string) => (value || '').toLowerCase()
      const normalizeRemarks = (remarks: unknown): string[] => {
        if (!remarks) return []
        if (Array.isArray(remarks)) {
          return remarks
            .flatMap((entry) => normalizeRemarks(entry))
            .filter((entry) => entry.trim().length > 0)
        }
        if (typeof remarks === 'string') {
          return [remarks.trim()].filter(Boolean)
        }
        if (typeof remarks === 'object') {
          return Object.values(remarks as Record<string, unknown>)
            .flatMap((entry) => normalizeRemarks(entry))
            .filter((entry) => entry.trim().length > 0)
        }
        return [String(remarks).trim()].filter(Boolean)
      }
      const overallStatus = normalizedStatus(responseData?.status)
      const packageFailures = packages.filter(
        (pkg) =>
          normalizedStatus(pkg?.status) === 'fail' || pkg?.serviceable === false || !pkg?.waybill,
      )
      const packageFailuresWithRemarks = packageFailures.map((pkg) => ({
        ...pkg,
        remarks: normalizeRemarks(pkg?.remarks),
      }))
      const successPackage = packages.find(
        (pkg) =>
          pkg?.waybill && pkg?.serviceable !== false && normalizedStatus(pkg?.status) !== 'fail',
      )

      if (
        overallStatus === 'fail' ||
        responseData?.success === false ||
        responseData?.serviceable === false ||
        !successPackage
      ) {
        console.error('❌ Delhivery manifest rejected', {
          order: orderNumber,
          response: responseData,
          packageFailures: packageFailuresWithRemarks,
        })

        const failureReason =
          responseData?.message ||
          responseData?.status_message ||
          packageFailuresWithRemarks
            .map((pkg) => {
              const joinedRemarks = pkg.remarks.join(' | ')
              return (
                joinedRemarks ||
                pkg?.message ||
                pkg?.reason ||
                pkg?.rmk ||
                `status=${pkg?.status}`
              )
            })
            .filter(Boolean)
            .join(' | ') ||
          normalizeRemarks(responseData?.rmk).join(' | ') ||
          'Delhivery reported a failure during shipment creation.'
        throw new DelhiveryManifestError(502, failureReason, responseData)
      }

      const responseShippingMode =
        responseData?.shipping_mode ??
        successPackage?.shipping_mode ??
        successPackage?.service_mode ??
        successPackage?.service_type ??
        successPackage?.mode ??
        null

      console.log('📤 Delhivery API response service', {
        order: orderNumber,
        requested_shipping_mode: shippingMode,
        response_shipping_mode: responseShippingMode,
        response_package_keys: successPackage ? Object.keys(successPackage) : [],
      })

      let sortCode: string | null = null
      if (successPackage) {
        sortCode =
          (successPackage.sort_code ||
            successPackage.sortCode ||
            successPackage.routing_code ||
            successPackage.routingCode) ??
          null
      }

      const awb = successPackage?.waybill
      if (awb) {
        console.log(`🔄 Generating Delhivery label for AWB: ${awb}`)
        await new Promise((resolve) => setTimeout(resolve, 1000))

        let retries = 3
        let labelMetaFetched = false

        while (retries > 0 && !labelMetaFetched) {
          try {
            const labelMeta = await this.generateLabel(awb)
            const pkg = Array.isArray(labelMeta?.packages)
              ? labelMeta.packages[0]
              : labelMeta?.packages || labelMeta
            if (pkg) {
              if (!sortCode) {
                sortCode =
                  (pkg.sort_code || pkg.sortCode || pkg.routing_code || pkg.routingCode) ?? null
              }
              labelMetaFetched = true
              console.log(`✅ Delhivery label metadata fetched successfully for AWB: ${awb}`)
              break
            }
          } catch (err: any) {
            console.warn(
              `⚠️ Failed to fetch Delhivery label metadata (attempt ${4 - retries}/3):`,
              err?.message || err,
            )
            if (retries > 1) {
              await new Promise((resolve) => setTimeout(resolve, 2000 * (4 - retries)))
            }
          }
          retries--
        }

        if (!labelMetaFetched) {
          console.error(
            `❌ Failed to fetch Delhivery label metadata after all retries for AWB: ${awb}`,
          )
        }
      }

      if (sortCode && successPackage) {
        successPackage.sort_code = sortCode
      }

      return responseData
    } catch (err: any) {
      console.error('Delhivery shipment error:', err.response?.data || err.message)
      if (err instanceof HttpError) {
        throw err
      }
      throw new Error('Delhivery shipment creation failed')
    }
  }

  // 🔹 6. Cancel Shipment
  async cancelShipment(waybill: string) {
    try {
      await this.ensureCredentials()
      console.log('🚚 Delhivery Cancel Shipment Request:', {
        waybill,
        apiBase: this.apiBase,
      })

      const res = await axios.post(
        `${this.apiBase}/api/p/edit`,
        { waybill, cancellation: 'true' },
        {
          headers: this.getHeaders(),
          timeout: 20000,
        },
      )

      console.log('📥 Delhivery Cancel Shipment Response:', {
        status: res.status,
        data: JSON.stringify(res.data, null, 2),
        success: res.data?.success,
        Success: res.data?.Success,
        statusField: res.data?.status,
        message: res.data?.message,
      })

      return res.data
    } catch (err: any) {
      console.error('❌ Delhivery cancellation error:', {
        waybill,
        status: err.response?.status,
        data: JSON.stringify(err.response?.data, null, 2),
        message: err.message,
        stack: err.stack,
      })
      throw new Error('Delhivery cancellation failed')
    }
  }

  // 🔹 7. Track Shipment
  async trackShipment(awb: string) {
    await this.ensureCredentials()
    const res = await axios.get(`${this.apiBase}/api/v1/packages/json/?waybill=${awb}`, {
      headers: this.getHeaders({ includeContentType: false }),
    })
    return res.data
  }

  // 🔹 8. NDR Action (RE-ATTEMPT / PICKUP_RESCHEDULE)
  async submitNdrAction(
    actions: Array<{
      waybill: string
      act: 'RE-ATTEMPT' | 'DEFER_DLV' | 'EDIT_DETAILS' | 'PICKUP_RESCHEDULE'
      action_data?: Record<string, any>
    }>,
  ) {
    try {
      await this.ensureCredentials()
      const url = `${this.apiBase}/api/p/update`
      const payload = actions.map((action) => {
        const mappedAct = action.act === 'PICKUP_RESCHEDULE' ? 'DEFER_DLV' : action.act
        const actionData = { ...(action.action_data || {}) } as Record<string, any>

        if (mappedAct === 'DEFER_DLV') {
          const normalizedDeferredDate =
            actionData.deferred_date || actionData.deferment_date || actionData.defermentDate
          if (normalizedDeferredDate) {
            actionData.deferred_date = normalizedDeferredDate
          }
          delete actionData.deferment_date
          delete actionData.defermentDate
        }

        return {
          waybill: action.waybill,
          act: mappedAct,
          ...(Object.keys(actionData).length ? { action_data: actionData } : {}),
        }
      })
      const res = await axios.post(url, { data: payload }, { headers: this.getHeaders() })
      return res.data // contains UPL id(s)
    } catch (err: any) {
      console.error('Delhivery NDR action error:', err.response?.data || err.message)
      throw new Error('Failed to submit Delhivery NDR action')
    }
  }

  // 🔹 9. Get NDR UPL Status
  async getNdrStatus(uplId: string, verbose: boolean = true) {
    try {
      await this.ensureCredentials()
      const url = `${this.apiBase}/api/cmu/get_bulk_upl/${encodeURIComponent(uplId)}?verbose=${
        verbose ? 'true' : 'false'
      }`
      const res = await axios.get(url, { headers: this.getHeaders({ includeContentType: false }) })
      return res.data
    } catch (err: any) {
      console.error('Delhivery NDR status error:', err.response?.data || err.message)
      throw new Error('Failed to fetch Delhivery NDR status')
    }
  }

  // 🔹 8. Pickup Request (manual scheduling)
  async requestPickup(pickupData: any) {
    await this.ensureCredentials()
    const res = await axios.post(`${this.apiBase}/fm/request/new/`, pickupData, {
      headers: this.getHeaders(),
    })
    return res.data
  }

  // services/delhivery.service.ts
  async createWarehouse(warehouse: {
    name: string
    registered_name?: string
    phone: string
    email?: string
    address: string
    city: string
    pin: string
    country?: string
    return_address: string
    return_city?: string
    return_pin?: string
    return_state?: string
    return_country?: string
  }) {
    try {
      await this.ensureCredentials()
      const url = `${this.apiBase}/api/backend/clientwarehouse/create/`
      const headers = {
        Authorization: `Token ${this.token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      }

      const res = await axios.post(url, warehouse, { headers })
      return res.data
    } catch (err: any) {
      console.error('❌ Delhivery warehouse creation error:', err.response?.data || err.message)
      // Re-throw original error so upstream callers can inspect Delhivery's response
      throw err
    }
  }

  async triggerDelhiveryPickupRequest(pickupLocationName: string, packageCount: number) {
    try {
      // 🔹 Current date in YYYY-MM-DD
      const now = new Date()
      const pickup_date = now.toISOString().split('T')[0]

      // 🔹 Pickup time → 1 hour from now (HH:mm:ss)
      const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000)
      const pickup_time = oneHourLater.toTimeString().split(' ')[0] // "HH:mm:ss"

      const payload = {
        pickup_date,
        pickup_time,
        pickup_location: pickupLocationName,
        expected_package_count: packageCount,
      }

      const res = await this.createPickupRequest(payload)

      if (!res?.success) {
        console.error('❌ Delhivery pickup creation failed:', res)
        throw new Error(res?.message || 'Delhivery pickup request failed')
      }

      console.log(`✅ Pickup request created for ${pickupLocationName} (${packageCount} packages)`)
      return res
    } catch (err: any) {
      console.error('❌ Pickup request creation error:', err.message)
      throw err
    }
  }
  // 🔹 10. Create Reverse Shipment
  // Delhivery reverse shipments are created via the same create.json manifestation API,
  // with `package_type: "Pickup"` and reverse-specific shipment values.
  async createReverseShipment(params: {
    originalAwb: string
    originalOrderId?: string
    consignee: ShipmentParams['consignee']
    pickup: ShipmentParams['pickup']
    rto?: ShipmentParams['rto']
    order_amount?: number
    package_weight?: number
    package_length?: number
    package_breadth?: number
    package_height?: number
    order_items?: ShipmentParams['order_items']
  }) {
    try {
      const reverseDrop = params.rto ?? params.pickup
      const reversePayload: any = {
        shipments: [
          {
            order: params.originalOrderId || `REVERSE-${params.originalAwb}`,
            name: params.consignee?.name || '',
            phone: String(params.consignee?.phone || '')
              .replace(/\D/g, '')
              .slice(-10),
            add: params.consignee?.address || '',
            city: params.consignee?.city || '',
            state: params.consignee?.state || '',
            pin: String(params.consignee?.pincode || '')
              .padStart(6, '0')
              .slice(0, 6),
            country: 'India',
            payment_mode: 'Pickup',
            package_type: 'Pickup',
            total_amount: Number(params.order_amount || 0),
            cod_amount: '0',
            products_desc:
              params.order_items?.map((i) => i.name).join(', ') || 'Reverse Pickup Shipment',
            weight: Number(params.package_weight ?? 0.5),
            shipment_length: Number(params.package_length ?? 10),
            shipment_width: Number(params.package_breadth ?? 10),
            shipment_height: Number(params.package_height ?? 10),
            pickup_location: params.pickup?.warehouse_name ?? 'Default Warehouse',
            seller_name: params.pickup?.name ?? 'ChoiceMe',
            seller_add: params.pickup?.address ?? '',
            order_date: new Date().toISOString().split('T')[0],
            return_name: reverseDrop?.name ?? params.pickup?.name ?? 'Return',
            return_add: reverseDrop?.address ?? '',
            return_city: reverseDrop?.city ?? '',
            return_state: reverseDrop?.state ?? '',
            return_pin: String(reverseDrop?.pincode ?? '')
              .padStart(6, '0')
              .slice(0, 6),
            return_phone: String(reverseDrop?.phone ?? '')
              .replace(/\D/g, '')
              .slice(-10),
            return_country: 'India',
          },
        ],
      }

      if (params.order_items && params.order_items.length > 0) {
        reversePayload.shipments[0].products_desc = params.order_items
          .map((item) => item?.name || 'Item')
          .join(', ')
      }

      const res = await this.postFormEncoded('/api/cmu/create.json', reversePayload)

      if (!res.data?.packages?.length) {
        throw new Error('Delhivery reverse shipment creation failed - no packages returned')
      }

      const pkg = res.data.packages[0]
      const delhiveryCost =
        pkg?.charge || pkg?.amount || res.data?.charge || res.data?.amount || null

      return {
        success: true,
        packages: res.data.packages,
        upload_wbn: res.data.upload_wbn,
        shipment_id: res.data.upload_wbn,
        awb_number: pkg.waybill,
        courier_name: 'Delhivery',
        courier_cost: delhiveryCost ? Number(delhiveryCost) : null,
        status: 'booked',
      }
    } catch (err: any) {
      console.error('Delhivery reverse shipment error:', err.response?.data || err.message)
      throw new Error(err?.message || 'Delhivery reverse shipment creation failed')
    }
  }

  async updateWarehouse(data: {
    name: string // warehouse name (case-sensitive, cannot be changed)
    address?: string
    pin: string
    phone?: string
  }) {
    try {
      await this.ensureCredentials()
      const url = `${this.apiBase}/api/backend/clientwarehouse/edit/`
      const headers = {
        Authorization: `Token ${this.token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      }

      const payload = {
        name: data.name,
        address: data.address,
        pin: data.pin,
        phone: data.phone,
      }

      const res = await axios.post(url, payload, { headers, timeout: 30000 })
      return res.data
    } catch (err: any) {
      console.error('❌ Delhivery warehouse update error:', err.response?.data || err.message)
      throw new Error('Failed to update Delhivery warehouse')
    }
  }

  async createPickupRequest(params: DelhiveryPickupRequestPayload) {
    try {
      await this.ensureCredentials()
      const url = `${this.apiBase}/fm/request/new/`
      const payload = {
        pickup_date:
          params.pickup_date instanceof Date
            ? params.pickup_date.toISOString().split('T')[0]
            : String(params.pickup_date || '').trim().slice(0, 10),
        pickup_time: /^\d{2}:\d{2}$/.test(String(params.pickup_time || '').trim())
          ? `${String(params.pickup_time).trim()}:00`
          : String(params.pickup_time || '').trim(),
        // must exactly match the warehouse name registered with Delhivery
        pickup_location: String(params.pickup_location ?? params.pickupLocation ?? '').trim(),
        expected_package_count: Math.floor(
          Number(
            params.expected_package_count ??
              params.expectedPackageCount ??
              params.package_count ??
              params.count,
          ),
        ),
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(payload.pickup_date || '').trim())) {
        throw new HttpError(400, 'pickup_date must be in YYYY-MM-DD format.')
      }
      if (!/^\d{2}:\d{2}:\d{2}$/.test(String(payload.pickup_time || '').trim())) {
        throw new HttpError(400, 'pickup_time must be in HH:mm:ss format.')
      }
      if (!String(payload.pickup_location || '').trim()) {
        throw new HttpError(
          400,
          'pickup_location is required and must match the registered Delhivery warehouse name.',
        )
      }
      if (!Number.isFinite(payload.expected_package_count) || payload.expected_package_count < 1) {
        throw new HttpError(400, 'expected_package_count must be at least 1.')
      }

      const headers = {
        Authorization: `Token ${this.token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      }

      const collectStrings = (value: unknown, messages: string[] = []) => {
        if (value === undefined || value === null || typeof value === 'boolean') return messages
        if (typeof value === 'string' || typeof value === 'number') {
          const text = String(value).trim()
          if (text) messages.push(text)
          return messages
        }
        if (Array.isArray(value)) {
          value.forEach((entry) => collectStrings(entry, messages))
          return messages
        }
        if (typeof value === 'object') {
          Object.values(value as Record<string, unknown>).forEach((entry) =>
            collectStrings(entry, messages),
          )
        }
        return messages
      }
      const extractErrorMessage = (value: any, fallback: string) => {
        const directMessages = collectStrings(
          [
            value?.message,
            value?.error,
            value?.detail,
            value?.pickup_date,
            value?.pickup_time,
            value?.pickup_location,
            value?.expected_package_count,
            value?.non_field_errors,
          ],
          [],
        )
        if (directMessages.length) return Array.from(new Set(directMessages)).join(' | ')
        const allMessages = collectStrings(value, [])
        return Array.from(new Set(allMessages)).slice(0, 4).join(' | ') || fallback
      }

      const postPickupFormFields = async () =>
        axios.post(`${this.apiBase}/fm/request/new/`, qs.stringify(payload), {
          headers: {
            Authorization: `Token ${this.token}`,
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 30000,
        })

      let res
      try {
        res = await axios.post(url, payload, { headers, timeout: 30000 })
      } catch (error: any) {
        const status = Number(error?.response?.status)
        if (![400, 415, 422].includes(status)) {
          throw error
        }

        console.warn('Delhivery pickup JSON rejected, retrying as form-encoded', {
          pickup_date: payload.pickup_date,
          pickup_time: payload.pickup_time,
          pickup_location: payload.pickup_location,
          expected_package_count: payload.expected_package_count,
          status,
          response: error?.response?.data || null,
        })
        res = await postPickupFormFields()
      }

      const raw = res.data
      const rawText = (() => {
        try {
          return JSON.stringify(raw)
        } catch {
          return String(raw || '')
        }
      })().toLowerCase()
      const providerMessage = extractErrorMessage(raw, '')
      const pickupId = raw?.pickup_id ?? raw?.data?.pickup_id ?? raw?.pr_id ?? null
      const alreadyExists =
        raw?.pr_exist === true ||
        Number(raw?.error?.code || 0) === 669 ||
        providerMessage.toLowerCase().includes('already exist') ||
        (rawText.includes('pickup request') && rawText.includes('already exist'))

      const statusText = String(raw?.status ?? raw?.Status ?? '').trim().toLowerCase()
      const accepted =
        alreadyExists ||
        Boolean(pickupId) ||
        raw?.success === true ||
        raw?.Success === true ||
        raw?.status === true ||
        ['success', 'succeeded', 'created', 'scheduled'].includes(statusText)

      const explicitFailure =
        !alreadyExists &&
        (raw?.success === false ||
          raw?.Success === false ||
          raw?.error === true ||
          (typeof raw?.error === 'string' && raw.error.trim().length > 0) ||
          ['fail', 'failed', 'error', 'false'].includes(statusText))

      if (explicitFailure || !accepted) {
        console.error('Delhivery pickup request rejected:', raw)
        const error = new HttpError(
          502,
          extractErrorMessage(raw, 'Delhivery pickup request failed.'),
        )
        ;(error as any).details = raw
        ;(error as any).isPickupRequestError = true
        throw error
      }

      return {
        success: true,
        message: providerMessage || 'Delhivery pickup request accepted.',
        payload,
        existing: alreadyExists,
        pickupId,
        raw,
      }
    } catch (err: any) {
      if (err instanceof HttpError) {
        ;(err as any).isPickupRequestError = true
        throw err
      }

      const providerError = err.response?.data
      console.error('❌ Delhivery pickup request error:', providerError || err.message)

      const collectProviderMessages = (value: unknown, messages: string[] = []): string[] => {
        if (value === undefined || value === null || typeof value === 'boolean') return messages
        if (typeof value === 'string' || typeof value === 'number') {
          const text = String(value).trim()
          if (text && !['true', 'false'].includes(text.toLowerCase())) messages.push(text)
          return messages
        }
        if (Array.isArray(value)) {
          value.forEach((entry) => collectProviderMessages(entry, messages))
          return messages
        }
        if (typeof value === 'object') {
          Object.values(value as Record<string, unknown>).forEach((entry) =>
            collectProviderMessages(entry, messages),
          )
        }
        return messages
      }
      const providerMessages = Array.from(new Set(collectProviderMessages(providerError))).slice(
        0,
        4,
      )
      const providerMessage =
        typeof providerError?.pickup_date === 'string'
          ? providerError.pickup_date
          : typeof providerError?.message === 'string'
            ? providerError.message
            : typeof providerError?.error === 'string'
              ? providerError.error
              : providerMessages.length
                ? providerMessages.join(' | ')
                : typeof err.message === 'string' && err.message.trim().length > 0
                  ? err.message.trim()
                  : 'Failed to create pickup request in Delhivery'

      const error = new Error(providerMessage)
      ;(error as any).statusCode =
        typeof err.response?.status === 'number' ? err.response.status : 500
      ;(error as any).details = providerError || null
      ;(error as any).isPickupRequestError = true
      throw error
    }
  }
  // 🔹 9. Fetch Shipping Label from Delhivery packing_slip API
  // format=json -> metadata (barcodes, sort code, etc.)
  // format=pdf  -> raw PDF bytes (used to ensure provider-side label generation activity)
  async generateLabel(awb: string, options: { format?: 'json' | 'pdf' } = { format: 'json' }) {
    await this.ensureCredentials()
    const format = options.format || 'json'
    const url = `${this.apiBase}/api/p/packing_slip?wbns=${encodeURIComponent(awb)}${
      format === 'pdf' ? '&pdf=true' : '&pdf=false'
    }`
    const responseType = format === 'pdf' ? 'arraybuffer' : 'json'
    const res = await axios.get(url, {
      headers: this.getHeaders({ includeContentType: false }),
      responseType,
    })

    return format === 'pdf' ? Buffer.from(res.data) : res.data
  }

  // COD Settlement APIs not publicly available
  // Use CSV download from Delhivery dashboard instead:
  // Dashboard → Finances → Remittance → Download Report
}
