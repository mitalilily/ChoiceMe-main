import { and, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm'
import { Response } from 'express'
import { buildCsv } from '../../utils/csv'
import { db } from '../../models/client'
import { codRemittances } from '../../models/schema/codRemittance'
import { userProfiles } from '../../models/schema/userProfile'
import { users } from '../../models/schema/users'
import { wallets } from '../../models/schema/wallet'
import { markCodRemittanceSettledOffline } from '../../models/services/codRemittance.service'

const parseSettlementDate = (value: unknown) => {
  const raw = String(value || '').trim()
  const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)

  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch
    return new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0, 0)
  }

  const parsed = raw ? new Date(raw) : new Date()
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed
}

const sellerNameExpr = sql<string>`NULLIF(
  COALESCE(
    ${userProfiles.companyInfo}->>'businessName',
    ${userProfiles.companyInfo}->>'brandName',
    ${userProfiles.companyInfo}->>'companyName',
    ${userProfiles.companyInfo}->>'displayName',
    ${userProfiles.companyInfo}->>'contactPerson',
    ''
  ),
  ''
)`

/**
 * Admin: Get all COD remittances across all users
 */
export const getAllCodRemittances = async (req: any, res: Response): Promise<any> => {
  try {
    const { status, fromDate, toDate, search, page = 1, limit = 50 } = req.query
    const normalizedSearch = String(search || '').trim()

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string)
    const conditions = []

    if (status) {
      conditions.push(eq(codRemittances.status, status as any))
    }

    if (fromDate) {
      conditions.push(gte(codRemittances.collectedAt, new Date(fromDate as string)))
    }

    if (toDate) {
      const inclusiveToDate = new Date(toDate as string)
      inclusiveToDate.setHours(23, 59, 59, 999)
      conditions.push(lte(codRemittances.collectedAt, inclusiveToDate))
    }

    if (normalizedSearch) {
      conditions.push(
        or(
          ilike(codRemittances.orderNumber, `%${normalizedSearch}%`),
          ilike(codRemittances.awbNumber, `%${normalizedSearch}%`),
          ilike(users.email, `%${normalizedSearch}%`),
          ilike(sellerNameExpr, `%${normalizedSearch}%`),
        ),
      )
    }

    // Fetch remittances with user info
    const remittances = await db
      .select({
        id: codRemittances.id,
        userId: codRemittances.userId,
        userEmail: users.email,
        userName: sellerNameExpr,
        orderId: codRemittances.orderId,
        orderType: codRemittances.orderType,
        orderNumber: codRemittances.orderNumber,
        awbNumber: codRemittances.awbNumber,
        courierPartner: codRemittances.courierPartner,
        codAmount: codRemittances.codAmount,
        codCharges: codRemittances.codCharges,
        shippingCharges: codRemittances.shippingCharges,
        deductions: codRemittances.deductions,
        remittableAmount: codRemittances.remittableAmount,
        status: codRemittances.status,
        collectedAt: codRemittances.collectedAt,
        creditedAt: codRemittances.creditedAt,
        notes: codRemittances.notes,
        createdAt: codRemittances.createdAt,
      })
      .from(codRemittances)
      .leftJoin(users, eq(codRemittances.userId, users.id))
      .leftJoin(userProfiles, eq(codRemittances.userId, userProfiles.userId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(codRemittances.createdAt))
      .limit(parseInt(limit as string))
      .offset(offset)

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(codRemittances)
      .leftJoin(users, eq(codRemittances.userId, users.id))
      .leftJoin(userProfiles, eq(codRemittances.userId, userProfiles.userId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)

    return res.json({
      success: true,
      data: {
        remittances,
        totalCount: Number(countResult?.count || 0),
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        totalPages: Math.ceil(Number(countResult?.count || 0) / parseInt(limit as string)),
      },
    })
  } catch (error) {
    console.error('[getAllCodRemittances] Error:', error)
    return res.status(500).json({ success: false, message: 'Failed to fetch remittances' })
  }
}

/**
 * Admin: Get platform-wide COD statistics
 */
export const getCodPlatformStats = async (req: any, res: Response): Promise<any> => {
  try {
    // Total credited remittances
    const [creditedStats] = await db
      .select({
        count: sql<number>`count(*)`,
        totalAmount: sql<number>`COALESCE(SUM(${codRemittances.remittableAmount}), 0)`,
      })
      .from(codRemittances)
      .where(eq(codRemittances.status, 'credited'))

    // Total pending remittances
    const [pendingStats] = await db
      .select({
        count: sql<number>`count(*)`,
        totalAmount: sql<number>`COALESCE(SUM(${codRemittances.remittableAmount}), 0)`,
      })
      .from(codRemittances)
      .where(eq(codRemittances.status, 'pending'))

    // Unique users with pending remittances
    const [usersWithPending] = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${codRemittances.userId})` })
      .from(codRemittances)
      .where(eq(codRemittances.status, 'pending'))

    // Today's credited remittances
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [todayStats] = await db
      .select({
        count: sql<number>`count(*)`,
        totalAmount: sql<number>`COALESCE(SUM(${codRemittances.remittableAmount}), 0)`,
      })
      .from(codRemittances)
      .where(and(eq(codRemittances.status, 'credited'), gte(codRemittances.creditedAt, today)))

    return res.json({
      success: true,
      data: {
        totalCredited: {
          count: Number(creditedStats?.count || 0),
          amount: Number(creditedStats?.totalAmount || 0),
        },
        totalPending: {
          count: Number(pendingStats?.count || 0),
          amount: Number(pendingStats?.totalAmount || 0),
        },
        usersWithPending: Number(usersWithPending?.count || 0),
        todayCredited: {
          count: Number(todayStats?.count || 0),
          amount: Number(todayStats?.totalAmount || 0),
        },
      },
    })
  } catch (error) {
    console.error('[getCodPlatformStats] Error:', error)
    return res.status(500).json({ success: false, message: 'Failed to fetch platform stats' })
  }
}

/**
 * Admin: Get pending COD remittances grouped by seller
 */
export const getPendingCodRemittanceUserTotals = async (
  req: any,
  res: Response,
): Promise<any> => {
  try {
    const { fromDate, toDate, search, page = 1, limit = 20 } = req.query
    const normalizedSearch = String(search || '').trim()

    const parsedPage = Math.max(parseInt(page as string, 10) || 1, 1)
    const parsedLimit = Math.max(parseInt(limit as string, 10) || 20, 1)
    const offset = (parsedPage - 1) * parsedLimit

    const conditions = [eq(codRemittances.status, 'pending')]

    if (fromDate) {
      conditions.push(gte(codRemittances.collectedAt, new Date(fromDate as string)))
    }

    if (toDate) {
      const inclusiveToDate = new Date(toDate as string)
      inclusiveToDate.setHours(23, 59, 59, 999)
      conditions.push(lte(codRemittances.collectedAt, inclusiveToDate))
    }

    if (normalizedSearch) {
      const searchCondition = or(
        ilike(users.email, `%${normalizedSearch}%`),
        ilike(sellerNameExpr, `%${normalizedSearch}%`),
        ilike(codRemittances.orderNumber, `%${normalizedSearch}%`),
        ilike(codRemittances.awbNumber, `%${normalizedSearch}%`),
      )

      if (searchCondition) {
        conditions.push(searchCondition)
      }
    }

    const totalAmountExpr = sql<number>`COALESCE(SUM(${codRemittances.remittableAmount}), 0)`
    const orderCountExpr = sql<number>`COUNT(*)`
    const oldestCollectedAtExpr = sql<Date | null>`MIN(${codRemittances.collectedAt})`
    const latestCollectedAtExpr = sql<Date | null>`MAX(${codRemittances.collectedAt})`

    const userTotals = await db
      .select({
        userId: codRemittances.userId,
        userEmail: users.email,
        userName: sellerNameExpr,
        totalAmount: totalAmountExpr,
        orderCount: orderCountExpr,
        oldestCollectedAt: oldestCollectedAtExpr,
        latestCollectedAt: latestCollectedAtExpr,
      })
      .from(codRemittances)
      .leftJoin(users, eq(codRemittances.userId, users.id))
      .leftJoin(userProfiles, eq(codRemittances.userId, userProfiles.userId))
      .where(and(...conditions))
      .groupBy(codRemittances.userId, users.email, sellerNameExpr)
      .orderBy(desc(totalAmountExpr), desc(latestCollectedAtExpr))
      .limit(parsedLimit)
      .offset(offset)

    const [countResult] = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${codRemittances.userId})` })
      .from(codRemittances)
      .leftJoin(users, eq(codRemittances.userId, users.id))
      .leftJoin(userProfiles, eq(codRemittances.userId, userProfiles.userId))
      .where(and(...conditions))

    return res.json({
      success: true,
      data: {
        users: userTotals.map((row: any) => ({
          ...row,
          totalAmount: Number(row.totalAmount || 0),
          orderCount: Number(row.orderCount || 0),
        })),
        totalCount: Number(countResult?.count || 0),
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.ceil(Number(countResult?.count || 0) / parsedLimit),
      },
    })
  } catch (error) {
    console.error('[getPendingCodRemittanceUserTotals] Error:', error)
    return res.status(500).json({ success: false, message: 'Failed to fetch user COD totals' })
  }
}

/**
 * Admin: Get user-specific COD remittances
 */
export const getUserCodRemittances = async (req: any, res: Response): Promise<any> => {
  try {
    const { userId } = req.params
    const { status, fromDate, toDate, page = 1, limit = 100 } = req.query

    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID required' })
    }

    // Get user details
    const [user] = await db.select().from(users).where(eq(users.id, userId))

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' })
    }

    const parsedPage = Math.max(parseInt(page as string, 10) || 1, 1)
    const parsedLimit = Math.max(parseInt(limit as string, 10) || 100, 1)
    const offset = (parsedPage - 1) * parsedLimit

    const conditions = [eq(codRemittances.userId, userId)]

    if (status) {
      conditions.push(eq(codRemittances.status, status as any))
    }

    if (fromDate) {
      conditions.push(gte(codRemittances.collectedAt, new Date(fromDate as string)))
    }

    if (toDate) {
      const inclusiveToDate = new Date(toDate as string)
      inclusiveToDate.setHours(23, 59, 59, 999)
      conditions.push(lte(codRemittances.collectedAt, inclusiveToDate))
    }

    // Get remittances
    const remittances = await db
      .select()
      .from(codRemittances)
      .where(and(...conditions))
      .orderBy(desc(codRemittances.createdAt))
      .limit(parsedLimit)
      .offset(offset)

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(codRemittances)
      .where(and(...conditions))

    // Get stats
    const [creditedStats] = await db
      .select({
        count: sql<number>`count(*)`,
        totalAmount: sql<number>`COALESCE(SUM(${codRemittances.remittableAmount}), 0)`,
      })
      .from(codRemittances)
      .where(and(eq(codRemittances.userId, userId), eq(codRemittances.status, 'credited')))

    const [pendingStats] = await db
      .select({
        count: sql<number>`count(*)`,
        totalAmount: sql<number>`COALESCE(SUM(${codRemittances.remittableAmount}), 0)`,
      })
      .from(codRemittances)
      .where(and(eq(codRemittances.userId, userId), eq(codRemittances.status, 'pending')))

    // Get wallet balance
    const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, userId))

    return res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          // name: user.name,
        },
        stats: {
          credited: {
            count: Number(creditedStats?.count || 0),
            amount: Number(creditedStats?.totalAmount || 0),
          },
          pending: {
            count: Number(pendingStats?.count || 0),
            amount: Number(pendingStats?.totalAmount || 0),
          },
          walletBalance: Number(wallet?.balance || 0),
        },
        remittances,
        totalCount: Number(countResult?.count || 0),
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.ceil(Number(countResult?.count || 0) / parsedLimit),
      },
    })
  } catch (error) {
    console.error('[getUserCodRemittances] Error:', error)
    return res.status(500).json({ success: false, message: 'Failed to fetch user remittances' })
  }
}

/**
 * Admin: Manually mark settlement when courier settles offline
 * Real-world flow: Courier sends money → Admin receives it offline → Panel is marked settled
 */
export const manualCreditWallet = async (req: any, res: Response): Promise<any> => {
  try {
    const { remittanceId } = req.params
    const { settledDate, utrNumber, settledAmount, notes } = req.body || {}
    const normalizedUtrNumber = String(utrNumber || '').trim()
    const parsedSettledAmount = Number(settledAmount)
    const normalizedNotes = String(notes || '').trim()

    if (!remittanceId) {
      return res.status(400).json({ success: false, message: 'Remittance ID required' })
    }

    if (!normalizedUtrNumber) {
      return res.status(400).json({ success: false, message: 'UTR number is required' })
    }

    if (!Number.isFinite(parsedSettledAmount) || parsedSettledAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid settled amount. Amount must be greater than 0.',
      })
    }

    // Mark settlement using the shared service function
    const updated = await markCodRemittanceSettledOffline({
      remittanceId,
      settledDate: parseSettlementDate(settledDate),
      utrNumber: normalizedUtrNumber,
      settledAmount: parsedSettledAmount,
      notes: normalizedNotes || 'Manually marked as settled offline by admin',
      creditedBy: req.user?.sub || 'admin',
    })

    return res.json({
      success: true,
      message: 'COD remittance marked as settled successfully',
      data: updated,
    })
  } catch (error: any) {
    console.error('[manualCreditWallet] Error:', error)
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to mark remittance as settled',
    })
  }
}

/**
 * Admin: Update remittance notes
 */
export const updateRemittanceNotes = async (req: any, res: Response): Promise<any> => {
  try {
    const { remittanceId } = req.params
    const { notes } = req.body

    if (!remittanceId) {
      return res.status(400).json({ success: false, message: 'Remittance ID required' })
    }

    const [updated] = await db
      .update(codRemittances)
      .set({
        notes,
        updatedAt: new Date(),
      })
      .where(eq(codRemittances.id, remittanceId))
      .returning()

    return res.json({ success: true, data: updated })
  } catch (error) {
    console.error('[updateRemittanceNotes] Error:', error)
    return res.status(500).json({ success: false, message: 'Failed to update notes' })
  }
}

/**
 * Admin: Export all COD remittances as CSV
 */
export const exportAllCodRemittances = async (req: any, res: Response): Promise<any> => {
  try {
    const { status, fromDate, toDate, search } = req.query
    const normalizedSearch = String(search || '').trim()

    const conditions = []

    if (status) {
      conditions.push(eq(codRemittances.status, status as any))
    }

    if (fromDate) {
      conditions.push(gte(codRemittances.collectedAt, new Date(fromDate as string)))
    }

    if (toDate) {
      const inclusiveToDate = new Date(toDate as string)
      inclusiveToDate.setHours(23, 59, 59, 999)
      conditions.push(lte(codRemittances.collectedAt, inclusiveToDate))
    }

    if (normalizedSearch) {
      conditions.push(
        or(
          ilike(codRemittances.orderNumber, `%${normalizedSearch}%`),
          ilike(codRemittances.awbNumber, `%${normalizedSearch}%`),
          ilike(users.email, `%${normalizedSearch}%`),
          ilike(sellerNameExpr, `%${normalizedSearch}%`),
        ),
      )
    }

    const remittances = await db
      .select({
        orderNumber: codRemittances.orderNumber,
        awbNumber: codRemittances.awbNumber,
        userEmail: users.email,
        userName: sellerNameExpr,
        courierPartner: codRemittances.courierPartner,
        codAmount: codRemittances.codAmount,
        deductions: codRemittances.deductions,
        remittableAmount: codRemittances.remittableAmount,
        status: codRemittances.status,
        collectedAt: codRemittances.collectedAt,
        creditedAt: codRemittances.creditedAt,
      })
      .from(codRemittances)
      .leftJoin(users, eq(codRemittances.userId, users.id))
      .leftJoin(userProfiles, eq(codRemittances.userId, userProfiles.userId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(codRemittances.createdAt))
      .limit(10000)

    const headers = [
      'Order Number',
      'AWB',
      'User Email',
      'User Name',
      'Courier',
      'COD Amount',
      'Deductions',
      'Remittable',
      'Status',
      'Collected At',
      'Settled At',
    ]

    const rows = remittances.map((r: any) => [
      r.orderNumber,
      r.awbNumber || 'N/A',
      r.userEmail || 'N/A',
      r.userName || 'N/A',
      r.courierPartner || 'N/A',
      r.codAmount,
      r.deductions,
      r.remittableAmount,
      r.status,
      r.collectedAt ? new Date(r.collectedAt).toISOString() : 'N/A',
      r.creditedAt ? new Date(r.creditedAt).toISOString() : 'N/A',
    ])

    const csv = buildCsv(headers, rows)

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename=admin_cod_remittances.csv')
    return res.send(csv)
  } catch (error) {
    console.error('[exportAllCodRemittances] Error:', error)
    return res.status(500).json({ success: false, message: 'Failed to export remittances' })
  }
}
