import type { B2BOrder } from '../../../types/generic.types'
import type { B2BFormData, Box, Invoice } from './B2BOrderForm'

const padDatePart = (value: number) => String(value).padStart(2, '0')

const getLocalDateInputValue = () => {
  const today = new Date()
  return `${today.getFullYear()}-${padDatePart(today.getMonth() + 1)}-${padDatePart(today.getDate())}`
}

const normalizeDateInput = (value?: string | null) => {
  const normalized = String(value || '').trim().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : getLocalDateInputValue()
}

const parseMaybeArray = <T>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[]
  if (typeof value !== 'string' || !value.trim()) return []

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

const getB2BBoxes = (order: B2BOrder | null): Box[] => {
  const boxes = parseMaybeArray<Record<string, unknown>>((order as any)?.packages)

  if (!boxes.length) {
    return [{ lengthCm: 0, breadthCm: 0, heightCm: 0, weightKg: 0 }]
  }

  return boxes.map((box) => ({
    lengthCm: Number(box.lengthCm ?? box.length ?? 0),
    breadthCm: Number(box.breadthCm ?? box.breadth ?? box.width ?? 0),
    heightCm: Number(box.heightCm ?? box.height ?? 0),
    weightKg: Number(box.weightKg ?? box.weight ?? 0),
  }))
}

const getB2BInvoices = (order: B2BOrder | null): Invoice[] => {
  const invoices = parseMaybeArray<Record<string, unknown>>((order as any)?.invoices)

  if (invoices.length) {
    return invoices.map((invoice) => ({
      invoiceNumber: String(invoice.invoiceNumber ?? invoice.invoice_number ?? ''),
      invoiceDate: normalizeDateInput(String(invoice.invoiceDate ?? invoice.invoice_date ?? '')),
      invoiceValue: Number(invoice.invoiceValue ?? invoice.invoice_value ?? 0),
      invoiceFileUrl: String(invoice.invoiceFileUrl ?? invoice.invoice_file_url ?? ''),
    }))
  }

  return [
    {
      invoiceNumber: String((order as any)?.invoice_number ?? ''),
      invoiceDate: normalizeDateInput((order as any)?.invoice_date),
      invoiceValue: Number((order as any)?.invoice_amount ?? order?.order_amount ?? 0),
      invoiceFileUrl: '',
    },
  ]
}

export const getB2BOrderFormDefaults = (order: B2BOrder | null): Partial<B2BFormData> => {
  const pickupDetails = ((order as any)?.pickup_details || {}) as Record<string, any>
  const rtoDetails = ((order as any)?.rto_details || {}) as Record<string, any>

  return {
    buyerName: order?.buyer_name || '',
    buyerPhone: order?.buyer_phone || '',
    buyerEmail: order?.buyer_email || '',
    address: order?.address || '',
    pincode: order?.pincode || '',
    companyName: order?.company_name || '',
    gstin: order?.company_gst || '',
    city: order?.city || '',
    state: order?.state || '',
    country: order?.country || 'India',
    boxes: getB2BBoxes(order),
    invoices: getB2BInvoices(order),
    orderId: '',
    orderDate: getLocalDateInputValue(),
    orderType: String(order?.order_type || 'prepaid').toLowerCase() === 'cod' ? 'cod' : 'prepaid',
    orderAmount: Number(order?.order_amount ?? 0),
    courierPartner: '',
    courierPartnerId: '',
    courierOptionKey: '',
    shippingCharges: Number(order?.shipping_charges ?? 0),
    transactionFee: Number(order?.transaction_fee ?? 0),
    giftWrap: 0,
    discount: Number(order?.discount ?? 0),
    prepaidAmount: 0,
    courierCod: 0,
    courierCost: null,
    forwardCharges: 0,
    otherCharges: 0,
    pickupLocationId: order?.pickup_location_id || '',
    pickupLocationPincode: pickupDetails?.pincode || '',
    pickupLocationName: pickupDetails?.warehouse_name || pickupDetails?.name || '',
    pickupAddress: pickupDetails?.address || '',
    pickupLocationPOCName: pickupDetails?.name || '',
    pickupLocationPOCPhone: pickupDetails?.phone || '',
    pickupCity: pickupDetails?.city || '',
    pickupState: pickupDetails?.state || '',
    isRtoSame: !order?.is_rto_different,
    rtoLocationPincode: rtoDetails?.pincode || '',
    rtoLocationName: rtoDetails?.warehouse_name || rtoDetails?.name || '',
    rtoAddress: rtoDetails?.address || '',
    rtoLocationPOCName: rtoDetails?.name || '',
    rtoLocationPOCPhone: rtoDetails?.phone || '',
    rtoCity: rtoDetails?.city || '',
    rtoState: rtoDetails?.state || '',
    isInsurance: Boolean(order?.is_insurance),
    zone: '',
    zoneId: '',
  }
}
