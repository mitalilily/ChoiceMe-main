import express from 'express'
import { getAdminDashboardStatsController } from '../../controllers/admin/dashboard.admin.controller'
import { isAdminMiddleware } from '../../middlewares/isAdmin'
import { requireAuth } from '../../middlewares/requireAuth'

const router = express.Router()

router.get('/dashboard/stats', requireAuth, isAdminMiddleware, getAdminDashboardStatsController)

export default router
