import { Response } from 'express'
import { getAdminDashboardStats } from '../../models/services/adminDashboard.service'

export const getAdminDashboardStatsController = async (_req: any, res: Response) => {
  try {
    const stats = await getAdminDashboardStats()
    return res.json(stats)
  } catch (error) {
    console.error('[getAdminDashboardStatsController]', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch admin dashboard stats',
    })
  }
}
