import { and, between, eq, inArray } from 'drizzle-orm'
import { db } from '../client'
import { b2b_orders } from '../schema/b2bOrders'
import { b2c_orders } from '../schema/b2cOrders'
import { buildCsv } from '../../utils/csv'
import { uniqueShipments } from '../../utils/shipmentIdentity'

export const BILLABLE_ORDER_STATUSES = [
  'shipment_created',
  'booked',
  'pickup_initiated',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'ndr',
  'rto',
  'rto_in_transit',
  'rto_delivered',
]

export const BILLING_CSV_HEADERS = [
  'Order ID',
  'Order Type',
  'AWB',
  'Freight Charges',
  'COD Charges',
  'Order Date',
  'Seller ID',
  'Shipment Type',
  'Order Number',
]

export function buildSellerBillingCsv(rows: Record<string, any>[], sellerId: string) {
  const orders = uniqueShipments(rows, sellerId)
  const csv = buildCsv(
    BILLING_CSV_HEADERS,
    orders.map((order) => [
      order.order_id || order.order_number || order.id,
      String(order.order_type).toLowerCase() === 'cod' ? 'COD' : 'Prepaid',
      String(order.awb_number ?? '').trim() || '-',
      Number(order.freight_charges ?? order.shipping_charges ?? 0),
      Number(order.cod_charges ?? 0),
      String(
        order.order_date ||
          (order.created_at instanceof Date ? order.created_at.toISOString() : order.created_at) ||
          '',
      ).slice(0, 10),
      sellerId,
      order.type || '',
      order.order_number || '',
    ]),
  )
  const taxableValue = orders.reduce(
    (sum, order) =>
      sum +
      Number(order.freight_charges ?? order.shipping_charges ?? 0) +
      Number(order.cod_charges ?? 0),
    0,
  )
  return { csv, orders, taxableValue: Math.round(taxableValue * 100) / 100 }
}

export async function getInvoiceShipmentRows(invoice: {
  sellerId: string
  orderNumbers?: unknown
  billingStart: string
  billingEnd: string
}) {
  const numbers = Array.isArray(invoice.orderNumbers)
    ? invoice.orderNumbers.map(String).filter(Boolean)
    : []
  const start = new Date(`${invoice.billingStart}T00:00:00+05:30`)
  const end = new Date(`${invoice.billingEnd}T23:59:59.999+05:30`)
  const b2cConditions = [eq(b2c_orders.user_id, invoice.sellerId)]
  const b2bConditions = [eq(b2b_orders.user_id, invoice.sellerId)]
  if (numbers.length) {
    b2cConditions.push(inArray(b2c_orders.order_number, numbers))
    b2bConditions.push(inArray(b2b_orders.order_number, numbers))
  } else {
    b2cConditions.push(
      between(b2c_orders.created_at, start, end),
      inArray(b2c_orders.order_status, BILLABLE_ORDER_STATUSES),
    )
    b2bConditions.push(
      between(b2b_orders.created_at, start, end),
      inArray(b2b_orders.order_status, BILLABLE_ORDER_STATUSES),
    )
  }
  const [b2c, b2b] = await Promise.all([
    db
      .select()
      .from(b2c_orders)
      .where(and(...b2cConditions)),
    db
      .select()
      .from(b2b_orders)
      .where(and(...b2bConditions)),
  ])
  return uniqueShipments(
    [
      ...b2c.map((row) => ({ ...row, type: 'b2c' })),
      ...b2b.map((row) => ({ ...row, type: 'b2b' })),
    ],
    invoice.sellerId,
  )
}
