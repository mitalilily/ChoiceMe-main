import { Router } from 'express'
import {
  checkOrderNumberAvailabilityController,
  createB2BShipmentController,
  createB2CShipmentController,
  deleteB2COrderController,
  generateManifestController,
  getCustomerHistoryController,
  getAllOrdersController,
  getB2BOrdersController,
  getB2COrdersController,
  regenerateOrderDocumentsController,
  requestB2CPickupController,
  retryFailedManifestController,
  selectB2CCourierController,
  updateB2COrderController,
  syncB2CTrackingController,
  trackOrderController,
} from '../controllers/order.controller'
import { requireAuth } from '../middlewares/requireAuth'

const router = Router()

// POST /b2c/shipment
router.post('/b2c/create', requireAuth, createB2CShipmentController)
router.post('/b2b/create', requireAuth, createB2BShipmentController)
router.get('/check-order-number', requireAuth, checkOrderNumberAvailabilityController)
router.get('/customers', requireAuth, getCustomerHistoryController)
router.get('/b2c/list', requireAuth, getB2COrdersController)
router.get('/b2b/list', requireAuth, getB2BOrdersController)
router.post('/b2c/:orderId/select-courier', requireAuth, selectB2CCourierController)
router.patch('/b2c/:orderId', requireAuth, updateB2COrderController)
router.delete('/b2c/:orderId', requireAuth, deleteB2COrderController)
router.post('/b2c/manifest', requireAuth, generateManifestController)
router.post('/b2c/:orderId/retry-manifest', requireAuth, retryFailedManifestController)
router.post('/b2c/:orderId/request-pickup', requireAuth, requestB2CPickupController)
router.post('/b2c/:orderId/sync-tracking', requireAuth, syncB2CTrackingController)
router.post('/:orderId/regenerate-documents', requireAuth, regenerateOrderDocumentsController)
router.get('/all', requireAuth, getAllOrdersController)

router.get('/track', trackOrderController)

export default router
