import { backfillShopifyUnbookedPaymentModes } from '../models/services/shopify.service'
import { pool } from '../models/client'

const parseLimit = () => {
  const raw = Number(process.env.SHOPIFY_PAYMENT_BACKFILL_LIMIT || 250)
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 250
}

async function main() {
  const userId = process.env.SHOPIFY_PAYMENT_BACKFILL_USER_ID?.trim() || undefined
  const storeId = process.env.SHOPIFY_PAYMENT_BACKFILL_STORE_ID?.trim() || undefined
  const limit = parseLimit()

  console.log('[Shopify Payment Backfill] Starting', {
    userId: userId || 'all',
    storeId: storeId || 'all',
    limit,
  })

  const result = await backfillShopifyUnbookedPaymentModes({ userId, storeId, limit })

  console.log('[Shopify Payment Backfill] Finished', {
    stores: result.stores,
    scanned: result.scanned,
    corrected: result.corrected,
    skippedBooked: result.skippedBooked,
    skippedStatus: result.skippedStatus,
    unchanged: result.unchanged,
    missingLocal: result.missingLocal,
    failed: result.failed,
  })

  if (result.corrections.length) {
    console.log('[Shopify Payment Backfill] Corrections', result.corrections)
  }
}

main()
  .catch((error) => {
    console.error('[Shopify Payment Backfill] Failed', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
