import { Request, Response } from 'express'
import { createHash, timingSafeEqual } from 'crypto'
import { and, eq } from 'drizzle-orm'
import { db, pool } from '../../models/client'
import { b2c_orders } from '../../models/schema/b2cOrders'
import { getShadowfaxConfig } from '../../models/services/shadowfaxIntegration.service'
import { pollShadowfaxTracking } from '../../crons/shadowfaxTracking'

export async function shadowfaxWebhookHandler(req: Request, res: Response) {
  try {
    const config = await getShadowfaxConfig()
    const expected = config.webhookSecret || ''
    const supplied = req.get('x-shadowfax-webhook-secret') || ''
    if (!expected) return res.status(503).json({ success: false, message: 'Shadowfax callbacks are not configured.' })
    const a = Buffer.from(expected)
    const b = Buffer.from(supplied)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return res.status(401).json({ success: false })
    // Register this explicit callback contract with Shadowfax; their schema is account-specific.
    const payload = req.body || {}
    const number = String(payload.awb_number || '')
    if (!/^[a-zA-Z0-9]{1,100}$/.test(number)) return res.status(400).json({ message: 'awb_number is required.' })
    const orders = await db.select({ id: b2c_orders.id }).from(b2c_orders)
      .where(and(eq(b2c_orders.awb_number, number), eq(b2c_orders.integration_type, 'shadowfax'))).limit(2)
    // Unknown/staging orders must never update a different courier or another seller's order.
    if (!orders.length) return res.status(200).json({ success: true, ignored: true })
    if (orders.length !== 1) return res.status(409).json({ message: 'Ambiguous AWB; reconciliation required.' })
    const canonical = {
      awb_number: number,
      status_id: String(payload.status_id || '').slice(0, 100),
      status: String(payload.status || '').slice(0, 200),
      timestamp: String(payload.last_updated_iso || payload.event_timestamp || payload.last_updated || '').slice(0, 100),
      current_location: String(payload.current_location || '').slice(0, 255),
    }
    const key = createHash('sha256').update(`${orders[0].id}:${JSON.stringify(canonical)}`).digest('hex')
    await pool.query(`INSERT INTO choicemee_shadowfax_callbacks(event_key, order_id, payload)
      VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [key, orders[0].id, canonical])
    // Durable receipt before 200; cron reconciles against authenticated carrier tracking.
    res.status(200).json({ success: true })
    setImmediate(() => { pollShadowfaxTracking().catch(() => console.warn('[Shadowfax] Callback processing deferred to scheduled reconciliation.')) })
    return
  } catch {
    return res.status(503).json({ success: false, message: 'Callback could not be stored. Tracking reconciliation will recover missed updates.' })
  }
}
