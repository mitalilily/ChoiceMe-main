import { Router } from 'express'
import {
  approveQuickDetailController,
  generateQuickDetailLinkController,
  getQuickDetailPublicController,
  listQuickDetailsController,
  rejectQuickDetailController,
  submitQuickDetailPublicController,
} from '../controllers/quickDetails.controller'
import { requireAuth } from '../middlewares/requireAuth'

const router = Router()

router.get('/', requireAuth, listQuickDetailsController)
router.post('/generate', requireAuth, generateQuickDetailLinkController)
router.post('/:id/approve', requireAuth, approveQuickDetailController)
router.post('/:id/reject', requireAuth, rejectQuickDetailController)

router.get('/public/:storeSlug/:token', getQuickDetailPublicController)
router.post('/public/:storeSlug/:token', submitQuickDetailPublicController)

export default router
