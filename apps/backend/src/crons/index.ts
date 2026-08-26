import cron from 'node-cron'
import { eq } from 'drizzle-orm'
import { db } from '../models/client'
import { stores } from '../models/schema/stores'
import { syncShopifyOrdersForUser } from '../models/services/shopify.service'
import { isRazorpayConfigured } from '../utils/razorpay'
import { generateAutoBillingInvoices } from './invoiceGenerator'
import { processPendingWebhooks } from './processPendingWebhooks'
import { reconcileMissingCodRemittances } from '../models/services/codRemittanceReconciliation.service'
import { reconcileWalletTopups } from './reconcileWalletTopups'
import { seedHolidaysCron } from './seedHolidays'
import {
  sendDailyWeightReconciliationEmails,
  sendWeeklyWeightReconciliationEmails,
} from './weightReconciliationEmails'
import { pollEkartTracking } from './ekartTracking'
import { pollDeliveryOneTracking } from './deliveryOneTracking'
import { retryFailedShipmentStatusEmails } from '../models/services/shipmentNotification.service'

let isReconcilingCodRemittances = false
let isRetryingShipmentEmails = false
let isPollingDeliveryOneTracking = false
let isSyncingShopifyOrders = false

const syncRecentShopifyOrders = async () => {
  if (isSyncingShopifyOrders) {
    console.log('[Cron] Skipping Shopify order sync: previous run still active')
    return
  }

  isSyncingShopifyOrders = true
  try {
    const connectedStores = await db
      .select({ id: stores.id, userId: stores.userId })
      .from(stores)
      .where(eq(stores.platformId, 1))

    const createdAtMin = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    let created = 0
    let updated = 0
    let skipped = 0

    for (const store of connectedStores) {
      try {
        const result = await syncShopifyOrdersForUser(
          store.userId,
          250,
          store.id,
          undefined,
          { createdAtMin, onlyUnbooked: true },
        )
        created += result.created
        updated += result.updated
        skipped += result.skipped
      } catch (error: any) {
        console.error('[Cron] Shopify order sync failed for store', {
          storeId: store.id,
          message: error?.response?.data || error?.message || String(error),
        })
      }
    }

    if (created > 0 || updated > 0) {
      console.log('[Cron] Shopify order sync finished', {
        stores: connectedStores.length,
        created,
        updated,
        skipped,
      })
    }
  } catch (error: any) {
    console.error('[Cron] Shopify order sync failed:', error?.message || error)
  } finally {
    isSyncingShopifyOrders = false
  }
}

const runCodRemittanceReconciliation = async () => {
  if (isReconcilingCodRemittances) {
    console.log('[Cron] Skipping COD remittance reconciliation: previous run still active')
    return
  }

  isReconcilingCodRemittances = true

  try {
    const result = await reconcileMissingCodRemittances()
    if (result.scanned > 0 || result.created > 0 || result.failed > 0 || result.skipped > 0) {
      console.log('[Cron] COD remittance reconciliation complete', {
        scanned: result.scanned,
        created: result.created,
        skipped: result.skipped,
        failed: result.failed,
      })
    }
  } catch (err) {
    console.error('[Cron] COD remittance reconciliation failed:', err)
  } finally {
    isReconcilingCodRemittances = false
  }
}

if (isRazorpayConfigured) {
  cron.schedule('*/20 * * * *', async () => {
    console.log('[Cron] Wallet reconciliation kicking off')
    try {
      await reconcileWalletTopups()
    } catch (err) {
      console.error('[Cron] Wallet reconciliation failed:', err)
    }
  })
} else {
  console.warn('[Cron] Wallet reconciliation skipped because Razorpay credentials are missing.')
}

cron.schedule('*/1 * * * *', () => {
  processPendingWebhooks().catch((err) => console.error('Error in cron webhook processor', err))
})

cron.schedule('0 2 * * *', () => generateAutoBillingInvoices())

cron.schedule('0 8 * * *', async () => {
  console.log('[Cron] Daily weight reconciliation emails starting...')
  try {
    await sendDailyWeightReconciliationEmails()
  } catch (err) {
    console.error('[Cron] Daily weight reconciliation emails failed:', err)
  }
})

cron.schedule('0 9 * * 1', async () => {
  console.log('[Cron] Weekly weight reconciliation reports starting...')
  try {
    await sendWeeklyWeightReconciliationEmails()
  } catch (err) {
    console.error('[Cron] Weekly weight reconciliation reports failed:', err)
  }
})

cron.schedule('*/15 * * * *', async () => {
  console.log('[Cron] Ekart tracking poll')
  try {
    await pollEkartTracking()
  } catch (err) {
    console.error('[Cron] Ekart tracking poll failed:', err)
  }
})

cron.schedule('*/3 * * * *', async () => {
  if (isPollingDeliveryOneTracking) {
    console.log('[Cron] Skipping Delhivery tracking poll: previous run still active')
    return
  }

  isPollingDeliveryOneTracking = true
  console.log('[Cron] Delhivery tracking poll')
  try {
    const stats = await pollDeliveryOneTracking()
    console.log('[Cron] Delhivery tracking poll finished', stats)
  } catch (err) {
    console.error('[Cron] Delhivery tracking poll failed:', err)
  } finally {
    isPollingDeliveryOneTracking = false
  }
})

cron.schedule('*/1 * * * *', async () => {
  if (isRetryingShipmentEmails) {
    console.log('[Cron] Skipping shipment email retry: previous run still active')
    return
  }

  isRetryingShipmentEmails = true
  try {
    const stats = await retryFailedShipmentStatusEmails()
    if (stats.checked > 0) {
      console.log('[Cron] Shipment email retry finished', stats)
    }
  } catch (err) {
    console.error('[Cron] Shipment email retry failed:', err)
  } finally {
    isRetryingShipmentEmails = false
  }
})

void runCodRemittanceReconciliation()
cron.schedule('*/5 * * * *', () => {
  runCodRemittanceReconciliation().catch((err) => {
    console.error('Error in cron COD remittance reconciliation', err)
  })
})

// Webhooks remain the fast path; this recent-order sweep recovers missed Shopify webhooks.
void syncRecentShopifyOrders()
cron.schedule('*/5 * * * *', () => {
  syncRecentShopifyOrders().catch((err) => {
    console.error('[Cron] Shopify order sync runner failed:', err)
  })
})

cron.schedule('0 0 1 1 *', () => {
  console.log('[Cron] Holiday seeding cron triggered (January 1st)')
  seedHolidaysCron().catch((err) => console.error('Error in holiday seeding cron', err))
})
