import { and, eq } from 'drizzle-orm'
import { db } from '../client'
import { b2c_orders } from '../schema/b2cOrders'
import { DelhiveryService } from './couriers/delhivery.service'
import { DeliveryOneService } from './couriers/deliveryone.service'
import { EkartService } from './couriers/ekart.service'
import { XpressbeesService } from './couriers/xpressbees.service'
import { applyCancellationRefundOnce } from './webhookProcessor'
import { sendShipmentStatusEmailIfChanged } from './shipmentNotification.service'
import {
  INTEGRATED_SERVICE_PROVIDERS,
  normalizeServiceProviderKey,
  supportedServiceProviderList,
} from '../../utils/courierProviders'

const resolveCancellationProvider = (order: {
  integration_type?: string | null
  courier_partner?: string | null
  courier_id?: number | string | null
}) => {
  const integration = normalizeServiceProviderKey(order.integration_type)
  if (INTEGRATED_SERVICE_PROVIDERS.includes(integration as any)) return integration

  const courierPartner = String(order.courier_partner || '')
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
  const courierId = Number(order.courier_id ?? 0)

  if (courierPartner.includes('xpressbees') || courierPartner.includes('expressbees')) {
    return 'xpressbees'
  }
  if (courierPartner.includes('deliveryone') || courierPartner.includes('delhiveryone')) {
    return 'deliveryone'
  }
  if (courierPartner.includes('delhivery') || courierId === 99 || courierId === 100) {
    return 'deliveryone'
  }

  return integration
}

export async function cancelOrderShipment(orderId: string, expectedUserId?: string) {
  console.log('🔍 Starting cancellation for orderId:', orderId)

  const [order] = await db
    .select()
    .from(b2c_orders)
    .where(
      expectedUserId
        ? and(eq(b2c_orders.id, orderId), eq(b2c_orders.user_id, expectedUserId))
        : eq(b2c_orders.id, orderId),
    )

  if (!order) {
    console.error('❌ Order not found:', orderId)
    throw new Error('Order not found')
  }

  console.log('📦 Order found:', {
    orderId: order.id,
    orderNumber: order.order_number,
    integrationType: order.integration_type,
    awbNumber: order.awb_number,
    shipmentId: order.shipment_id,
    currentStatus: order.order_status,
  })

  const cancellableStatuses = new Set([
    'pending',
    'booked',
    'confirmed',
    'pickup_initiated',
    'manifest_failed',
  ])
  const currentStatus = String(order.order_status || '').toLowerCase()
  if (!cancellableStatuses.has(currentStatus)) {
    throw new Error(`Order with status "${order.order_status}" cannot be cancelled`)
  }

  const integration = resolveCancellationProvider(order)
  if (!order.awb_number) {
    console.log('Cancelling local pending order without provider AWB', {
      orderId,
      integration,
      currentStatus: order.order_status,
    })

    await db.transaction(async (tx) => {
      await tx
        .update(b2c_orders)
        .set({ order_status: 'cancelled', updated_at: new Date() })
        .where(eq(b2c_orders.id, orderId))

      await applyCancellationRefundOnce(tx, order, 'pickup_cancel_api')
    })

    await sendShipmentStatusEmailIfChanged({
      userId: order.user_id,
      awbNumber: String(order.awb_number || order.order_number || order.id),
      orderNumber: order.order_number || null,
      orderDetails: order,
      previousStatus: currentStatus,
      nextStatus: 'cancelled',
    }).catch((err) => {
      console.error('Failed to send pickup cancellation shipment email:', err)
    })

    return {
      success: true,
      status: 'cancelled',
      message: 'Order cancelled before courier AWB generation',
      local_only: true,
    }
  }
  if (!INTEGRATED_SERVICE_PROVIDERS.includes(integration as any)) {
    console.error('❌ Unsupported integration type:', { orderId, integration })
    throw new Error(`Supported cancellation providers: ${supportedServiceProviderList()}`)
  }

  if (!order.awb_number) {
    console.error('❌ Courier cancellation failed: Missing AWB number', { orderId, integration })
    throw new Error('Cancellation requires an AWB number')
  }

  console.log('🚚 Attempting courier cancellation:', {
    orderId,
    awbNumber: order.awb_number,
    integration,
  })

  let cancellationResult: any = null
  if (integration === 'delhivery') {
    const svc = new DelhiveryService()
    cancellationResult = await svc.cancelShipment(order.awb_number)
  } else if (integration === 'deliveryone') {
    const svc = new DeliveryOneService()
    cancellationResult = await svc.cancelShipment(order.awb_number)
  } else if (integration === 'ekart') {
    const svc = new EkartService()
    cancellationResult = await svc.cancelShipment(order.awb_number)
  } else {
    const svc = new XpressbeesService()
    cancellationResult = await svc.cancelShipment(order.awb_number)
  }

  // Validate courier response
  // Check for various success indicators: boolean status, string status, success flags, or cancellation remark
  const isSuccess =
    cancellationResult?.success === true ||
    cancellationResult?.Success === true ||
    cancellationResult?.status === true || // Boolean true (most common)
    cancellationResult?.status === 'Success' ||
    cancellationResult?.status === 'success' ||
    cancellationResult?.response?.status === true ||
    (cancellationResult?.remark &&
      cancellationResult.remark.toLowerCase().includes('cancelled')) || // Check remark field for cancellation confirmation
    (cancellationResult?.message &&
      cancellationResult?.message.toLowerCase().includes('success') &&
      !cancellationResult?.error) ||
    (cancellationResult?.message &&
      cancellationResult?.message.toLowerCase().includes('cancelled') &&
      !cancellationResult?.error)

  console.log('🔍 Courier response validation:', {
    integration,
    isSuccess,
    success: cancellationResult?.success,
    Success: cancellationResult?.Success,
    status: cancellationResult?.status,
    statusType: typeof cancellationResult?.status,
    remark: cancellationResult?.remark,
    message: cancellationResult?.message,
    error: cancellationResult?.error,
    fullResponse: cancellationResult,
  })

  if (!isSuccess) {
    const errorMsg =
      cancellationResult?.error || cancellationResult?.message || 'Courier cancellation not accepted'
    console.error('❌ Courier cancellation failed:', {
      orderId,
      integration,
      response: cancellationResult,
      message: errorMsg,
    })
    throw new Error(errorMsg)
  }

  console.log('✅ Courier cancellation successful')

  const finalStatus = 'cancelled'

  console.log(`💾 Updating order status to ${finalStatus}:`, { orderId, integration })

  await db.transaction(async (tx) => {
    await tx
      .update(b2c_orders)
      .set({ order_status: finalStatus, updated_at: new Date() })
      .where(eq(b2c_orders.id, orderId))

    await applyCancellationRefundOnce(tx, order, 'pickup_cancel_api')
  })

  await sendShipmentStatusEmailIfChanged({
    userId: order.user_id,
    awbNumber: String(order.awb_number || order.order_number || order.id),
    orderNumber: order.order_number || null,
    orderDetails: order,
    previousStatus: currentStatus,
    nextStatus: finalStatus,
  }).catch((err) => {
    console.error('Failed to send pickup cancellation shipment email:', err)
  })

  console.log(`✅ Order status updated to ${finalStatus} successfully:`, { orderId, integration })

  return cancellationResult
}
