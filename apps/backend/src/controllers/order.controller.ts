// controllers/shipmentController.ts
import { and, desc, eq, sql } from 'drizzle-orm'
import { Request, Response } from 'express'
import {
  checkMerchantOrderNumberAvailability,
  bookB2CCourierForOrderService,
  createB2CDraftOrderService,
  createB2BShipmentService,
  createB2CShipmentService,
  generateManifestService,
  getAllOrdersService,
  getB2BOrdersByUserService,
  getB2COrdersByUserService,
  ShipmentParams,
  requestB2CPickupByOrderIdService,
  retryFailedManifestService,
  syncB2COrderTrackingById,
  trackByAwbService,
  trackByOrderService,
} from '../models/services/shiprocket.service'
import { regenerateOrderDocumentsServiceAdmin } from '../models/services/adminOrders.service'
import { db } from '../models/client'
import { b2c_orders } from '../models/schema/b2cOrders'
import { b2b_orders } from '../models/schema/b2bOrders'

type HistoricalProduct = {
  name?: unknown
  productName?: unknown
  sku?: unknown
  qty?: unknown
  quantity?: unknown
  price?: unknown
  hsn?: unknown
  hsnCode?: unknown
  discount?: unknown
  tax_rate?: unknown
  taxRate?: unknown
}

const normalizeText = (value: unknown) => String(value ?? '').trim()

const normalizeHistoricalProducts = (value: unknown) => {
  let products = value
  if (typeof products === 'string') {
    try {
      products = JSON.parse(products)
    } catch {
      products = []
    }
  }

  if (!Array.isArray(products)) return []

  return products
    .map((product: HistoricalProduct) => ({
      productName: normalizeText(product?.productName ?? product?.name),
      sku: normalizeText(product?.sku),
      quantity: Number(product?.quantity ?? product?.qty ?? 1) || 1,
      price: Number(product?.price ?? 0) || 0,
      hsnCode: normalizeText(product?.hsnCode ?? product?.hsn),
      discount: Number(product?.discount ?? 0) || 0,
      taxRate: Number(product?.taxRate ?? product?.tax_rate ?? 0) || 0,
    }))
    .filter((product) => product.productName)
}

const normalizeOrderStatus = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')

const isEditableDraftOrder = (order: {
  order_status?: string | null
  awb_number?: string | null
  shipment_id?: string | null
  courier_partner?: string | null
  courier_id?: string | number | null
}) =>
  normalizeOrderStatus(order.order_status) === 'pending' &&
  !String(order.awb_number || '').trim() &&
  !String(order.shipment_id || '').trim() &&
  !String(order.courier_partner || '').trim() &&
  !(order.courier_id !== undefined && order.courier_id !== null && String(order.courier_id).trim())

const normalizeJsonValue = (value: unknown) => {
  if (!value) return null

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    try {
      return JSON.parse(trimmed)
    } catch (error) {
      console.warn('⚠️ Unable to parse JSON string in order update:', trimmed)
      return null
    }
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).filter((key) => {
      const entry = (value as Record<string, unknown>)[key]
      if (entry === undefined || entry === null) return false
      if (typeof entry === 'string') return entry.trim().length > 0
      return true
    })

    return keys.length ? value : null
  }

  return null
}

const buildDraftB2COrderUpdatePayload = (params: ShipmentParams) => {
  const pickupDetails = normalizeJsonValue(params.pickup) ?? {}
  const rtoDetails = normalizeJsonValue(params.rto)
  const isCodOrder = params.payment_type === 'cod'
  const orderDate =
    params.order_date instanceof Date
      ? params.order_date.toISOString().slice(0, 10)
      : String(params.order_date ?? new Date().toISOString().slice(0, 10))

  return {
    order_number: String(params.order_number || '').trim(),
    order_date: orderDate,
    order_amount: Number(params.order_amount ?? 0),
    cod_charges: isCodOrder ? Number(params.cod_charges ?? 0) : 0,
    integration_type: params.integration_type ?? null,
    buyer_name: params.consignee?.name ?? '',
    buyer_phone: params.consignee?.phone ?? '',
    buyer_email: params.consignee?.email || null,
    address: params.consignee?.address ?? '',
    city: params.consignee?.city ?? '',
    state: params.consignee?.state ?? '',
    country: 'India',
    pincode: params.consignee?.pincode ?? '',
    products: Array.isArray(params.order_items) ? params.order_items : [],
    weight: Number(params.package_weight ?? 0),
    length: Number(params.package_length ?? 0),
    breadth: Number(params.package_breadth ?? 0),
    height: Number(params.package_height ?? 0),
    order_type: params.payment_type,
    prepaid_amount: Number(params.prepaid_amount ?? 0),
    shipping_charges: Number(params.shipping_charges ?? 0),
    other_charges: Number(params.other_charges ?? 0),
    freight_charges: Number(params.freight_charges ?? 0),
    courier_cost: params.courier_cost ?? null,
    transaction_fee: Number(params.transaction_fee ?? 0),
    gift_wrap: Number(params.gift_wrap ?? 0),
    discount: Number(params.discount ?? 0),
    is_rto_different: params.is_rto_different === 'yes',
    pickup_location_id: params.pickup_location_id ?? null,
    pickup_details: pickupDetails,
    rto_details: rtoDetails,
    updated_at: new Date(),
    order_status: 'pending',
    pickup_status: 'pending',
    pickup_error: null,
    order_id: null,
    awb_number: null,
    shipment_id: null,
    courier_partner: null,
    courier_id: null,
    shipping_mode: null,
    selected_max_slab_weight: null,
    delivery_location: null,
    delivery_message: null,
    invoice_number: null,
    invoice_date: null,
    invoice_amount: null,
    label: null,
    manifest: null,
    manifest_error: null,
    manifest_retry_count: 0,
    manifest_last_retry_at: null,
    invoice_link: null,
    actual_weight: null,
    volumetric_weight: null,
    charged_weight: null,
    charged_slabs: null,
    insurance_charge: null,
    insurance_charge_basis: null,
    weight_discrepancy: false,
    is_insurance: false,
  }
}

export const createB2CShipmentController = async (req: any, res: Response) => {
  try {
    const id = req.user?.sub
    // Local order creation (via dashboard), so is_external_api = false

    // Set a longer timeout for B2C order creation (3 minutes)
    // External courier API calls (Delhivery) can take time
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Order creation timed out after 3 minutes')), 180000)
    })

    const hasSelectedCourier =
      req.body?.courier_id !== undefined &&
      req.body?.courier_id !== null &&
      String(req.body.courier_id).trim() !== '' &&
      Number(req.body.courier_id) > 0

    const shipmentPromise = hasSelectedCourier
      ? createB2CShipmentService(req.body, id, false)
      : createB2CDraftOrderService(req.body, id, false)

    const shipment = (await Promise.race([shipmentPromise, timeoutPromise])) as Awaited<
      ReturnType<typeof createB2CShipmentService>
    >

    res.status(200).json({ success: true, shipment })
  } catch (error: any) {
    console.error('Error creating B2C shipment:', {
      message: error?.message || 'Unknown error',
      statusCode: error?.statusCode ?? error?.response?.status ?? 500,
      code: error?.code ?? null,
      stack: error?.stack || null,
      response: error?.response?.data || null,
      request: {
        order_number: req.body?.order_number,
        integration_type: req.body?.integration_type,
        payment_type: req.body?.payment_type,
        courier_id: req.body?.courier_id ?? null,
      },
    })
    const statusCode = typeof error?.statusCode === 'number' ? error.statusCode : 500
    const errorMessage =
      error.message?.includes('timeout') || error.code === 'ECONNABORTED'
        ? 'Order creation is taking longer than expected. Please try again or contact support if the issue persists.'
        : error.message || 'Failed to create order. Please try again.'
    res.status(statusCode).json({ success: false, message: errorMessage })
  }
}

export const selectB2CCourierController = async (req: any, res: Response) => {
  try {
    const userId = req.user?.sub
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' })
    }

    const orderId = String(req.params.orderId || '').trim()
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'Order ID is required' })
    }

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Courier booking timed out after 3 minutes')), 180000)
    })

    const bookingPromise = bookB2CCourierForOrderService(orderId, req.body, userId)
    const result = (await Promise.race([bookingPromise, timeoutPromise])) as Awaited<
      ReturnType<typeof bookB2CCourierForOrderService>
    >

    return res.status(200).json({
      success: true,
      message: 'Courier selected and shipment booked successfully',
      shipment: result,
    })
  } catch (error: any) {
    console.error('Error selecting B2C courier:', {
      message: error?.message || 'Unknown error',
      statusCode: error?.statusCode ?? error?.response?.status ?? 500,
      response: error?.response?.data || null,
      request: {
        orderId: req.params?.orderId,
        integration_type: req.body?.integration_type,
        courier_id: req.body?.courier_id ?? null,
      },
    })

    const statusCode = typeof error?.statusCode === 'number' ? error.statusCode : 500
    const errorMessage =
      error.message?.includes('timeout') || error.code === 'ECONNABORTED'
        ? 'Courier booking is taking longer than expected. Please try again or contact support if the issue persists.'
        : error.message || 'Failed to book courier. Please try again.'

    return res.status(statusCode).json({ success: false, message: errorMessage })
  }
}

export const createB2BShipmentController = async (req: any, res: Response) => {
  try {
    const userId = req.user?.sub // Assuming you have auth middleware
    if (!userId) return res.status(401).json({ message: 'Unauthorized' })

    const params: ShipmentParams = req.body

    // Basic validation (you can enhance this with Zod/Yup)
    if (!params.order_number || !params.consignee || !params?.order_items?.length) {
      return res.status(400).json({ message: 'Invalid shipment payload' })
    }

    // Call service to create shipment (local order creation, so is_external_api = false)
    const shipmentData = await createB2BShipmentService(params, userId, false)

    return res.status(200).json({
      message: 'B2B shipment created successfully',
      shipment: shipmentData,
    })
  } catch (err: any) {
    console.error('B2B Shipment Controller Error:', err)
    const statusCode = typeof err?.statusCode === 'number' ? err.statusCode : 500
    return res.status(statusCode).json({ message: err.message || 'Internal server error' })
  }
}

export const checkOrderNumberAvailabilityController = async (req: any, res: Response) => {
  try {
    const userId = req.user?.sub
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' })
    }

    const orderNumber = req.query.orderNumber as string | undefined
    const result = await checkMerchantOrderNumberAvailability(userId, orderNumber)

    return res.status(200).json({
      success: true,
      data: {
        orderNumber: result.normalizedOrderNumber,
        available: result.available,
        message: result.available
          ? 'Order ID is available.'
          : `Order ID "${result.normalizedOrderNumber}" already exists for this merchant.`,
      },
    })
  } catch (error: any) {
    const statusCode = typeof error?.statusCode === 'number' ? error.statusCode : 500
    return res.status(statusCode).json({
      success: false,
      message: error?.message || 'Failed to check order ID availability.',
    })
  }
}

/**
 * Return the authenticated seller's customer and product history. Customer profiles are
 * derived from immutable order snapshots, so no second store of personal data is needed.
 */
export const getCustomerHistoryController = async (req: any, res: Response) => {
  try {
    const userId = req.user?.sub
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' })
    }

    const [b2cHistory, b2bHistory] = await Promise.all([
      db
        .select({
          id: b2c_orders.id,
          orderNumber: b2c_orders.order_number,
          name: b2c_orders.buyer_name,
          phone: b2c_orders.buyer_phone,
          email: b2c_orders.buyer_email,
          address: b2c_orders.address,
          city: b2c_orders.city,
          state: b2c_orders.state,
          country: b2c_orders.country,
          pincode: b2c_orders.pincode,
          products: b2c_orders.products,
          createdAt: b2c_orders.created_at,
        })
        .from(b2c_orders)
        .where(eq(b2c_orders.user_id, userId))
        .orderBy(desc(b2c_orders.created_at)),
      db
        .select({
          id: b2b_orders.id,
          orderNumber: b2b_orders.order_number,
          name: b2b_orders.buyer_name,
          phone: b2b_orders.buyer_phone,
          email: b2b_orders.buyer_email,
          address: b2b_orders.address,
          city: b2b_orders.city,
          state: b2b_orders.state,
          country: b2b_orders.country,
          pincode: b2b_orders.pincode,
          companyName: b2b_orders.company_name,
          gstin: b2b_orders.company_gst,
          products: b2b_orders.products,
          createdAt: b2b_orders.created_at,
        })
        .from(b2b_orders)
        .where(eq(b2b_orders.user_id, userId))
        .orderBy(desc(b2b_orders.created_at)),
    ])

    const orders = [
      ...b2cHistory.map((order) => ({ ...order, source: 'b2c' as const })),
      ...b2bHistory.map((order) => ({ ...order, source: 'b2b' as const })),
    ].sort((left, right) => {
      const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0
      const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0
      return rightTime - leftTime
    })

    const customerMap = new Map<string, any>()
    const productMap = new Map<string, any>()

    for (const order of orders) {
      const phone = normalizeText(order.phone)
      const pincode = normalizeText(order.pincode)
      const address = normalizeText(order.address)
      const name = normalizeText(order.name)
      const profileKey = [phone.toLowerCase(), pincode.toLowerCase(), address.toLowerCase()].join('|')
      const fallbackKey = [name.toLowerCase(), pincode.toLowerCase()].join('|')
      const customerKey = profileKey.replace(/\|/g, '') ? profileKey : fallbackKey
      const products = normalizeHistoricalProducts(order.products)

      if (!customerMap.has(customerKey)) {
        customerMap.set(customerKey, {
          id: order.id,
          name,
          phone,
          email: normalizeText(order.email),
          address,
          city: normalizeText(order.city),
          state: normalizeText(order.state),
          country: normalizeText(order.country) || 'India',
          pincode,
          companyName: normalizeText('companyName' in order ? order.companyName : ''),
          gstin: normalizeText('gstin' in order ? order.gstin : ''),
          orderCount: 0,
          lastOrderAt: order.createdAt,
          lastOrderNumber: order.orderNumber,
          orderTypes: [] as string[],
          productNames: [] as string[],
        })
      }

      const customer = customerMap.get(customerKey)
      customer.orderCount += 1
      if (!customer.orderTypes.includes(order.source)) customer.orderTypes.push(order.source)
      for (const product of products) {
        if (!customer.productNames.includes(product.productName)) {
          customer.productNames.push(product.productName)
        }

        const productKey = product.productName.toLowerCase()
        if (!productMap.has(productKey)) {
          productMap.set(productKey, {
            id: `${order.id}-${productKey}`,
            ...product,
            orderCount: 0,
            lastUsedAt: order.createdAt,
          })
        }
        productMap.get(productKey).orderCount += 1
      }
    }

    return res.status(200).json({
      success: true,
      customers: Array.from(customerMap.values()),
      products: Array.from(productMap.values()),
    })
  } catch (error: any) {
    console.error('Error fetching customer history:', error)
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to fetch customer history',
    })
  }
}

export const updateB2COrderController = async (req: any, res: Response) => {
  try {
    const userId = req.user?.sub
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' })
    }

    const orderId = String(req.params.orderId || '').trim()
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'Order ID is required' })
    }

    const [existingOrder] = await db
      .select()
      .from(b2c_orders)
      .where(and(eq(b2c_orders.id, orderId), eq(b2c_orders.user_id, userId)))
      .limit(1)

    if (!existingOrder) {
      return res.status(404).json({ success: false, message: 'Order not found' })
    }

    if (!isEditableDraftOrder(existingOrder)) {
      return res.status(400).json({
        success: false,
        message: 'Only draft orders that have not been shipped yet can be edited.',
      })
    }

    const params: ShipmentParams = req.body
    if (!params.order_number || !params.consignee || !params.order_items?.length) {
      return res.status(400).json({
        success: false,
        message: 'order_number, consignee, and order_items are required',
      })
    }

    const normalizedOrderNumber = String(params.order_number || '').trim()
    if (!normalizedOrderNumber) {
      return res.status(400).json({ success: false, message: 'Order ID is required' })
    }

    const [duplicateOrder] = await db
      .select({ id: b2c_orders.id })
      .from(b2c_orders)
      .where(
        and(
          eq(b2c_orders.user_id, userId),
          sql`lower(trim(${b2c_orders.order_number})) = ${normalizedOrderNumber.toLowerCase()}`,
          sql`${b2c_orders.id} <> ${orderId}`,
        ),
      )
      .limit(1)

    if (duplicateOrder) {
      return res.status(409).json({
        success: false,
        message: `Order ID "${normalizedOrderNumber}" already exists for this merchant. Please use a unique Order ID.`,
      })
    }

    const updates = buildDraftB2COrderUpdatePayload({
      ...params,
      order_number: normalizedOrderNumber,
    })

    await db
      .update(b2c_orders)
      .set(updates)
      .where(and(eq(b2c_orders.id, orderId), eq(b2c_orders.user_id, userId)))

    return res.status(200).json({
      success: true,
      message: 'Order updated successfully',
      data: {
        order_id: orderId,
        order_number: normalizedOrderNumber,
        status: 'pending',
      },
    })
  } catch (error: any) {
    console.error('Error updating B2C order:', error)
    const statusCode = typeof error?.statusCode === 'number' ? error.statusCode : 500
    return res.status(statusCode).json({
      success: false,
      message: error?.message || 'Failed to update order',
    })
  }
}

export const deleteB2COrderController = async (req: any, res: Response) => {
  try {
    const userId = req.user?.sub
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' })
    }

    const orderId = String(req.params.orderId || '').trim()
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'Order ID is required' })
    }

    const [existingOrder] = await db
      .select()
      .from(b2c_orders)
      .where(and(eq(b2c_orders.id, orderId), eq(b2c_orders.user_id, userId)))
      .limit(1)

    if (!existingOrder) {
      return res.status(404).json({ success: false, message: 'Order not found' })
    }

    if (!isEditableDraftOrder(existingOrder)) {
      return res.status(400).json({
        success: false,
        message: 'Only draft orders that have not been shipped yet can be deleted.',
      })
    }

    await db
      .delete(b2c_orders)
      .where(and(eq(b2c_orders.id, orderId), eq(b2c_orders.user_id, userId)))

    return res.status(200).json({
      success: true,
      message: 'Draft order deleted successfully',
      data: {
        order_id: orderId,
        order_number: existingOrder.order_number,
      },
    })
  } catch (error: any) {
    console.error('Error deleting B2C order:', error)
    const statusCode = typeof error?.statusCode === 'number' ? error.statusCode : 500
    return res.status(statusCode).json({
      success: false,
      message: error?.message || 'Failed to delete order',
    })
  }
}

export const getAllOrdersController = async (req: any, res: Response) => {
  try {
    const userId = req.user?.sub
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' })
    }

    // Pagination params
    const page = parseInt(req.query.page as string, 10) || 1
    const limit = parseInt(req.query.limit as string, 10) || 10

    // Filters from query
    const filters = {
      status: req.query.status as string | undefined,
      fromDate: req.query.fromDate as string | undefined,
      toDate: req.query.toDate as string | undefined,
      search: req.query.search as string | undefined,
    }

    const { orders, totalCount, totalPages } = await getAllOrdersService(userId, {
      page,
      limit,
      filters,
    })

    res.status(200).json({ success: true, orders, totalCount, totalPages })
  } catch (error: any) {
    console.error('Error fetching all orders:', error.message)
    res.status(500).json({ success: false, message: error.message })
  }
}

export const getB2COrdersController = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.sub
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' })
    }

    // Pagination params
    const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1)
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 10, 100)

    const rawStatusQuery = req.query['status[]'] ?? req.query.status
    const statusValues = (Array.isArray(rawStatusQuery) ? rawStatusQuery : [rawStatusQuery])
      .flatMap((status) => String(status || '').split(','))
      .map((status) =>
        status
          .trim()
          .toLowerCase()
          .replace(/[\s-]+/g, '_'),
      )
      .filter(Boolean)
    const normalizedStatus =
      statusValues.length > 1 ? statusValues : statusValues[0] || undefined

    // Filters from query
    const filters = {
      status: normalizedStatus || undefined,
      draftOnly: String(req.query.draftOnly || '').toLowerCase() === 'true',
      type: req.query.type as string | undefined,
      courier: req.query.courier as string | undefined,
      warehouse: req.query.warehouse as string | undefined,
      fromDate: req.query.fromDate as string | undefined,
      toDate: req.query.toDate as string | undefined,
      search: req.query.search as string | undefined,
      sortBy: (req.query.sortBy as 'created_at' | undefined) || 'created_at',
      sortOrder: (req.query.sortOrder as 'asc' | 'desc' | undefined) || 'desc',
    }

    const { orders, totalCount, totalPages } = await getB2COrdersByUserService(
      userId,
      page,
      limit,
      filters,
    )

    return res.status(200).json({
      success: true,
      orders,
      totalCount,
      totalPages,
    })
  } catch (error: any) {
    console.error('❌ Error fetching B2C orders', {
      userId: (req as any)?.user?.sub,
      query: req?.query,
      message: error?.message,
      stack: error?.stack,
    })

    // Detect Drizzle/PG query errors
    if (typeof error.message === 'string' && error.message.includes('Failed query')) {
      return res.status(200).json({
        success: true,
        orders: [],
        totalCount: 0,
        totalPages: 0,
      })
    }

    // Fallback generic error
    return res.status(500).json({
      success: false,
      message: 'Something went wrong while fetching orders. Please try again later.',
    })
  }
}

export const getB2BOrdersController = async (req: any, res: Response) => {
  try {
    const userId = req.user?.sub
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' })
    }

    // Pagination params
    const page = parseInt(req.query.page as string, 10) || 1
    const limit = parseInt(req.query.limit as string, 10) || 10

    // Filters from query
    const filters = {
      status: req.query.status as string | undefined,
      fromDate: req.query.fromDate as string | undefined,
      toDate: req.query.toDate as string | undefined,
      search: req.query.search as string | undefined,
      companyName: req.query.companyName as string | undefined, // optional B2B-specific filter
    }

    const { orders, totalCount, totalPages } = await getB2BOrdersByUserService(
      userId,
      page,
      limit,
      filters,
    )

    res.status(200).json({ success: true, orders, totalCount, totalPages })
  } catch (error: any) {
    console.error('❌ Error fetching B2B orders', {
      userId: req?.user?.sub,
      query: req?.query,
      message: error?.message,
      stack: error?.stack,
    })
    res.status(500).json({ success: false, message: error.message })
  }
}

export const generateManifestController = async (req: any, res: Response) => {
  try {
    const userId = req.user?.sub
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' })
    }

    const {
      awbs,
      type = 'b2c',
      pickup_date,
      pickup_time,
      expected_package_count,
      skip_pickup_request,
    } = req.body

    if (!awbs || !Array.isArray(awbs) || awbs.length === 0) {
      return res.status(400).json({ success: false, message: 'AWBs are required' })
    }

    if (!['b2c', 'b2b'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid manifest type' })
    }

    // Manifest generation can take a while when couriers process multiple orders.
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Manifest generation timed out after 10 minutes')), 600000)
    })

    const manifestPromise = generateManifestService({
      awbs,
      type,
      userId,
      pickup_date,
      pickup_time,
      expected_package_count,
      skip_pickup_request,
    })

    const { manifest_id, manifest_url, manifest_key, warnings } = (await Promise.race([
      manifestPromise,
      timeoutPromise,
    ])) as Awaited<ReturnType<typeof generateManifestService>>

    return res.status(200).json({
      success: true,
      message: 'Manifest generated and saved successfully',
      manifest_id,
      manifest_url,
      manifest_key,
      warnings,
    })
  } catch (error: any) {
    console.error('Generate manifest error:', error)
    const statusCode = typeof error?.statusCode === 'number' ? error.statusCode : 500
    // Don't expose internal error details, provide user-friendly message
    const errorMessage =
      error.message?.includes('timeout') || error.code === 'ECONNABORTED'
        ? 'Manifest generation is taking longer than expected. Please try again or contact support if the issue persists.'
        : error.message || 'Failed to generate manifest. Please try again.'
    return res.status(statusCode).json({ success: false, message: errorMessage })
  }
}

export const retryFailedManifestController = async (req: any, res: Response) => {
  try {
    const userId = req.user?.sub
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' })
    }

    const { orderId } = req.params
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'Order ID is required' })
    }

    const result = await retryFailedManifestService(String(orderId), userId)

    return res.status(200).json({
      success: true,
      message: 'Manifest retry completed successfully.',
      ...result,
    })
  } catch (error: any) {
    console.error('Retry failed manifest error:', error)
    const statusCode = typeof error?.statusCode === 'number' ? error.statusCode : 500
    return res.status(statusCode).json({
      success: false,
      message: error?.message || 'Failed to retry manifest.',
    })
  }
}

export const syncB2CTrackingController = async (req: any, res: Response) => {
  try {
    const userId = req.user?.sub
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' })
    }

    const orderId = String(req.params.orderId || '').trim()
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'Order ID is required' })
    }

    const result = await syncB2COrderTrackingById(orderId, {
      userId,
      emitEvents: true,
    })

    return res.status(200).json({
      success: true,
      message: result.changed
        ? 'Tracking status synced successfully.'
        : 'Tracking status is already up to date.',
      data: result,
    })
  } catch (error: any) {
    console.error('B2C tracking sync error:', {
      orderId: req.params?.orderId,
      userId: req.user?.sub,
      message: error?.message,
      statusCode: error?.statusCode,
      response: error?.response?.data,
    })
    const statusCode = typeof error?.statusCode === 'number' ? error.statusCode : 500
    return res.status(statusCode).json({
      success: false,
      message: error?.message || 'Failed to sync tracking status.',
    })
  }
}

export const requestB2CPickupController = async (req: any, res: Response) => {
  try {
    const userId = req.user?.sub
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' })
    }

    const orderId = String(req.params.orderId || '').trim()
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'Order ID is required' })
    }

    const result = await requestB2CPickupByOrderIdService(orderId, userId, {
      pickup_date: req.body?.pickup_date,
      pickup_time: req.body?.pickup_time,
      expected_package_count: req.body?.expected_package_count,
    })

    return res.status(200).json({
      success: true,
      message: result.existing
        ? 'Pickup request already exists and is marked as scheduled.'
        : 'Pickup request scheduled successfully.',
      data: result,
    })
  } catch (error: any) {
    console.error('B2C pickup request error:', {
      orderId: req.params?.orderId,
      userId: req.user?.sub,
      message: error?.message,
      statusCode: error?.statusCode,
      response: error?.response?.data,
    })
    const statusCode = typeof error?.statusCode === 'number' ? error.statusCode : 500
    return res.status(statusCode).json({
      success: false,
      message: error?.message || 'Failed to request pickup.',
    })
  }
}

export const regenerateOrderDocumentsController = async (req: any, res: Response) => {
  try {
    const userId = req.user?.sub
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' })
    }

    const orderId = String(req.params.orderId || '').trim()
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'Order ID is required' })
    }

    const regenerateLabel =
      typeof req.body?.regenerateLabel === 'boolean' ? req.body.regenerateLabel : true
    const regenerateInvoice =
      typeof req.body?.regenerateInvoice === 'boolean' ? req.body.regenerateInvoice : true

    const result = await regenerateOrderDocumentsServiceAdmin({
      orderId,
      regenerateLabel,
      regenerateInvoice,
      expectedUserId: userId,
    })

    return res.status(200).json({
      success: true,
      message: 'Order documents regenerated successfully',
      data: result,
    })
  } catch (error: any) {
    const statusCode = error?.message === 'Order not found' ? 404 : 400
    return res.status(statusCode).json({
      success: false,
      message: error?.message || 'Failed to regenerate order documents',
    })
  }
}

// export const getB2BOrdersController = async (req: Request, res: Response) => {
//   try {
//     const orders = await getAllB2BOrdersService()
//     res.status(200).json({ success: true, orders })
//   } catch (error: any) {
//     console.error('Error fetching B2B orders:', error.message)
//     res.status(500).json({ success: false, message: error.message })
//   }
// }

export const trackOrderController = async (req: Request, res: Response) => {
  try {
    const { awb, orderNumber, contact } = req.query

    let awbNumber: string | undefined = awb ? String(awb) : undefined

    if (!awbNumber && orderNumber && contact) {
      // Determine if contact is email or phone
      const contactStr = String(contact)
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactStr)
      const isPhone = /^\d{7,15}$/.test(contactStr)

      if (!isEmail && !isPhone) {
        return res.status(400).json({
          success: false,
          message: 'Contact must be a valid email or phone number',
        })
      }

      // Get the order by orderNumber + contact
      const orderData = await trackByOrderService({
        orderNumber: String(orderNumber),
        email: isEmail ? contactStr : undefined,
        phone: isPhone ? contactStr : undefined,
      })

      awbNumber = orderData?.awb_number ?? ''
      if (!awbNumber) {
        return res.status(400).json({
          success: false,
          message: 'AWB number not found for this order',
        })
      }
    }

    if (awbNumber) {
      // Fetch full tracking info using AWB
      const trackingData = await trackByAwbService(awbNumber)
      return res.json({ success: true, data: trackingData })
    }

    return res.status(400).json({
      success: false,
      message: "Provide either 'awb' or ('orderNumber' with 'contact')",
    })
  } catch (err: any) {
    console.error(err)
    const statusCode = Number(err?.statusCode || err?.status || 500)
    return res
      .status(statusCode >= 400 && statusCode < 600 ? statusCode : 500)
      .json({ success: false, message: err.message })
  }
}
