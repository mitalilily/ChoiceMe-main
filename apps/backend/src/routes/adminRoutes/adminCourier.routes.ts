// routes/shippingRateRoutes.ts
import { Router } from 'express'
import {
  cancelDeliveryOneShipmentController,
  calculateDeliveryOneShippingCostController,
  createDeliveryOnePickupRequestController,
  createDeliveryOneWarehouseController,
  editDeliveryOneShipmentController,
  fetchDeliveryOneWaybillsController,
  generateDeliveryOneLabelController,
  getCourierCredentialsController,
  deleteShippingRateController,
  fetchAvailableCouriersForAdmin,
  getAllCouriersController,
  getShippingRatesController,
  importShippingRatesController,
  trackDeliveryOneShipmentController,
  updateDelhiveryCredentialsController,
  updateDeliveryOneCredentialsController,
  updateDeliveryOneEWaybillController,
  updateEkartCredentialsController,
  updateXpressbeesCredentialsController,
  updateShippingRateController,
} from '../../controllers/admin/courier.controller'
import { isAdminMiddleware } from '../../middlewares/isAdmin'
import { requireAuth } from '../../middlewares/requireAuth'
import { upload } from '../../middlewares/upload'

const router = Router()

router.get('/shipping-rates', getShippingRatesController)
router.get('/list', getAllCouriersController)

router.put(
  '/shipping-rate/:id/:planId',
  requireAuth,
  isAdminMiddleware,
  updateShippingRateController,
)
router.post(
  '/shipping-rates/import',
  requireAuth,
  isAdminMiddleware,
  upload.single('file'),
  importShippingRatesController,
)
router.post('/available', requireAuth, fetchAvailableCouriersForAdmin)
router.get('/credentials', requireAuth, isAdminMiddleware, getCourierCredentialsController)
router.put(
  '/credentials/delhivery',
  requireAuth,
  isAdminMiddleware,
  updateDelhiveryCredentialsController,
)
router.put(
  '/credentials/delivery-one',
  requireAuth,
  isAdminMiddleware,
  updateDeliveryOneCredentialsController,
)
router.get(
  '/delivery-one/waybills',
  requireAuth,
  isAdminMiddleware,
  fetchDeliveryOneWaybillsController,
)
router.post(
  '/delivery-one/waybills',
  requireAuth,
  isAdminMiddleware,
  fetchDeliveryOneWaybillsController,
)
router.get(
  '/delivery-one/shipping-cost',
  requireAuth,
  isAdminMiddleware,
  calculateDeliveryOneShippingCostController,
)
router.post(
  '/delivery-one/shipping-cost',
  requireAuth,
  isAdminMiddleware,
  calculateDeliveryOneShippingCostController,
)
router.get(
  '/delivery-one/labels',
  requireAuth,
  isAdminMiddleware,
  generateDeliveryOneLabelController,
)
router.post(
  '/delivery-one/labels',
  requireAuth,
  isAdminMiddleware,
  generateDeliveryOneLabelController,
)
router.post(
  '/delivery-one/pickups',
  requireAuth,
  isAdminMiddleware,
  createDeliveryOnePickupRequestController,
)
router.post(
  '/delivery-one/pickup-request',
  requireAuth,
  isAdminMiddleware,
  createDeliveryOnePickupRequestController,
)
router.post(
  '/delivery-one/warehouses',
  requireAuth,
  isAdminMiddleware,
  createDeliveryOneWarehouseController,
)
router.post(
  '/delivery-one/client-warehouses',
  requireAuth,
  isAdminMiddleware,
  createDeliveryOneWarehouseController,
)
router.post(
  '/delivery-one/shipments/edit',
  requireAuth,
  isAdminMiddleware,
  editDeliveryOneShipmentController,
)
router.patch(
  '/delivery-one/shipments/:waybill',
  requireAuth,
  isAdminMiddleware,
  (req, res) => {
    req.body = { ...(req.body || {}), waybill: req.params.waybill }
    return editDeliveryOneShipmentController(req, res)
  },
)
router.post(
  '/delivery-one/shipments/cancel',
  requireAuth,
  isAdminMiddleware,
  cancelDeliveryOneShipmentController,
)
router.post(
  '/delivery-one/shipments/:waybill/cancel',
  requireAuth,
  isAdminMiddleware,
  cancelDeliveryOneShipmentController,
)
router.post(
  '/delivery-one/shipments/ewaybill',
  requireAuth,
  isAdminMiddleware,
  updateDeliveryOneEWaybillController,
)
router.put(
  '/delivery-one/shipments/:waybill/ewaybill',
  requireAuth,
  isAdminMiddleware,
  updateDeliveryOneEWaybillController,
)
router.get(
  '/delivery-one/shipments/track',
  requireAuth,
  isAdminMiddleware,
  trackDeliveryOneShipmentController,
)
router.post(
  '/delivery-one/shipments/track',
  requireAuth,
  isAdminMiddleware,
  trackDeliveryOneShipmentController,
)
router.get(
  '/delivery-one/shipments/:waybill/track',
  requireAuth,
  isAdminMiddleware,
  trackDeliveryOneShipmentController,
)
router.get(
  '/delivery-one/shipments/:waybill/label',
  requireAuth,
  isAdminMiddleware,
  generateDeliveryOneLabelController,
)
router.put(
  '/credentials/ekart',
  requireAuth,
  isAdminMiddleware,
  updateEkartCredentialsController,
)
router.put(
  '/credentials/xpressbees',
  requireAuth,
  isAdminMiddleware,
  updateXpressbeesCredentialsController,
)
router.delete(
  '/shipping-rates/:planId/:id',
  requireAuth,
  isAdminMiddleware,
  deleteShippingRateController,
)

export default router
