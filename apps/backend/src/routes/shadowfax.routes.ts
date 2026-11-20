import { Router } from 'express'
import { eq } from 'drizzle-orm'
import { requireAuth } from '../middlewares/requireAuth'
import { isAdminMiddleware } from '../middlewares/isAdmin'
import { db } from '../models/client'
import { courierCredentials } from '../models/schema/courierCredentials'
import { b2c_orders } from '../models/schema/b2cOrders'
import { getShadowfaxConfig, getShadowfaxService, placeShadowfaxBooking, shadowfaxEnabled } from '../models/services/shadowfaxIntegration.service'
import { shadowfaxOrderId } from '../models/services/couriers/shadowfaxPayload'
import { SHADOWFAX_BASES, ShadowfaxDirection, ShadowfaxError, shadowfaxBase } from '../models/services/couriers/shadowfax.service'

const router = Router()
router.use(requireAuth, isAdminMiddleware)
const handle = (fn: (req: any, res: any) => Promise<any>) => async (req: any, res: any) => {
  try { await fn(req, res) }
  catch (error: any) {
    const known = error instanceof ShadowfaxError
    res.status(known ? error.statusCode : 500).json({ success: false, message: known ? error.message : 'Shadowfax operation could not be completed.' })
  }
}

router.get('/configuration', handle(async (_req, res) => {
  const config = await getShadowfaxConfig()
  res.json({ success: true, data: {
    enabled: shadowfaxEnabled(), apiBase: config.apiBase,
    hasApiToken: !!config.apiKey, hasOAuthCredentials: !!(config.clientId && config.password),
    hasWebhookSecret: !!config.webhookSecret,
    callbackUrl: 'https://api.choicemee.in/api/webhooks/shadowfax',
    callbackSecretHeader: 'x-shadowfax-webhook-secret',
  } })
}))

router.put('/configuration', handle(async (req, res) => {
  const input = req.body || {}
  if (input.enabled != null) throw new ShadowfaxError('Activation requires server-side SHADOWFAX_ENABLED after staging verification.', 400)
  const [existing] = await db.select().from(courierCredentials).where(eq(courierCredentials.provider, 'shadowfax')).limit(1)
  const values: any = { provider: 'shadowfax', updatedAt: new Date() }
  if (shadowfaxEnabled() && input.apiBase !== undefined && shadowfaxBase(input.apiBase) !== SHADOWFAX_BASES.production) throw new ShadowfaxError('Cannot switch an active production integration to staging.', 409)
  if (input.apiBase !== undefined) values.apiBase = shadowfaxBase(input.apiBase)
  else if (!existing) values.apiBase = SHADOWFAX_BASES.staging
  for (const field of ['apiKey', 'clientId', 'password', 'webhookSecret']) {
    if (input[field] !== undefined) {
      if (typeof input[field] !== 'string' || input[field].length > 255 || /[\r\n]/.test(input[field])) throw new ShadowfaxError(`Invalid ${field}.`, 400)
      values[field] = input[field].trim()
    }
  }
  if (existing) await db.update(courierCredentials).set(values).where(eq(courierCredentials.provider, 'shadowfax'))
  else await db.insert(courierCredentials).values(values)
  res.json({ success: true, message: 'Shadowfax configuration saved. Booking activation is unchanged.' })
}))

/** Operator API tools. Raw test booking is staging-only; production uses the normal billed flow. */
router.post('/:direction/:operation', handle(async (req, res) => {
  const direction: ShadowfaxDirection = req.params.direction
  if (direction !== 'forward' && direction !== 'reverse') throw new ShadowfaxError('Direction must be forward or reverse.', 400)
  const service = await getShadowfaxService()
  const body = req.body || {}
  const operation = req.params.operation
  const referenced = operation === 'bulk-track' || operation === 'pod' ? body.awbNumbers :
    ['track', 'label', 'update', 'cancel', 'escalation-categories', 'escalate'].includes(operation) ? [body.awbNumber] : []
  if (service.base === SHADOWFAX_BASES.production && Array.isArray(referenced)) {
    for (const number of referenced) {
      const rows = await db.select().from(b2c_orders).where(eq(b2c_orders.awb_number, String(number))).limit(2)
      if (rows.length !== 1 || rows[0].integration_type !== 'shadowfax' ||
        (rows[0].order_type === 'reverse') !== (direction === 'reverse')) throw new ShadowfaxError('Matching local Shadowfax order not found.', 404)
    }
  }
  let data: any
  switch (operation) {
    case 'book': {
      if (service.base !== SHADOWFAX_BASES.staging) throw new ShadowfaxError('Use the existing order booking workflow for production shipments.', 400)
      const payload = body.payload
      if (!payload?.order_details?.client_order_id) throw new ShadowfaxError('A complete order payload and client order ID are required.', 400)
      payload.order_details.client_order_id = shadowfaxOrderId(req.user.sub, String(payload.order_details.client_order_id))
      data = await placeShadowfaxBooking(service, req.user.sub, direction, payload)
      break
    }
    case 'update': {
      // Existing seller UI only edits drafts. Do not silently diverge booked addresses,
      // COD amounts or billed weights from the local order through a raw carrier tool.
      if (service.base === SHADOWFAX_BASES.production &&
        (direction === 'reverse' || Object.keys(body.payload || {}).some(key => key !== 'status_update') || !body.payload?.status_update)) {
        throw new ShadowfaxError('Raw booked-order detail updates are staging-only. Production permits forward RTO/RTS/NDR status actions; edit unbooked details through the existing draft workflow.', 409)
      }
      data = await service.updateOrder(direction, { ...body.payload, awb_number: body.awbNumber }); break
    }
    case 'cancel': {
      if (service.base === SHADOWFAX_BASES.production) {
        const { cancelOrderShipment } = await import('../models/services/pickup.service')
        const [order] = await db.select().from(b2c_orders).where(eq(b2c_orders.awb_number, body.awbNumber)).limit(1)
        data = await cancelOrderShipment(order.id, order.user_id)
      } else data = await service.cancelOrder(direction, body.awbNumber, body.remarks)
      break
    }
    case 'track': data = await service.trackOrder(direction, body.awbNumber); break
    case 'bulk-track': data = await service.bulkTrack(direction, body.awbNumbers); break
    case 'serviceability': data = await service.serviceability(body.service, body.pincodes, body.page, body.count); break
    case 'rate': data = await service.rate(body.originPincode, body.destinationPincode, body.qc === true && direction === 'reverse' ? 'reverse_qc' : direction, Number(body.weightKg)); break
    case 'label': {
      if (direction !== 'forward') throw new ShadowfaxError('Shadowfax carrier label API is forward-only.', 400)
      data = await service.label(body.awbNumber, body.fileType); break
    }
    case 'pod': data = await service.pod(body.awbNumbers); break
    case 'escalation-categories': data = await service.escalationCategories(body.awbNumber); break
    case 'escalate': data = await service.raiseEscalation(body.awbNumber, Number(body.category), body.comments); break
    case 'awbs': data = await service.generateAwbs(direction, body.count); break
    case 'fresh-awbs': data = await service.requestFreshAwbs(direction, body.count); break
    case 'awb-result': data = await service.pollFreshAwbs(Number(body.requestId)); break
    default: throw new ShadowfaxError('Unknown Shadowfax operation.', 404)
  }
  res.setHeader('Cache-Control', 'no-store')
  res.json({ success: true, data })
}))

export default router
