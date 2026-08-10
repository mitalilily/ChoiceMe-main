import { pollDeliveryOneTracking } from '../crons/deliveryOneTracking'
import { reconcileMissingCodRemittances } from '../models/services/codRemittanceReconciliation.service'

const parseLimit = (name: string, fallback: number) => {
  const parsed = Number(process.env[name] || fallback)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback
}

async function main() {
  const trackingLimit = parseLimit('DELIVERYONE_TRACKING_REPAIR_LIMIT', 0)
  const codLimit = parseLimit('COD_RECONCILIATION_LIMIT', 10000)

  console.log('[DeliveryOne Repair] Starting tracking sync', {
    trackingLimit: trackingLimit > 0 ? trackingLimit : 'all',
  })

  const tracking = await pollDeliveryOneTracking(trackingLimit)
  console.log('[DeliveryOne Repair] Tracking sync finished', tracking)

  console.log('[DeliveryOne Repair] Starting COD remittance reconciliation', { codLimit })
  const cod = await reconcileMissingCodRemittances(codLimit)
  console.log('[DeliveryOne Repair] COD remittance reconciliation finished', {
    scanned: cod.scanned,
    created: cod.created,
    skipped: cod.skipped,
    failed: cod.failed,
  })

  if (cod.orders.length > 0) {
    console.log(
      '[DeliveryOne Repair] COD orders',
      cod.orders.map((order) => ({
        orderNumber: order.orderNumber,
        awbNumber: order.awbNumber,
        userEmail: order.userEmail,
        remittanceId: order.remittanceId,
        remittableAmount: order.remittableAmount,
        error: order.error || null,
      })),
    )
  }
}

main().catch((error) => {
  console.error('[DeliveryOne Repair] Failed', error)
  process.exit(1)
})
