import { Request, Response } from 'express'
import { and, count, eq } from 'drizzle-orm'
import { db } from '../models/client'
import { walletTopups } from '../models/schema/wallet'
import { getUserWalletTransactions } from '../models/services/wallet.service'
import { walletOfUser } from '../models/services/walletTopupService'

export const getUserWalletBalance = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user?.sub
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const balance = await walletOfUser(userId)
    const [successfulTopupCountResult] = await db
      .select({ count: count() })
      .from(walletTopups)
      .where(and(eq(walletTopups.walletId, balance.id), eq(walletTopups.status, 'success')))
    const hasSuccessfulTopup = Number(successfulTopupCountResult?.count ?? 0) > 0

    res.status(200).json({ message: 'success', data: { ...balance, hasSuccessfulTopup } })
  } catch (error) {
    console.error('Wallet balance error:', error)
    const message = error instanceof Error ? error.message : ''
    if (message === 'Wallet not found for this user' || message === 'Wallet not found') {
      return res.status(404).json({ error: 'Wallet not found' })
    }

    res.status(500).json({ error: 'Server error fetching wallet balance' })
  }
}

export const getWalletTransactionsController = async (req: any, res: Response) => {
  try {
    const userId = req.user?.sub // assuming you set user in middleware
    if (!userId) return res.status(401).json({ message: 'Unauthorized' })

    const {
      limit = 50,
      page = 1,
      type, // 'credit' | 'debit'
      reason,
      dateFrom, // ISO string
      dateTo, // ISO string
    } = req.query

    const offset = (Number(page) - 1) * Number(limit)

    const transactions = await getUserWalletTransactions({
      userId,
      limit: Number(limit),
      offset,
      type: type as 'credit' | 'debit' | undefined,
      reason: typeof reason === 'string' ? reason : undefined,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
    })

    return res.status(200).json(transactions)
  } catch (err: any) {
    console.error('Error fetching wallet transactions:', err)
    return res.status(500).json({ message: 'Something went wrong', error: err.message })
  }
}
