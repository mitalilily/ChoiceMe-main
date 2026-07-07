import { createHash } from 'crypto'
import { eq, sql } from 'drizzle-orm'
import { db, pool } from '../client'
import { userProfiles } from '../schema/userProfile'
import { users } from '../schema/users'
import {
  buildShipmentStatusEmailContent,
  sendShipmentStatusEmail,
  type ShipmentStatusEmailStage,
  type ShipmentOrderLike,
  resolveShipmentOrderLabel,
} from '../../utils/emailSender'
import {
  claimShipmentEmailDelivery,
  listRetryableShipmentEmailDeliveries,
  markShipmentEmailDeliveryFailed,
  markShipmentEmailDeliverySent,
  normalizeShipmentEmailKey,
  type ShipmentEmailDeliveryRow,
} from './shipmentEmailDeliveryLedger.service'

const normalizeStatus = (value?: string | null) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')

const firstNonEmpty = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    const trimmed = String(value || '').trim()
    if (trimmed) return trimmed
  }

  return ''
}

const normalizeEmailCandidate = (value?: string | null) => {
  const trimmed = String(value || '').trim().toLowerCase()
  if (!trimmed) return ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return ''
  return trimmed
}

const collectUniqueEmails = (...values: Array<string | null | undefined>) => {
  const seen = new Set<string>()
  const emails: string[] = []

  for (const value of values) {
    const normalized = normalizeEmailCandidate(value)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    emails.push(normalized)
  }

  return emails
}

export const deriveShipmentEmailStage = (
  status?: string | null,
): ShipmentStatusEmailStage | null => {
  const normalized = normalizeStatus(status)
  if (!normalized) return null

  if (
    normalized.includes('cancelled') ||
    normalized.includes('canceled') ||
    normalized.includes('rto') ||
    normalized.includes('lost')
  ) {
    return 'failed'
  }

  if (
    normalized.includes('undelivered') ||
    normalized.includes('ndr') ||
    normalized.includes('delivery attempted') ||
    normalized.includes('attempt failed') ||
    normalized.includes('exception') ||
    normalized.includes('not delivered')
  ) {
    return 'ndr'
  }

  if (
    normalized.includes('booked') ||
    normalized.includes('confirmed') ||
    normalized.includes('order created')
  ) {
    return 'booked'
  }

  if (normalized.includes('out for delivery') || normalized.includes('ofd')) {
    return 'out_for_delivery'
  }

  if (
    normalized.includes('picked up') ||
    normalized.includes('pickup done') ||
    normalized.includes('pickup complete') ||
    normalized.includes('pickup completed') ||
    normalized.includes('pickup successful')
  ) {
    return 'picked_up'
  }

  if (
    normalized.includes('in transit') ||
    normalized.includes('transit') ||
    normalized.includes('dispatched')
  ) {
    return 'in_transit'
  }

  if (
    normalized.includes('manifest') ||
    normalized.includes('booked') ||
    normalized.includes('pickup initiated') ||
    normalized.includes('pickup_initiated') ||
    normalized.includes('pickup scheduled') ||
    normalized.includes('pickup_scheduled') ||
    normalized.includes('shipment created') ||
    normalized.includes('created') ||
    normalized.includes('manifest generated')
  ) {
    return 'manifested'
  }

  if (normalized.includes('delivered')) {
    return 'delivered'
  }

  return null
}

async function resolveSellerBrandDetails(userId: string) {
  const [row] = await db
    .select({
      loginEmail: users.email,
      pendingEmail: users.pendingEmail,
      contactEmail: sql<string>`coalesce((${userProfiles.companyInfo} ->> 'contactEmail'), '')`,
      companyEmail: sql<string>`coalesce((${userProfiles.companyInfo} ->> 'companyEmail'), '')`,
      alternateEmail: sql<string>`coalesce((${userProfiles.companyInfo} ->> 'email'), '')`,
      supportEmail: sql<string>`coalesce((${userProfiles.companyInfo} ->> 'supportEmail'), '')`,
      notificationEmail: sql<string>`coalesce((${userProfiles.companyInfo} ->> 'notificationEmail'), '')`,
      brandName: sql<string>`coalesce(
        (${userProfiles.companyInfo} ->> 'brandName'),
        (${userProfiles.companyInfo} ->> 'businessName'),
        ''
      )`,
      logoUrl: sql<string>`coalesce(
        (${userProfiles.companyInfo} ->> 'companyLogoUrl'),
        (${userProfiles.companyInfo} ->> 'profilePicture'),
        ''
      )`,
    })
    .from(users)
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1)

  const recipientEmails = collectUniqueEmails(
    row?.contactEmail,
    row?.companyEmail,
    row?.alternateEmail,
    row?.supportEmail,
    row?.notificationEmail,
    row?.loginEmail,
    row?.pendingEmail,
  )

  return {
    recipientEmails,
    brandName: String(row?.brandName || '').trim() || null,
    logoUrl: String(row?.logoUrl || '').trim() || null,
  }
}

function resolveOrderFallbackEmail(orderDetails?: ShipmentOrderLike | null) {
  return firstNonEmpty(
    orderDetails?.buyer_email,
    orderDetails?.buyerEmail,
    orderDetails?.consignee_email,
    orderDetails?.consigneeEmail,
    orderDetails?.customer_email,
    orderDetails?.customerEmail,
    orderDetails?.email,
  )
}

const mergeShipmentOrderDetails = (
  dbOrder?: ShipmentOrderLike | null,
  suppliedOrder?: ShipmentOrderLike | null,
) => {
  if (!dbOrder && !suppliedOrder) return null
  const merged: Record<string, unknown> = { ...(dbOrder || {}) }

  for (const [key, value] of Object.entries((suppliedOrder || {}) as Record<string, unknown>)) {
    if (value === undefined || value === null) continue
    if (typeof value === 'string' && !value.trim()) continue
    merged[key] = value
  }

  return merged as ShipmentOrderLike
}

async function resolveShipmentOrderDetails(params: {
  userId: string
  orderNumber?: string | null
  awbNumber?: string | null
  suppliedOrder?: ShipmentOrderLike | null
}) {
  const result = await pool.query(
    `
      select order_details
      from (
        select to_jsonb(b2c) as order_details, 1 as priority
        from b2c_orders b2c
        where b2c.user_id = $1
          and (($2 <> '' and b2c.order_number = $2) or ($3 <> '' and b2c.awb_number = $3))
        union all
        select to_jsonb(b2b) as order_details, 2 as priority
        from b2b_orders b2b
        where b2b.user_id = $1
          and (($2 <> '' and b2b.order_number = $2) or ($3 <> '' and b2b.awb_number = $3))
      ) orders
      order by priority
      limit 1
    `,
    [params.userId, params.orderNumber || '', params.awbNumber || ''],
  )

  return mergeShipmentOrderDetails(
    (result.rows[0]?.order_details || null) as ShipmentOrderLike | null,
    params.suppliedOrder || null,
  )
}

const hasRequiredConsigneeDetails = (orderDetails?: ShipmentOrderLike | null) => {
  if (!orderDetails) return false

  const order = orderDetails as Record<string, unknown>
  const name = firstNonEmpty(
    order.buyer_name as string | null | undefined,
    order.consignee_name as string | null | undefined,
    order.customer_name as string | null | undefined,
    order.name as string | null | undefined,
  )
  const address = firstNonEmpty(
    order.address as string | null | undefined,
    order.addressLine1 as string | null | undefined,
    order.delivery_address as string | null | undefined,
    order.buyer_address as string | null | undefined,
  )
  const city = firstNonEmpty(order.city as string | null | undefined)
  const pincode = firstNonEmpty(order.pincode as string | null | undefined)
  const phone = firstNonEmpty(
    order.buyer_phone as string | null | undefined,
    order.consignee_phone as string | null | undefined,
    order.customer_phone as string | null | undefined,
    order.phone as string | null | undefined,
  )

  return Boolean(name && address && city && pincode && phone)
}

const shipmentEmailStages = new Set<ShipmentStatusEmailStage>([
  'booked',
  'manifested',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'ndr',
  'failed',
])

const isShipmentEmailStage = (value: string): value is ShipmentStatusEmailStage =>
  shipmentEmailStages.has(value as ShipmentStatusEmailStage)

const buildShipmentDeliveryMessageId = (params: {
  sellerId: string
  shipmentKey: string
  stage: ShipmentStatusEmailStage
  recipient: string
}) => {
  const digest = createHash('sha256')
    .update(
      [params.sellerId, params.shipmentKey, params.stage, params.recipient.toLowerCase()].join('|'),
    )
    .digest('hex')
    .slice(0, 40)

  return `<shipment-${digest}@choicemee.in>`
}

type ShipmentDeliveryContext = {
  userId: string
  shipmentKey: string
  awbNumber: string
  orderNumber?: string | null
  orderDetails?: ShipmentOrderLike | null
  stage: ShipmentStatusEmailStage
  recipient: string
  sellerName?: string | null
  sellerLogoUrl?: string | null
}

const buildShipmentDeliveryContext = (params: ShipmentDeliveryContext) => {
  const orderLabel = resolveShipmentOrderLabel(params.orderDetails) || params.orderNumber || null
  const content = buildShipmentStatusEmailContent({
    to: params.recipient,
    awbNumber: params.awbNumber,
    orderNumber: params.orderNumber,
    orderLabel,
    stage: params.stage,
    sellerName: params.sellerName || null,
    sellerLogoUrl: params.sellerLogoUrl || null,
    orderDetails: params.orderDetails,
  })
  const messageId = buildShipmentDeliveryMessageId({
    sellerId: params.userId,
    shipmentKey: params.shipmentKey,
    stage: params.stage,
    recipient: params.recipient,
  })

  return { orderLabel, subject: content.subject, messageId }
}

async function sendClaimedShipmentEmail(
  delivery: ShipmentEmailDeliveryRow,
  params: ShipmentDeliveryContext,
  orderLabel: string | null,
) {
  try {
    await sendShipmentStatusEmail({
      to: params.recipient,
      awbNumber: params.awbNumber,
      orderNumber: params.orderNumber,
      orderLabel,
      stage: params.stage,
      sellerName: params.sellerName || null,
      sellerLogoUrl: params.sellerLogoUrl || null,
      orderDetails: params.orderDetails,
      messageId:
        delivery.messageId ||
        buildShipmentDeliveryMessageId({
          sellerId: params.userId,
          shipmentKey: params.shipmentKey,
          stage: params.stage,
          recipient: params.recipient,
        }),
    })
    await markShipmentEmailDeliverySent(delivery.id)

    console.log('[ShipmentEmail] Delivery recorded', {
      deliveryId: delivery.id,
      userId: params.userId,
      orderNumber: params.orderNumber,
      awbNumber: params.awbNumber,
      recipient: params.recipient,
      stage: params.stage,
      attempts: delivery.attempts,
    })

    return { sent: true as const, deliveryId: delivery.id }
  } catch (error) {
    await markShipmentEmailDeliveryFailed(delivery.id, error)
    console.error('[ShipmentEmail] Failed to send seller shipment email', {
      deliveryId: delivery.id,
      userId: params.userId,
      orderNumber: params.orderNumber,
      awbNumber: params.awbNumber,
      recipient: params.recipient,
      stage: params.stage,
      error,
    })

    return { sent: false as const, deliveryId: delivery.id, error }
  }
}

async function deliverShipmentEmail(
  params: ShipmentDeliveryContext,
  options: { existingOnly?: boolean } = {},
) {
  const { orderLabel, subject, messageId } = buildShipmentDeliveryContext(params)
  const claim = await claimShipmentEmailDelivery(
    {
      sellerId: params.userId,
      shipmentKey: params.shipmentKey,
      orderNumber: params.orderNumber,
      awbNumber: params.awbNumber,
      stage: params.stage,
      recipientEmail: params.recipient,
      subject,
      messageId,
    },
    options,
  )

  if (!claim.claimed) {
    console.log('[ShipmentEmail] Delivery skipped', {
      userId: params.userId,
      orderNumber: params.orderNumber,
      awbNumber: params.awbNumber,
      recipient: params.recipient,
      stage: params.stage,
      reason: claim.reason,
    })
    return { sent: false as const, skipped: true as const, reason: claim.reason }
  }

  return sendClaimedShipmentEmail(claim.delivery, params, orderLabel)
}

async function resolveShipmentOrderForRetry(delivery: ShipmentEmailDeliveryRow) {
  return resolveShipmentOrderDetails({
    userId: delivery.sellerId,
    orderNumber: delivery.orderNumber,
    awbNumber: delivery.awbNumber,
  })
}

export async function sendShipmentStatusEmailIfChanged(params: {
  userId: string
  awbNumber: string
  orderNumber?: string | null
  orderDetails?: ShipmentOrderLike | null
  previousStatus?: string | null
  nextStatus?: string | null
}) {
  const { userId, awbNumber, orderNumber, orderDetails, previousStatus, nextStatus } = params
  const nextStage = deriveShipmentEmailStage(nextStatus)
  if (!nextStage) {
    return { sent: false, reason: 'unsupported_status' as const }
  }

  const resolvedOrderDetails = await resolveShipmentOrderDetails({
    userId,
    orderNumber,
    awbNumber,
    suppliedOrder: orderDetails,
  })

  if (!hasRequiredConsigneeDetails(resolvedOrderDetails)) {
    console.error('[ShipmentEmail] Shipment email blocked because consignee details are incomplete', {
      userId,
      orderNumber,
      awbNumber,
      hasOrderDetails: Boolean(resolvedOrderDetails),
    })
    return { sent: false, reason: 'missing_consignee_details' as const }
  }

  const sellerDetails = await resolveSellerBrandDetails(userId)
  const to = sellerDetails.recipientEmails
  const fallbackTo = resolveOrderFallbackEmail(resolvedOrderDetails)
  const recipients = to.length > 0 ? to : fallbackTo ? [fallbackTo] : []
  if (!recipients.length) {
    return { sent: false, reason: 'missing_recipient' as const }
  }

  if (!to.length && fallbackTo) {
    console.warn('[ShipmentEmail] Falling back to order email because seller email is missing', {
      userId,
      orderNumber,
      recipient: fallbackTo,
    })
  }

  const shipmentKey = normalizeShipmentEmailKey(orderNumber, awbNumber)
  if (!shipmentKey) {
    return { sent: false, reason: 'missing_shipment_key' as const }
  }

  let sentCount = 0
  let skippedCount = 0
  let failedCount = 0

  for (const recipient of recipients) {
    const result = await deliverShipmentEmail({
      userId,
      shipmentKey,
      awbNumber,
      orderNumber,
      orderDetails: resolvedOrderDetails,
      stage: nextStage,
      recipient,
      sellerName: sellerDetails.brandName,
      sellerLogoUrl: sellerDetails.logoUrl,
    })

    if (result.sent) sentCount += 1
    else if ('skipped' in result && result.skipped) skippedCount += 1
    else failedCount += 1
  }

  return {
    sent: sentCount > 0,
    stage: nextStage,
    previousStage: deriveShipmentEmailStage(previousStatus),
    to: recipients,
    sentCount,
    skippedCount,
    failedCount,
  }
}

export async function retryFailedShipmentStatusEmails(limit = 25) {
  const retryable = await listRetryableShipmentEmailDeliveries(limit)
  const stats = { checked: retryable.length, sent: 0, skipped: 0, failed: 0 }

  for (const delivery of retryable) {
    const stage = delivery.stage
    if (!isShipmentEmailStage(stage)) {
      stats.skipped += 1
      console.warn('[ShipmentEmail] Retry skipped for unsupported stage', {
        deliveryId: delivery.id,
        stage: delivery.stage,
      })
      continue
    }
    const messageId =
      delivery.messageId ||
      buildShipmentDeliveryMessageId({
        sellerId: delivery.sellerId,
        shipmentKey: delivery.shipmentKey,
        stage,
        recipient: delivery.recipientEmail,
      })

    const claim = await claimShipmentEmailDelivery(
      {
        sellerId: delivery.sellerId,
        shipmentKey: delivery.shipmentKey,
        orderNumber: delivery.orderNumber,
        awbNumber: delivery.awbNumber,
        stage,
        recipientEmail: delivery.recipientEmail,
        subject: delivery.subject,
        messageId,
      },
      { existingOnly: true },
    )

    if (!claim.claimed) {
      stats.skipped += 1
      continue
    }

    const orderDetails = await resolveShipmentOrderForRetry(claim.delivery)
    if (!hasRequiredConsigneeDetails(orderDetails)) {
      await markShipmentEmailDeliveryFailed(
        claim.delivery.id,
        new Error('Shipment order could not be resolved with complete consignee details for email retry'),
      )
      stats.failed += 1
      continue
    }

    const sellerDetails = await resolveSellerBrandDetails(claim.delivery.sellerId)
    const params: ShipmentDeliveryContext = {
      userId: claim.delivery.sellerId,
      shipmentKey: claim.delivery.shipmentKey,
      awbNumber: claim.delivery.awbNumber,
      orderNumber: claim.delivery.orderNumber,
      orderDetails,
      stage,
      recipient: claim.delivery.recipientEmail,
      sellerName: sellerDetails.brandName,
      sellerLogoUrl: sellerDetails.logoUrl,
    }
    const { orderLabel } = buildShipmentDeliveryContext(params)
    const result = await sendClaimedShipmentEmail(claim.delivery, params, orderLabel)

    if (result.sent) stats.sent += 1
    else stats.failed += 1
  }

  return stats
}
