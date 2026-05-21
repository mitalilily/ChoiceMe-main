import { and, eq, isNull, notInArray, or, sql } from 'drizzle-orm'
import { db } from '../models/client'
import { b2c_orders } from '../models/schema/b2cOrders'
import { syncB2COrderTrackingById } from '../models/services/shiprocket.service'

const terminalStatuses = ['delivered', 'cancelled', 'rto_delivered', 'manifest_failed']

const isDeliveryOneOrder = or(
  eq(b2c_orders.integration_type, 'deliveryone'),
  sql`lower(coalesce(${b2c_orders.courier_partner}, '')) like ${'%delivery one%'}`,
  sql`lower(coalesce(${b2c_orders.courier_partner}, '')) like ${'%deliveryone%'}`,
)!

export async function pollDeliveryOneTracking(batchSize = 50) {
  const pending = await db
    .select({
      id: b2c_orders.id,
      order_number: b2c_orders.order_number,
      awb_number: b2c_orders.awb_number,
    })
    .from(b2c_orders)
    .where(
      and(
        isDeliveryOneOrder,
        sql`length(trim(coalesce(${b2c_orders.awb_number}, ''))) > 0`,
        or(notInArray(b2c_orders.order_status, terminalStatuses), isNull(b2c_orders.order_status)),
      ),
    )
    .limit(batchSize)

  const stats = {
    checked: pending.length,
    synced: 0,
    changed: 0,
    failed: 0,
  }

  const concurrency = 3
  for (let index = 0; index < pending.length; index += concurrency) {
    const chunk = pending.slice(index, index + concurrency)
    await Promise.all(
      chunk.map(async (order) => {
        try {
          const result = await syncB2COrderTrackingById(order.id, {
            provider: 'deliveryone',
            emitEvents: true,
          })
          stats.synced += 1
          if (result.changed) stats.changed += 1
        } catch (err: any) {
          stats.failed += 1
          console.error('[Cron] Delivery One tracking sync failed', {
            order_id: order.id,
            order_number: order.order_number,
            awb_number: order.awb_number,
            message: err?.response?.data?.message ?? err?.message ?? 'Unknown tracking error',
          })
        }
      }),
    )
  }

  return stats
}
