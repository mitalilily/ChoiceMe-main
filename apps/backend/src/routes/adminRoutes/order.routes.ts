import { Router } from 'express'
import {
  bookManualB2CCourierController,
  createManualB2CDraftController,
  getAllOrdersControllerAdmin,
  exportOrdersControllerAdmin,
  fetchManualBookingCouriersController,
  listManualBookingUsersController,
  listManualBookingWarehousesController,
  regenerateOrderDocumentsControllerAdmin,
  updateOrderStatusControllerAdmin,
} from '../../controllers/admin/order.controller'
import { isAdminMiddleware } from '../../middlewares/isAdmin'
import { requireAuth } from '../../middlewares/requireAuth'
const router = Router()

router.get('/all-orders', requireAuth, isAdminMiddleware, getAllOrdersControllerAdmin)
router.get('/export', requireAuth, isAdminMiddleware, exportOrdersControllerAdmin)
router.get('/manual-booking/users', requireAuth, isAdminMiddleware, listManualBookingUsersController)
router.get(
  '/manual-booking/users/:userId/warehouses',
  requireAuth,
  isAdminMiddleware,
  listManualBookingWarehousesController,
)
router.post(
  '/manual-booking/b2c/create',
  requireAuth,
  isAdminMiddleware,
  createManualB2CDraftController,
)
router.post(
  '/manual-booking/b2c/available-couriers',
  requireAuth,
  isAdminMiddleware,
  fetchManualBookingCouriersController,
)
router.post(
  '/manual-booking/b2c/:orderId/select-courier',
  requireAuth,
  isAdminMiddleware,
  bookManualB2CCourierController,
)
router.post(
  '/:id/regenerate-documents',
  requireAuth,
  isAdminMiddleware,
  regenerateOrderDocumentsControllerAdmin,
)
router.patch('/:id/status', requireAuth, isAdminMiddleware, updateOrderStatusControllerAdmin)
export default router
