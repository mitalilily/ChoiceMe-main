import { createHash } from 'crypto'
import { eq } from 'drizzle-orm'
import { db, pool } from '../client'
import { courierCredentials } from '../schema/courierCredentials'
import { ShadowfaxConfig, ShadowfaxDirection, ShadowfaxError, ShadowfaxService, SHADOWFAX_BASES, shadowfaxBase } from './couriers/shadowfax.service'

export const shadowfaxEnabled = () => process.env.SHADOWFAX_ENABLED === 'true'

export async function getShadowfaxConfig(): Promise<ShadowfaxConfig> {
  const [row] = await db.select().from(courierCredentials).where(eq(courierCredentials.provider, 'shadowfax')).limit(1)
  return {
    apiBase: row?.apiBase || process.env.SHADOWFAX_API_BASE || SHADOWFAX_BASES.staging,
    apiKey: row?.apiKey || process.env.SHADOWFAX_API_TOKEN,
    clientId: row?.clientId || process.env.SHADOWFAX_CLIENT_ID,
    password: row?.password || process.env.SHADOWFAX_CLIENT_SECRET,
    webhookSecret: row?.webhookSecret || process.env.SHADOWFAX_WEBHOOK_SECRET,
  }
}

export async function getShadowfaxService(liveBooking = false) {
  if (liveBooking && !shadowfaxEnabled()) throw new ShadowfaxError('Shadowfax booking is disabled until onboarding is complete.', 503)
  const config = await getShadowfaxConfig()
  if (!config.apiKey && !(config.clientId && config.password)) throw new ShadowfaxError('Shadowfax credentials are not configured.', 503)
  if (liveBooking && (shadowfaxBase(config.apiBase) !== SHADOWFAX_BASES.production || !config.webhookSecret)) {
    throw new ShadowfaxError('Production Shadowfax credentials and webhook secret are required for live booking.', 503)
  }
  return new ShadowfaxService(config)
}

/** Durable reservation survives PM2 restarts and the carrier's 30-minute retry window. */
export async function placeShadowfaxBooking(service: ShadowfaxService, sellerId: string, direction: ShadowfaxDirection, payload: Record<string, any>, storage: { query: (...args: any[]) => Promise<any> } = pool) {
  const key = payload.order_details.client_order_id
  // Credential rotation must NOT invalidate booking idempotency.
  const account = createHash('sha256').update(service.base).digest('hex')
  const hash = createHash('sha256').update(JSON.stringify(payload)).digest('hex')
  const reservation = await storage.query(`INSERT INTO choicemee_shadowfax_bookings
    (account_key, client_order_id, seller_id, direction, payload_hash, state)
    VALUES ($1,$2,$3,$4,$5,'pending') ON CONFLICT DO NOTHING RETURNING client_order_id`, [account, key, sellerId, direction, hash])
  if (!reservation.rowCount) {
    const { rows: [row] } = await storage.query('SELECT * FROM choicemee_shadowfax_bookings WHERE account_key=$1 AND client_order_id=$2', [account, key])
    if (row?.seller_id !== sellerId || row?.payload_hash !== hash) throw new ShadowfaxError('Booking identity already reserved with different details. Reconcile the original booking first.', 409)
    if (row.state === 'confirmed') return { message: 'Success', data: row.response }
    throw new ShadowfaxError('Previous Shadowfax booking is pending or uncertain. Reconcile it before retrying; automatic rebooking is blocked.', 409)
  }
  try {
    const result = await service.placeOrder(direction, payload)
    // Store only operational identifiers, not full remote PII or request credentials.
    const summary = { awb_number: result.data.awb_number, id: result.data.id, sort_code: result.data.sort_code, status: result.data.status }
    await storage.query(`UPDATE choicemee_shadowfax_bookings SET state='confirmed', response=$3, updated_at=now()
      WHERE account_key=$1 AND client_order_id=$2`, [account, key, summary])
    return { ...result, data: { ...result.data, ...summary } }
  } catch (error) {
    if (error instanceof ShadowfaxError && !error.ambiguous && error.statusCode < 500) {
      // Only an explicit carrier rejection allows a corrected request.
      await storage.query("DELETE FROM choicemee_shadowfax_bookings WHERE account_key=$1 AND client_order_id=$2 AND state='pending'", [account, key])
    } else {
      await storage.query("UPDATE choicemee_shadowfax_bookings SET state='uncertain', updated_at=now() WHERE account_key=$1 AND client_order_id=$2 AND state='pending'", [account, key])
    }
    throw error
  }
}
