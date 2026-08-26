import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import { db } from '../client'
import { b2c_orders } from '../schema/b2cOrders'
import { codRemittances } from '../schema/codRemittance'
import { users } from '../schema/users'
import { createCodRemittance } from './codRemittance.service'

export type MissingCodRemittanceOrder = {
  orderId: string
  orderNumber: string
  awbNumber?: string | null
  orderAmount: number
  codCharges: number
  freightCharges: number
  userId: string
  userEmail?: string | null
  buyerName: string
  buyerPhone?: string | null
  courierPartner?: string | null
  collectedAt?: Date | null
}

export type CodRemittanceReconciliationResult = {
  scanned: number
  created: number
  skipped: number
  failed: number
  orders: Array<
    MissingCodRemittanceOrder & {
      remittanceId?: string
      remittableAmount?: number
      error?: string
    }
  >
}

const toNumber = (value: unknown) => {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

const toDateOrNull = (value: unknown) => {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value

  const parsed = new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export async function findMissingDeliveredCodOrders(limit = 250) {
  const rows = await db
    .select({
      orderId: b2c_orders.id,
      orderNumber: b2c_orders.order_number,
      awbNumber: b2c_orders.awb_number,
      orderAmount: b2c_orders.order_amount,
      codCharges: b2c_orders.cod_charges,
      freightCharges: b2c_orders.freight_charges,
      shippingCharges: b2c_orders.shipping_charges,
      userId: b2c_orders.user_id,
      userEmail: users.email,
      buyerName: b2c_orders.buyer_name,
      buyerPhone: b2c_orders.buyer_phone,
      courierPartner: b2c_orders.courier_partner,
      collectedAt: sql<Date | null>`COALESCE(
        (
          SELECT MAX(te.created_at)
          FROM tracking_events te
          WHERE te.awb_number = ${b2c_orders.awb_number}
            AND (
              LOWER(COALESCE(te.status_text, '')) LIKE '%deliver%'
              OR LOWER(COALESCE(te.status_code, '')) LIKE '%deliver%'
            )
        ),
        ${b2c_orders.updated_at},
        ${b2c_orders.created_at}
      )`,
    })
    .from(b2c_orders)
    .leftJoin(
      codRemittances,
      and(eq(codRemittances.orderId, b2c_orders.id), eq(codRemittances.orderType, 'b2c')),
    )
    .leftJoin(users, eq(users.id, b2c_orders.user_id))
    .where(
      and(
        eq(b2c_orders.order_type, 'cod'),
        eq(b2c_orders.order_status, 'delivered'),
        isNull(codRemittances.id),
      ),
    )
    .orderBy(asc(b2c_orders.created_at))
    .limit(limit)

  return rows.map((row) => ({
    orderId: row.orderId,
    orderNumber: row.orderNumber,
    awbNumber: row.awbNumber || null,
    orderAmount: toNumber(row.orderAmount),
    codCharges: toNumber(row.codCharges),
    freightCharges: toNumber(row.freightCharges ?? row.shippingCharges),
    userId: row.userId,
    userEmail: row.userEmail || null,
    buyerName: row.buyerName,
    buyerPhone: row.buyerPhone || null,
    courierPartner: row.courierPartner || null,
    collectedAt: toDateOrNull(row.collectedAt),
  }))
}

export async function reconcileMissingCodRemittances(limit = 250): Promise<CodRemittanceReconciliationResult> {
  const missingOrders = await findMissingDeliveredCodOrders(limit)
  const result: CodRemittanceReconciliationResult = {
    scanned: missingOrders.length,
    created: 0,
    skipped: 0,
    failed: 0,
    orders: [],
  }

  for (const order of missingOrders) {
    try {
      const { remittance, created } = await createCodRemittance({
        orderId: order.orderId,
        orderType: 'b2c',
        userId: order.userId,
        orderNumber: order.orderNumber,
        awbNumber: order.awbNumber || undefined,
        courierPartner: order.courierPartner || 'Courier',
        codAmount: order.orderAmount,
        codCharges: order.codCharges,
        freightCharges: order.freightCharges,
        shippingCharges: toNumber(order.shippingCharges),
        collectedAt: order.collectedAt || undefined,
      })

      if (created) {
        result.created += 1
        result.orders.push({
          ...order,
          remittanceId: remittance.id,
          remittableAmount: toNumber(remittance.remittableAmount),
        })
        console.log('[COD Remittance] Backfilled missing delivered COD order', {
          orderNumber: order.orderNumber,
          userEmail: order.userEmail || null,
          buyerName: order.buyerName,
          awbNumber: order.awbNumber || null,
          remittanceId: remittance.id,
        })
      } else {
        result.skipped += 1
        result.orders.push({
          ...order,
          remittanceId: remittance.id,
          remittableAmount: toNumber(remittance.remittableAmount),
        })
      }
    } catch (error) {
      result.failed += 1
      result.orders.push({
        ...order,
        error: error instanceof Error ? error.message : String(error),
      })
      console.error('[COD Remittance] Failed to backfill delivered COD order', {
        orderNumber: order.orderNumber,
        userEmail: order.userEmail || null,
        buyerName: order.buyerName,
        awbNumber: order.awbNumber || null,
        error,
      })
    }
  }

  return result
}
