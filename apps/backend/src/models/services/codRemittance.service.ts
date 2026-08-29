import { and, desc, eq, exists, gte, isNotNull, lte, or, sql } from 'drizzle-orm'
import { db } from '../client'
import { codRemittances } from '../schema/codRemittance'
import { b2b_orders } from '../schema/b2bOrders'
import { b2c_orders } from '../schema/b2cOrders'
import { userProfiles } from '../schema/userProfile'
import { users } from '../schema/users'
import { sendCodRemittanceSettledEmail } from '../../utils/emailSender'

const getSellerDisplayName = (profile?: { companyInfo?: any } | null, email?: string | null) => {
  const companyInfo = profile?.companyInfo || {}
  return (
    companyInfo.businessName ||
    companyInfo.brandName ||
    companyInfo.companyName ||
    companyInfo.displayName ||
    companyInfo.contactPerson ||
    email ||
    'Seller'
  )
}

/**
 * A COD remittance is only valid for an order that was actually booked by a
 * courier and received an AWB. This condition is shared by client and admin
 * reads so stale/unbooked rows cannot affect either panel or settlement totals.
 */
export const bookedCodRemittanceCondition = () =>
  or(
    and(
      eq(codRemittances.orderType, 'b2c'),
      exists(
        db
          .select({ id: b2c_orders.id })
          .from(b2c_orders)
          .where(
            and(
              eq(b2c_orders.id, codRemittances.orderId),
              isNotNull(b2c_orders.awb_number),
              sql`NULLIF(TRIM(${b2c_orders.awb_number}), '') IS NOT NULL`,
            ),
          ),
      ),
    ),
    and(
      eq(codRemittances.orderType, 'b2b'),
      exists(
        db
          .select({ id: b2b_orders.id })
          .from(b2b_orders)
          .where(
            and(
              eq(b2b_orders.id, codRemittances.orderId),
              isNotNull(b2b_orders.awb_number),
              sql`NULLIF(TRIM(${b2b_orders.awb_number}), '') IS NOT NULL`,
            ),
          ),
      ),
    ),
  )

const notifySellerCodRemittanceSettled = async (remittance: any, utrNumber?: string) => {
  const [seller] = await db
    .select({
      email: users.email,
      companyInfo: userProfiles.companyInfo,
    })
    .from(users)
    .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
    .where(eq(users.id, remittance.userId))
    .limit(1)

  if (!seller?.email) {
    console.warn('[COD Remittance] Skipping settlement email because seller email is missing', {
      remittanceId: remittance.id,
      userId: remittance.userId,
    })
    return
  }

  await sendCodRemittanceSettledEmail({
    to: seller.email,
    sellerName: getSellerDisplayName({ companyInfo: seller.companyInfo }, seller.email),
    amount: Number(remittance.remittableAmount || 0),
    orderNumber: remittance.orderNumber,
    awbNumber: remittance.awbNumber,
    settledAt: remittance.creditedAt,
    utrNumber,
  })
}

/**
 * Create a COD remittance entry when an order is delivered with COD
 * DOES NOT automatically credit wallet - waits for actual courier settlement
 * Real-world flow: Order delivered → Create pending remittance → Wait for courier to settle
 */
export async function createCodRemittance(params: {
  orderId: string
  orderType: 'b2c' | 'b2b'
  userId: string
  orderNumber: string
  awbNumber?: string
  courierPartner?: string
  codAmount: number
  codCharges: number
  freightCharges: number
  /** Shipping charged to the customer and collected as part of COD. */
  shippingCharges?: number
  collectedAt?: Date
}): Promise<{ remittance: any; created: boolean }> {
  const {
    orderId,
    orderType,
    userId,
    orderNumber,
    awbNumber,
    courierPartner,
    codAmount,
    codCharges,
    freightCharges,
    shippingCharges = 0,
    collectedAt,
  } = params

  // Unbooked Shopify/manual orders must never enter COD settlement accounting.
  if (!String(awbNumber || '').trim()) {
    console.warn('[COD Remittance] Skipping creation for unbooked COD order', {
      orderId,
      orderNumber,
      orderType,
      userId,
    })
    return { remittance: null, created: false }
  }

  // The courier collects both the seller's COD amount and customer shipping.
  // Platform freight remains separate and is never added to seller remittance.
  const normalizedShippingCharges = Number.isFinite(Number(shippingCharges)) ? Number(shippingCharges) : 0
  const normalizedCodCharges = 0
  const deductions = 0
  const totalCollectedAmount = Number(codAmount) + normalizedShippingCharges

  // Idempotency guard: delivered webhooks and reconciliation jobs can be retried.
  const duplicateChecks = [and(eq(codRemittances.orderId, orderId), eq(codRemittances.orderType, orderType))]
  if (awbNumber) {
    duplicateChecks.push(eq(codRemittances.awbNumber, awbNumber))
  }

  const [existingRemittance] = await db
    .select()
    .from(codRemittances)
    .where(and(eq(codRemittances.userId, userId), or(...duplicateChecks)))
    .limit(1)

  if (existingRemittance) {
    console.log(
      `ℹ️ COD remittance already exists for order ${orderNumber} (status: ${existingRemittance.status})`,
    )
    return { remittance: existingRemittance, created: false }
  }

  // Create remittance entry with PENDING status
  const [remittance] = await db
    .insert(codRemittances)
    .values({
      userId,
      orderId,
      orderType,
      orderNumber,
      awbNumber: awbNumber || null,
      courierPartner: courierPartner || null,
      // Store the full courier-collected COD value so COD and remittable stay aligned.
      codAmount: totalCollectedAmount.toString(),
      codCharges: normalizedCodCharges.toString(),
      // Legacy column name retained for compatibility; defaulted to zero for COD remittance flow.
      shippingCharges: normalizedShippingCharges.toString(),
      deductions: deductions.toString(),
      remittableAmount: totalCollectedAmount.toString(),
      status: 'pending', // ✅ PENDING - waiting for courier settlement
      collectedAt: collectedAt || new Date(),
      notes: `COD collected by ${
        courierPartner || 'courier'
      }. No deduction applied by default. Awaiting settlement from courier partner.`,
    })
    .returning()

  console.log(
    `📦 COD Remittance created (PENDING): ₹${totalCollectedAmount} for order ${orderNumber}. Waiting for courier settlement.`,
  )

  return { remittance, created: true }
}

/**
 * Mark COD remittance as settled once the courier/admin disburses funds offline.
 * This records settlement status, amount, date, and reference in COD settlement records only.
 */
export async function markCodRemittanceSettledOffline(params: {
  remittanceId: string
  settledDate?: Date
  utrNumber?: string
  settledAmount?: number
  notes?: string
  creditedBy?: string // admin user ID
}) {
  const { remittanceId, settledDate, utrNumber, settledAmount, notes, creditedBy } = params
  const normalizedUtrNumber = String(utrNumber || '').trim()
  const normalizedNotes = String(notes || '').trim()

  const updatedRemittance = await db
    .transaction(async (tx) => {
      // 1. Get the remittance
      const [remittance] = await tx
        .select()
        .from(codRemittances)
        .where(and(eq(codRemittances.id, remittanceId), bookedCodRemittanceCondition()))

      if (!remittance) {
        throw new Error(`Remittance not found: ${remittanceId}`)
      }

      if (remittance.status === 'credited') {
        throw new Error(`Remittance already settled: ${remittance.orderNumber}`)
      }

      // 2. Remittable amount is deterministic: COD plus customer shipping.
      // A manual/CSV settlement amount must not change the seller's remittance value.
      const amountToCredit = Number(remittance.codAmount || 0)

      if (!Number.isFinite(amountToCredit) || amountToCredit <= 0) {
        throw new Error('Invalid settled amount. Amount must be greater than 0.')
      }

      // 3. Update remittance status only in COD settlement records.
      const adminNote = creditedBy
        ? `Marked as settled offline by admin (ID: ${creditedBy}). `
        : 'Marked as settled offline via settlement reconciliation. '
      const fullNotes = `${adminNote}${normalizedNotes}${
        normalizedUtrNumber ? ` UTR: ${normalizedUtrNumber}` : ''
      }`

      const [updatedRemittance] = await tx
        .update(codRemittances)
        .set({
          status: 'credited',
          creditedAt: settledDate || new Date(),
          remittableAmount: amountToCredit.toString(),
          walletTransactionId: null,
          notes: fullNotes.trim(),
          updatedAt: new Date(),
        })
        .where(eq(codRemittances.id, remittance.id))
        .returning()

      console.log(
        `✅ COD remittance marked settled offline: ₹${amountToCredit} for order ${remittance.orderNumber}`,
      )

      return updatedRemittance
    })

  try {
    await notifySellerCodRemittanceSettled(updatedRemittance, normalizedUtrNumber)
  } catch (emailError) {
    console.error('[COD Remittance] Failed to send settlement email', {
      remittanceId: updatedRemittance?.id,
      userId: updatedRemittance?.userId,
      orderNumber: updatedRemittance?.orderNumber,
      error: emailError instanceof Error ? emailError.message : String(emailError),
    })
  }

  return updatedRemittance
}

// Backward-compatible alias for older imports. The workflow marks offline settlement;
// it does not create a wallet credit transaction.
export const creditCodRemittanceToWallet = markCodRemittanceSettledOffline

/**
 * Get all COD remittances for a user with filters
 */
export async function getCodRemittances(
  userId: string,
  filters: {
    status?: string
    fromDate?: Date
    toDate?: Date
    page?: number
    limit?: number
  } = {},
) {
  const { status, fromDate, toDate, page = 1, limit = 20 } = filters
  const offset = (page - 1) * limit

  const conditions = [eq(codRemittances.userId, userId), bookedCodRemittanceCondition()]

  if (status) {
    conditions.push(eq(codRemittances.status, status as any))
  }

  if (fromDate) {
    conditions.push(gte(codRemittances.collectedAt, fromDate))
  }

  if (toDate) {
    conditions.push(lte(codRemittances.collectedAt, toDate))
  }

  const remittances = await db
    .select()
    .from(codRemittances)
    .where(and(...conditions))
    .orderBy(desc(codRemittances.collectedAt), desc(codRemittances.createdAt))
    .limit(limit)
    .offset(offset)

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(codRemittances)
    .where(and(...conditions))

  return {
    remittances,
    totalCount: Number(countResult?.count || 0),
    page,
    limit,
    totalPages: Math.ceil(Number(countResult?.count || 0) / limit),
  }
}

/**
 * Get COD remittance statistics for a user
 */
export async function getCodRemittanceStats(userId: string) {
  // Total credited remittances (Remitted Till Date)
  const [creditedStats] = await db
    .select({
      count: sql<number>`count(*)`,
      totalAmount: sql<number>`COALESCE(SUM(${codRemittances.remittableAmount}), 0)`,
    })
    .from(codRemittances)
    .where(
      and(
        eq(codRemittances.userId, userId),
        bookedCodRemittanceCondition(),
        eq(codRemittances.status, 'credited'),
      ),
    )

  // Total pending remittances (Next Remittance/Total Due)
  const [pendingStats] = await db
    .select({
      count: sql<number>`count(*)`,
      totalAmount: sql<number>`COALESCE(SUM(${codRemittances.remittableAmount}), 0)`,
    })
    .from(codRemittances)
    .where(
      and(
        eq(codRemittances.userId, userId),
        bookedCodRemittanceCondition(),
        eq(codRemittances.status, 'pending'),
      ),
    )

  // Get last credited remittance
  const [lastRemittance] = await db
    .select()
    .from(codRemittances)
    .where(and(eq(codRemittances.userId, userId), eq(codRemittances.status, 'credited')))
    .orderBy(desc(codRemittances.creditedAt))
    .limit(1)

  return {
    remittedTillDate: Number(creditedStats?.totalAmount || 0),
    lastRemittance: lastRemittance ? Number(lastRemittance.remittableAmount) : 0,
    nextRemittance: Number(pendingStats?.totalAmount || 0),
    totalDue: Number(pendingStats?.totalAmount || 0),
    // Additional info
    creditedCount: Number(creditedStats?.count || 0),
    pendingCount: Number(pendingStats?.count || 0),
  }
}

/**
 * Update remittance notes (status is auto-managed)
 */
export async function updateCodRemittanceNotes(remittanceId: string, notes: string) {
  const [updated] = await db
    .update(codRemittances)
    .set({
      notes,
      updatedAt: new Date(),
    })
    .where(eq(codRemittances.id, remittanceId))
    .returning()

  return updated
}

/**
 * Get COD dashboard summary
 */
export async function getCodDashboardSummary(userId: string) {
  const stats = await getCodRemittanceStats(userId)

  // Get recent remittances
  const recentRemittances = await db
    .select()
    .from(codRemittances)
    .where(and(eq(codRemittances.userId, userId), bookedCodRemittanceCondition()))
    .orderBy(desc(codRemittances.collectedAt), desc(codRemittances.createdAt))
    .limit(10)

  return {
    stats,
    recentRemittances,
  }
}
