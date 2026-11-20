import { pool } from '../models/client'
import { syncB2COrderTrackingById } from '../models/services/shiprocket.service'
import { shadowfaxEnabled } from '../models/services/shadowfaxIntegration.service'

let running = false
export async function pollShadowfaxTracking() {
  if (!shadowfaxEnabled() || running) return
  running = true
  try {
    const pending = await pool.query(`SELECT DISTINCT order_id FROM choicemee_shadowfax_callbacks WHERE processed_at IS NULL LIMIT 20`)
    const open = await pool.query(`SELECT id FROM b2c_orders WHERE integration_type='shadowfax'
      AND awb_number IS NOT NULL AND awb_number<>''
      AND COALESCE(order_status,'') NOT IN ('delivered','cancelled','rto_delivered','lost')
      ORDER BY updated_at ASC NULLS FIRST LIMIT 20`)
    const ids: string[] = [...new Set([...pending.rows.map(r => r.order_id), ...open.rows.map(r => r.id)])]
    // Sequential bounded polling avoids bursting the shared courier account rate limit.
    for (const id of ids) {
      try {
        const cutoff = new Date()
        await syncB2COrderTrackingById(id, { provider: 'shadowfax', emitEvents: true })
        await pool.query(`UPDATE choicemee_shadowfax_callbacks SET processed_at=now()
          WHERE order_id=$1 AND received_at <= $2 AND processed_at IS NULL`, [id, cutoff])
      } catch { console.warn('[Shadowfax] Tracking reconciliation deferred for an order.') }
    }
  } finally { running = false }
}
