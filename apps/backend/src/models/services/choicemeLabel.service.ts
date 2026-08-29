import axios from 'axios'
import { and, eq } from 'drizzle-orm'
import PdfPrinter from 'pdfmake'
import path from 'node:path'
import { createRequire } from 'node:module'
import sharp from 'sharp'
import { db } from '../client'
import { b2b_orders } from '../schema/b2bOrders'
import { b2c_orders } from '../schema/b2cOrders'
import { userProfiles } from '../schema/userProfile'
import { users } from '../schema/users'
import { presignDownload, presignUpload } from './upload.service'

type LabelSnapshot = {
  order: any
  sourceTable: 'b2c' | 'b2b' | 'memory'
}

type FontFiles = {
  normal: string
  bold: string
  italics: string
  bolditalics: string
}

const moduleRequire = createRequire(__filename)
const PDFJS_STANDARD_FONTS_DIR = path.join(
  path.dirname(moduleRequire.resolve('pdfjs-dist/package.json')),
  'standard_fonts',
)

const IMAGE_DOWNLOAD_TIMEOUT = 20000
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const LOGO_MAX_WIDTH = 260
const LOGO_MAX_HEIGHT = 104

const normalizeText = (value: unknown, fallback = '-') => {
  const text = String(value ?? '').trim()
  return text || fallback
}

const normalizeNumber = (value: unknown) => {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

const formatMoney = (value: number | string | null | undefined) => {
  const amount = normalizeNumber(value)
  return `Rs. ${amount.toFixed(2)}`
}

const parseMaybeJson = <T>(value: unknown): T | null => {
  if (value === null || value === undefined) return null
  if (typeof value === 'object') return value as T
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  try {
    return JSON.parse(trimmed) as T
  } catch {
    return null
  }
}

const splitTextLines = (value: unknown) =>
  String(value ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

const buildAddressLines = (...parts: Array<unknown>) =>
  parts.flatMap((part) => splitTextLines(part)).filter(Boolean)

const downloadImageBuffer = async (source: string): Promise<Buffer | null> => {
  const reference = source.trim()
  if (!reference) return null

  try {
    if (/^data:image\//i.test(reference)) {
      const base64Part = reference.split(',')[1] || ''
      return Buffer.from(base64Part, 'base64')
    }

    const signed = /^https?:\/\//i.test(reference) ? reference : await presignDownload(reference)
    const finalUrl = Array.isArray(signed) ? signed[0] : signed

    if (!finalUrl) return null

    const response = await axios.get(finalUrl, {
      responseType: 'arraybuffer',
      timeout: IMAGE_DOWNLOAD_TIMEOUT,
      maxContentLength: MAX_IMAGE_BYTES,
      maxBodyLength: MAX_IMAGE_BYTES,
    })

    const buffer = Buffer.from(response.data)
    return buffer.length > 0 ? buffer : null
  } catch (err) {
    console.warn('ChoiceMee label image download failed:', err)
    return null
  }
}

const normalizeImageToDataUrl = async (buffer: Buffer): Promise<string | null> => {
  try {
    const png = await sharp(buffer)
      .resize({
        width: LOGO_MAX_WIDTH,
        height: LOGO_MAX_HEIGHT,
        fit: 'contain',
        withoutEnlargement: true,
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      })
      .png()
      .toBuffer()
    if (!png.length) return null
    return `data:image/png;base64,${png.toString('base64')}`
  } catch (err) {
    console.warn('ChoiceMee label image normalization failed:', err)
    return null
  }
}

const resolveSellerLogoDataUrl = async (companyInfo: Record<string, any>, order: any) => {
  const logoReference = [
    companyInfo?.companyLogoUrl,
    companyInfo?.profilePicture,
    order?.companyLogoUrl,
    order?.merchant_logo,
    order?.merchantLogo,
  ]
    .find((value) => typeof value === 'string' && value.trim().length > 0)
    ?.trim()
    || ''

  if (!logoReference) return null

  const logoBuffer = await downloadImageBuffer(logoReference)
  if (!logoBuffer) return null

  return normalizeImageToDataUrl(logoBuffer)
}

const compactPlaceLine = (city?: unknown, state?: unknown, pincode?: unknown) => {
  const place = [city, state]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .join(', ')
  const pin = String(pincode ?? '').trim()
  if (place && pin) return `${place} ${pin}`
  return place || pin
}

const pickRuntimeLabelFields = (order: any) => {
  const extras: Record<string, any> = {}
  for (const key of [
    'barcode_img',
    'barcode_url',
    'barcode_image',
    'barcode',
    'oid_barcode',
    'sort_code',
    'delhivery_label_meta',
    'deliveryone_label_meta',
    'label_generated_at',
  ]) {
    if (order?.[key] !== undefined && order?.[key] !== null && order?.[key] !== '') {
      extras[key] = order[key]
    }
  }
  return extras
}

const selectOrderFromTable = async (tx: any, table: any, where: any) => {
  const [row] = await tx.select().from(table).where(where).limit(1)
  return row ?? null
}

const resolveOrderCandidate = async (tx: any, order: any): Promise<LabelSnapshot | null> => {
  const orderId = normalizeText(order?.id, '')
  const userId = normalizeText(order?.user_id, '')
  const orderNumber = normalizeText(order?.order_number, '')
  const orderRef = normalizeText(order?.order_id, '')
  const awbNumber = normalizeText(order?.awb_number, '')

  const candidates: Array<() => Promise<LabelSnapshot | null>> = []

  if (orderId) {
    candidates.push(async () => {
      const b2cRow = await selectOrderFromTable(tx, b2c_orders, eq(b2c_orders.id, orderId))
      if (b2cRow) return { order: { ...b2cRow, ...pickRuntimeLabelFields(order) }, sourceTable: 'b2c' }
      const b2bRow = await selectOrderFromTable(tx, b2b_orders, eq(b2b_orders.id, orderId))
      if (b2bRow) return { order: { ...b2bRow, ...pickRuntimeLabelFields(order) }, sourceTable: 'b2b' }
      return null
    })
  }

  if (userId && orderNumber) {
    candidates.push(async () => {
      const b2cRow = await selectOrderFromTable(
        tx,
        b2c_orders,
        and(eq(b2c_orders.user_id, userId), eq(b2c_orders.order_number, orderNumber)),
      )
      if (b2cRow) return { order: { ...b2cRow, ...pickRuntimeLabelFields(order) }, sourceTable: 'b2c' }
      const b2bRow = await selectOrderFromTable(
        tx,
        b2b_orders,
        and(eq(b2b_orders.user_id, userId), eq(b2b_orders.order_number, orderNumber)),
      )
      if (b2bRow) return { order: { ...b2bRow, ...pickRuntimeLabelFields(order) }, sourceTable: 'b2b' }
      return null
    })
  }

  if (orderRef) {
    candidates.push(async () => {
      const b2cRow = await selectOrderFromTable(tx, b2c_orders, eq(b2c_orders.order_id, orderRef))
      if (b2cRow) return { order: { ...b2cRow, ...pickRuntimeLabelFields(order) }, sourceTable: 'b2c' }
      const b2bRow = await selectOrderFromTable(tx, b2b_orders, eq(b2b_orders.order_id, orderRef))
      if (b2bRow) return { order: { ...b2bRow, ...pickRuntimeLabelFields(order) }, sourceTable: 'b2b' }
      return null
    })
  }

  if (awbNumber) {
    candidates.push(async () => {
      const b2cRow = await selectOrderFromTable(tx, b2c_orders, eq(b2c_orders.awb_number, awbNumber))
      if (b2cRow) return { order: { ...b2cRow, ...pickRuntimeLabelFields(order) }, sourceTable: 'b2c' }
      const b2bRow = await selectOrderFromTable(tx, b2b_orders, eq(b2b_orders.awb_number, awbNumber))
      if (b2bRow) return { order: { ...b2bRow, ...pickRuntimeLabelFields(order) }, sourceTable: 'b2b' }
      return null
    })
  }

  if (orderNumber) {
    candidates.push(async () => {
      const b2cRow = await selectOrderFromTable(tx, b2c_orders, eq(b2c_orders.order_number, orderNumber))
      if (b2cRow) return { order: { ...b2cRow, ...pickRuntimeLabelFields(order) }, sourceTable: 'b2c' }
      const b2bRow = await selectOrderFromTable(tx, b2b_orders, eq(b2b_orders.order_number, orderNumber))
      if (b2bRow) return { order: { ...b2bRow, ...pickRuntimeLabelFields(order) }, sourceTable: 'b2b' }
      return null
    })
  }

  for (const candidate of candidates) {
    try {
      const result = await candidate()
      if (result) return result
    } catch (err) {
      console.warn('ChoiceMee label snapshot lookup failed:', err)
    }
  }

  return null
}

export async function resolveLabelOrderSnapshot(order: any, tx: any = db): Promise<LabelSnapshot> {
  const resolved = await resolveOrderCandidate(tx, order)
  if (resolved) return resolved
  return { order: { ...order, ...pickRuntimeLabelFields(order) }, sourceTable: 'memory' }
}

const extractLineItems = (order: any) => {
  const directProducts = parseMaybeJson<any[]>(order?.products)
  if (Array.isArray(directProducts) && directProducts.length > 0) return directProducts

  const packageRows = parseMaybeJson<any[]>(order?.packages)
  if (!Array.isArray(packageRows) || packageRows.length === 0) return []

  return packageRows.flatMap((pkg) => {
    if (Array.isArray(pkg?.products) && pkg.products.length > 0) {
      return pkg.products.map((product: any) => ({
        ...product,
        boxId: product?.boxId ?? pkg?.boxId ?? pkg?.box_id ?? null,
        boxName: product?.boxName ?? pkg?.boxName ?? pkg?.box_name ?? null,
      }))
    }

    return [
      {
        ...pkg,
        productName: pkg?.productName ?? pkg?.boxName ?? pkg?.box_name ?? pkg?.name ?? 'Item',
        name: pkg?.name ?? pkg?.boxName ?? pkg?.box_name ?? 'Item',
        qty: pkg?.qty ?? pkg?.quantity ?? 1,
      },
    ]
  })
}

const normalizeLineItem = (item: any) => {
  const quantity = Math.max(1, normalizeNumber(item?.qty ?? item?.quantity ?? 1))
  const unitPrice = normalizeNumber(item?.price ?? item?.rate ?? item?.amount ?? item?.unitPrice)
  const explicitTotal = item?.total ?? item?.lineTotal ?? item?.amount_total ?? null
  const lineTotal =
    explicitTotal !== null && explicitTotal !== undefined && explicitTotal !== ''
      ? normalizeNumber(explicitTotal)
      : Math.max(0, unitPrice * quantity - normalizeNumber(item?.discount))

  const productId = normalizeText(
    item?.productId ?? item?.product_id ?? item?.sku ?? item?.skuCode ?? item?.boxId ?? item?.id,
  )
  const productName = normalizeText(
    item?.productName ?? item?.name ?? item?.title ?? item?.boxName ?? item?.box_name,
  )

  return { productId, productName, unitPrice, quantity, lineTotal }
}

const resolveCustomerFacingTotal = (order: any, itemTotal: number) => {
  const productAmount = normalizeNumber(order?.order_amount)
  const baseAmount = productAmount > 0 ? productAmount : itemTotal
  const total =
    baseAmount +
    normalizeNumber(order?.shipping_charges) +
    normalizeNumber(order?.transaction_fee) +
    normalizeNumber(order?.gift_wrap) -
    normalizeNumber(order?.discount) -
    normalizeNumber(order?.prepaid_amount)

  return Math.max(0, total)
}

const buildLabelAmountRows = (order: any, itemTotal: number, totalAmount: number) => {
  const chargeRows = [
    { label: 'Product', value: itemTotal, show: true },
    { label: 'Shipping', value: normalizeNumber(order?.shipping_charges), show: normalizeNumber(order?.shipping_charges) > 0 },
    { label: 'Txn Fee', value: normalizeNumber(order?.transaction_fee), show: normalizeNumber(order?.transaction_fee) > 0 },
    { label: 'Gift Wrap', value: normalizeNumber(order?.gift_wrap), show: normalizeNumber(order?.gift_wrap) > 0 },
    { label: 'Discount', value: -normalizeNumber(order?.discount), show: normalizeNumber(order?.discount) > 0 },
    { label: 'Prepaid', value: -normalizeNumber(order?.prepaid_amount), show: normalizeNumber(order?.prepaid_amount) > 0 },
  ].filter((row) => row.show)

  return [
    ...chargeRows,
    { label: 'Total', value: totalAmount, show: true },
  ].map((row, index, rows) => [
    {
      text: row.label,
      fontSize: row.label === 'Total' ? 6.6 : 6.0,
      bold: row.label === 'Total',
      color: '#111111',
      margin: index === rows.length - 1 ? [0, 1, 0, 0] : [0, 0, 0, 0],
    },
    {
      text: formatMoney(row.value),
      fontSize: row.label === 'Total' ? 6.6 : 6.0,
      bold: row.label === 'Total',
      alignment: 'right',
      color: '#111111',
      margin: index === rows.length - 1 ? [0, 1, 0, 0] : [0, 0, 0, 0],
    },
  ])
}

const resolveProviderKey = (order: any) => {
  const integration = String(order?.integration_type ?? '').trim().toLowerCase()
  const courierPartner = String(order?.courier_partner ?? '').trim().toLowerCase()

  if (order?.delhivery_label_meta) return 'delhivery'
  if (order?.deliveryone_label_meta) return 'deliveryone'
  if (integration === 'delhivery' || courierPartner.includes('delhivery')) return 'delhivery'
  if (integration === 'deliveryone' || courierPartner.includes('deliveryone')) return 'deliveryone'
  if (String(order?.shipment_id ?? '').trim()) return 'deliveryone'
  return 'delhivery'
}

const resolveShippingModeLabel = (order: any) => {
  const rawMode =
    String(
      order?.shipping_mode ??
        order?.service_mode ??
        order?.mode ??
        order?.shippingMode ??
        order?.delivery_mode ??
        '',
    )
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')

  if (!rawMode) return ''
  if (rawMode.includes('express') || rawMode.includes('air')) return 'Express'
  if (rawMode.includes('surface') || rawMode.includes('ground')) return 'Surface'

  return rawMode
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

const loadFonts = () => ({
  LiberationSans: {
    normal: path.join(PDFJS_STANDARD_FONTS_DIR, 'LiberationSans-Regular.ttf'),
    bold: path.join(PDFJS_STANDARD_FONTS_DIR, 'LiberationSans-Bold.ttf'),
    italics: path.join(PDFJS_STANDARD_FONTS_DIR, 'LiberationSans-Italic.ttf'),
    bolditalics: path.join(PDFJS_STANDARD_FONTS_DIR, 'LiberationSans-BoldItalic.ttf'),
  },
})

const printer = new PdfPrinter(loadFonts() as any)

type ShipmentLabelPdfParams = {
  order: any
  sellerName: string
  sellerLogoDataUrl?: string | null
  sellerAddressLines: string[]
  sellerContact: string
  customerName: string
  customerPhone: string
  customerAddressLines: string[]
  orderDate: string
  invoiceNo: string
  paymentMethod: string
  paymentColor: string
  normalizedItems: Array<ReturnType<typeof normalizeLineItem>>
  footerUrl: string
}

const buildBarcodeDataUrl = async (awb: string) => {
  try {
    const bwipjs = await import('bwip-js')
    const barcodeBuffer = await bwipjs.toBuffer({
      bcid: 'code128',
      text: awb,
      scale: 2,
      height: 10,
      includetext: false,
      backgroundcolor: 'FFFFFF',
    })
    return barcodeBuffer.length > 0 ? `data:image/png;base64,${barcodeBuffer.toString('base64')}` : null
  } catch (err) {
    console.warn('ChoiceMee label barcode generation failed:', err)
    return null
  }
}

export const buildShipmentLabelPdfBuffer = async (params: ShipmentLabelPdfParams) => {
  const {
    order,
    sellerName,
    sellerLogoDataUrl,
    sellerAddressLines,
    sellerContact,
    customerName,
    customerPhone,
    customerAddressLines,
    orderDate,
    invoiceNo,
    paymentMethod,
    paymentColor,
    normalizedItems,
  } = params

  const awb = normalizeText(order?.awb_number ?? order?.awbNumber, '-')
  const providerLabel = resolveProviderKey(order) === 'delhivery' ? 'DELHIVERY' : 'DELIVERYONE'
  const itemTotal = normalizedItems.reduce((sum, item) => sum + Math.max(0, item.lineTotal), 0)
  const totalAmount = resolveCustomerFacingTotal(order, itemTotal)
  const amountRows = buildLabelAmountRows(order, itemTotal, totalAmount)
  const rows: any[] = normalizedItems.slice(0, 4).map((item) => [
    { text: item.productId || '-', fontSize: 6.3, color: '#4b5563' },
    { text: item.productName || '-', fontSize: 6.3, color: '#111111' },
    { text: formatMoney(item.unitPrice), fontSize: 6.3, alignment: 'right', color: '#111111' },
    { text: String(item.quantity), fontSize: 6.3, alignment: 'right', color: '#111111' },
    { text: formatMoney(item.lineTotal), fontSize: 6.3, alignment: 'right', color: '#111111' },
  ])

  if (!rows.length) {
    rows.push([{ text: '-', colSpan: 5, fontSize: 6.3, color: '#6b7280' }, {}, {}, {}, {}])
  }

  const barcodeDataUrl = await buildBarcodeDataUrl(awb)
  const qrPayload = `${invoiceNo} | ${awb}`

  const docDefinition: any = {
    info: {
      title: 'ChoiceMee Shipment Label',
      author: 'ChoiceMee',
      subject: 'ChoiceMee shipment label',
      creator: 'ChoiceMee Label Generator',
    },
    pageSize: { width: 288, height: 432 },
    // Keep every generated label on its single 4x6 page. Overflow creates a
    // continuation page, which the 4-up bulk compositor would treat as a label.
    pageMargins: [10, 10, 10, 10],
    defaultStyle: {
      font: 'LiberationSans',
      fontSize: 6.5,
      lineHeight: 1.08,
      color: '#111111',
    },
    content: [
      {
        columns: [
          {
            width: '*',
            stack: [
              sellerLogoDataUrl
                ? {
                    image: sellerLogoDataUrl,
                    width: 112,
                    margin: [0, 0, 0, 3],
                  }
                : { text: '', margin: [0, 0, 0, 0] },
              { text: sellerName, fontSize: 10.6, bold: true, color: '#111111', margin: [0, 0, 0, 1] },
            ],
          },
          {
            width: 120,
            stack: [
              { text: 'SHIPPING LABEL', fontSize: 10.6, bold: true, alignment: 'right', characterSpacing: 0.8 },
              { text: `Order # ${invoiceNo}`, fontSize: 6.2, alignment: 'right', color: '#374151', margin: [0, 1, 0, 0] },
              { text: `AWB # ${awb}`, fontSize: 6.2, alignment: 'right', color: '#374151' },
              { text: `Generated: ${orderDate || '-'}`, fontSize: 6.2, alignment: 'right', color: '#374151' },
            ],
          },
        ],
        columnGap: 8,
        margin: [0, 0, 0, 5],
      },
      {
        table: {
          widths: [78, '*'],
          body: [
            [
              {
                text: paymentMethod,
                bold: true,
                fontSize: 11,
                alignment: 'center',
                color: paymentColor,
                margin: [0, 4, 0, 4],
              },
              {
                text:
                  paymentMethod === 'COD'
                    ? `Collect ${formatMoney(totalAmount)}`
                    : 'No amount to be collected',
                bold: true,
                fontSize: 10,
                alignment: 'center',
                margin: [0, 4, 0, 4],
              },
            ],
          ],
        },
        layout: {
          hLineColor: () => '#111111',
          vLineColor: () => '#111111',
          hLineWidth: () => 1,
          vLineWidth: () => 1,
          paddingLeft: () => 1,
          paddingRight: () => 1,
          paddingTop: () => 1,
          paddingBottom: () => 1,
        },
        margin: [0, 0, 0, 5],
      },
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: `Courier: ${providerLabel}`, fontSize: 9.2, bold: true, color: '#111111' },
              {
                text: `Mode: ${resolveShippingModeLabel(order) || '-'}`,
                fontSize: 9.2,
                bold: true,
                color: '#111111',
                margin: [0, 1, 0, 0],
              },
              {
                text: `Order Value: ${formatMoney(totalAmount)}`,
                fontSize: 9.2,
                bold: true,
                color: '#111111',
                margin: [0, 1, 0, 0],
              },
              { text: `Reference Order # : ${invoiceNo}`, fontSize: 6.2, color: '#374151', margin: [0, 2, 0, 0] },
              { text: `AWB # : ${awb}`, fontSize: 6.2, color: '#374151' },
              { text: `Date : ${orderDate || '-'}`, fontSize: 6.2, color: '#374151' },
            ],
          },
          {
            width: 102,
            stack: [
              barcodeDataUrl
                ? { image: barcodeDataUrl, width: 98, alignment: 'center', margin: [0, 0, 0, 1] }
                : { text: awb, alignment: 'center', fontSize: 12, bold: true, margin: [0, 10, 0, 10] },
              { text: awb, alignment: 'center', fontSize: 8.4, color: '#111111', margin: [0, -2, 0, 0] },
            ],
          },
        ],
        columnGap: 8,
        margin: [0, 0, 0, 5],
      },
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: 'To:', fontSize: 9.2, bold: true, color: '#111111' },
              { text: customerName, fontSize: 11.5, bold: true, color: '#111111', margin: [0, 1, 0, 0] },
              ...customerAddressLines.map((line) => ({ text: line, fontSize: 8.2, color: '#111111' })),
              { text: `Contact: ${customerPhone || '-'}`, fontSize: 8.2, color: '#374151', margin: [0, 1, 0, 0] },
            ],
          },
          {
            width: 50,
            qr: qrPayload,
            fit: 48,
            alignment: 'right',
            margin: [0, 2, 0, 0],
          },
        ],
        columnGap: 8,
        margin: [0, 0, 0, 2],
      },
      {
        canvas: [
          {
            type: 'line',
            x1: 0,
            y1: 0,
            x2: 262,
            y2: 0,
            lineWidth: 1.1,
            dash: { length: 4, space: 2 },
          },
        ],
        margin: [0, 2, 0, 3],
      },
      {
        stack: [
          { text: 'FROM', fontSize: 6.8, bold: true, color: '#111111', margin: [0, 0, 0, 2] },
          { text: sellerName, fontSize: 10.2, bold: true, color: '#111111' },
          ...sellerAddressLines.map((line) => ({ text: line, fontSize: 8.0, color: '#111111' })),
          { text: `Contact: ${sellerContact || '-'}`, fontSize: 8.0, color: '#374151' },
        ],
        margin: [0, 0, 0, 4],
      },
      {
        table: {
          headerRows: 1,
          widths: [44, 98, 40, 28, 52],
          body: [
            [
              { text: 'SKU', bold: true, fontSize: 6.2, color: '#374151' },
              { text: 'Product Name', bold: true, fontSize: 6.2, color: '#374151' },
              { text: 'Rate', bold: true, fontSize: 6.2, color: '#374151', alignment: 'right' },
              { text: 'Qty', bold: true, fontSize: 6.2, color: '#374151', alignment: 'right' },
              { text: 'Amount', bold: true, fontSize: 6.2, color: '#374151', alignment: 'right' },
            ],
            ...rows,
          ],
        },
        layout: {
          hLineColor: () => '#d1d5db',
          vLineColor: () => '#ffffff',
          hLineWidth: (i: number) => (i === 0 ? 0.8 : 0.45),
          vLineWidth: () => 0,
          paddingLeft: () => 0,
          paddingRight: () => 0,
          paddingTop: () => 1,
          paddingBottom: () => 1,
        },
        margin: [0, 0, 0, 4],
      },
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: 'NOTE', fontSize: 6.6, bold: true, color: '#111111', margin: [0, 0, 0, 2] },
              { text: 'Local ChoiceMee label template generated from order and seller details.', fontSize: 6.0, color: '#6b7280' },
            ],
          },
          {
            width: 84,
            table: {
              widths: ['*', 'auto'],
              body: amountRows,
            },
            layout: {
              hLineColor: () => '#d1d5db',
              vLineColor: () => '#d1d5db',
              hLineWidth: () => 0.5,
              vLineWidth: () => 0.5,
              paddingLeft: () => 4,
              paddingRight: () => 4,
              paddingTop: () => 2,
              paddingBottom: () => 2,
            },
          },
        ],
        columnGap: 8,
      },
    ],
  }

  const pdfDoc = printer.createPdfKitDocument(docDefinition)
  const chunks: Buffer[] = []
  return await new Promise<Buffer>((resolve, reject) => {
    pdfDoc.on('data', (chunk) => chunks.push(chunk))
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)))
    pdfDoc.on('error', (err) => reject(err))
    pdfDoc.end()
  })
}

export async function generateLabelForOrder(order: any, userId: string, tx: any = db) {
  const snapshot = await resolveLabelOrderSnapshot(order, tx)
  const resolvedOrder = snapshot.order ?? order
  const resolvedUserId = normalizeText(resolvedOrder?.user_id ?? userId, '')

  if (!resolvedUserId || resolvedUserId === '-') {
    throw new Error('Label generation requires a valid user id')
  }

  if (userId && resolvedOrder?.user_id && userId !== resolvedOrder.user_id) {
    console.warn('ChoiceMee label generator received a mismatched user id; using the order owner.')
  }

  const [profileRow, userRow] = await Promise.all([
    tx
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, resolvedUserId))
      .limit(1)
      .then((rows: any[]) => rows[0] ?? null),
    tx
      .select()
      .from(users)
      .where(eq(users.id, resolvedUserId))
      .limit(1)
      .then((rows: any[]) => rows[0] ?? null),
  ])

  const companyInfo = (profileRow?.companyInfo || {}) as Record<string, any>
  const pickupDetails = (parseMaybeJson<Record<string, any>>(resolvedOrder?.pickup_details) || {}) as Record<string, any>
  const lineItems = extractLineItems(resolvedOrder)
  const normalizedItems = lineItems.map(normalizeLineItem)

  const sellerName = normalizeText(
    pickupDetails?.warehouse_name ||
      companyInfo?.brandName ||
      companyInfo?.businessName ||
      companyInfo?.companyName ||
      userRow?.email?.split('@')?.[0] ||
      resolvedOrder?.merchant_name ||
      'ChoiceMee',
  )
  const sellerAddressLines = buildAddressLines(
    pickupDetails?.address || companyInfo?.companyAddress || companyInfo?.address || '',
    compactPlaceLine(pickupDetails?.city || companyInfo?.city, pickupDetails?.state || companyInfo?.state, pickupDetails?.pincode || companyInfo?.pincode),
    pickupDetails?.country || companyInfo?.country || resolvedOrder?.country || 'India',
  ).slice(0, 3)
  const sellerContact = normalizeText(
    companyInfo?.companyContactNumber || companyInfo?.contactNumber || userRow?.phone || pickupDetails?.phone || '-',
  )
  const sellerLogoDataUrl = await resolveSellerLogoDataUrl(companyInfo, resolvedOrder)

  const customerName = normalizeText(
    resolvedOrder?.buyer_name ||
      resolvedOrder?.company_name ||
      resolvedOrder?.consignee_name ||
      resolvedOrder?.name ||
      'Customer',
  )
  const customerPhone = normalizeText(
    resolvedOrder?.buyer_phone || resolvedOrder?.phone || resolvedOrder?.customer_phone || '-',
  )
  const customerAddressLines = buildAddressLines(
    resolvedOrder?.address,
    compactPlaceLine(resolvedOrder?.city, resolvedOrder?.state, resolvedOrder?.pincode),
    normalizeText(resolvedOrder?.country || 'India'),
  ).slice(0, 3)

  const invoiceNo = normalizeText(
    resolvedOrder?.invoice_number || resolvedOrder?.order_number || resolvedOrder?.order_id || resolvedOrder?.id,
  )
  const orderDate = normalizeText(
    resolvedOrder?.order_date || resolvedOrder?.created_at || resolvedOrder?.updated_at,
    '',
  )
  const paymentRaw = String(resolvedOrder?.payment_type || resolvedOrder?.order_type || '').trim().toLowerCase()
  const paymentMethod =
    paymentRaw === 'cod' ? 'COD' : paymentRaw === 'prepaid' ? 'PREPAID' : paymentRaw ? paymentRaw.toUpperCase() : 'PREPAID'
  const paymentColor = paymentMethod === 'COD' ? '#d97706' : '#059669'
  const footerUrl = `https://choicemee.in/tax-invoice/${encodeURIComponent(invoiceNo || String(resolvedOrder?.id ?? 'label'))}`

  const pdfBuffer = await buildShipmentLabelPdfBuffer({
    order: resolvedOrder,
    sellerName,
    sellerLogoDataUrl,
    sellerAddressLines,
    sellerContact,
    customerName,
    customerPhone,
    customerAddressLines,
    orderDate,
    invoiceNo,
    paymentMethod,
    paymentColor,
    normalizedItems,
    footerUrl,
  })

  if (!pdfBuffer || pdfBuffer.length === 0) {
    throw new Error('PDF buffer is empty or invalid')
  }

  const { uploadUrl, key } = await presignUpload({
    filename: `l-${String(resolvedOrder?.order_number || resolvedOrder?.id || resolvedOrder?.order_id || Date.now())
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(-12)}.pdf`,
    contentType: 'application/pdf',
    userId: resolvedUserId,
    folderKey: 'labels',
  })

  const finalUploadUrl = Array.isArray(uploadUrl) ? uploadUrl[0] : uploadUrl
  const labelKey = Array.isArray(key) ? key[0] : key

  if (!finalUploadUrl || !labelKey) {
    throw new Error('Failed to get presigned URL for label upload')
  }

  const uploadResponse = await axios.put(finalUploadUrl, pdfBuffer, {
    headers: { 'Content-Type': 'application/pdf' },
    timeout: 60000,
    validateStatus: (status) => status >= 200 && status < 300,
  })

  if (uploadResponse.status < 200 || uploadResponse.status >= 300) {
    throw new Error(`Label upload failed with status ${uploadResponse.status}`)
  }

  const finalKey = typeof labelKey === 'string' ? labelKey.trim() : ''
  if (!finalKey) {
    throw new Error('Label key is invalid or empty after upload')
  }

  console.log(`ChoiceMee label generated for ${resolvedOrder?.order_number || resolvedOrder?.id}: ${finalKey}`)
  return finalKey
}
