import { Response } from 'express'
import { and, eq, ilike, or } from 'drizzle-orm'
import { db } from '../../models/client'
import { b2c_orders } from '../../models/schema/b2cOrders'
import { addresses, pickupAddresses } from '../../models/schema/pickupAddresses'
import { userProfiles } from '../../models/schema/userProfile'
import { users } from '../../models/schema/users'
import {
  getAllOrdersServiceAdmin,
  regenerateOrderDocumentsServiceAdmin,
  updateOrderStatusServiceAdmin,
} from '../../models/services/adminOrders.service'
import {
  bookB2CCourierForOrderService,
  createB2CDraftOrderService,
  fetchAvailableCouriersWithRates,
} from '../../models/services/shiprocket.service'
import {
  ADMIN_ORDER_EXPORT_HEADERS,
  toAdminOrderExportRow,
} from '../../utils/adminOrderExportCsv'
import { extractCodChargeBasisFromBody, extractOrderAmountFromBody } from '../../utils/orderAmount'
import { buildCsv } from '../../utils/csv'

const normalizeSearch = (value: unknown) => String(value || '').trim()

const getCompanyName = (profile: any) =>
  profile?.companyInfo?.businessName ||
  profile?.companyInfo?.brandName ||
  profile?.companyInfo?.companyName ||
  profile?.companyInfo?.displayName ||
  profile?.companyInfo?.contactPerson ||
  null

const assertManualBookingUser = async (userId: string) => {
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      phone: users.phone,
      role: users.role,
      approved: userProfiles.approved,
      onboardingComplete: userProfiles.onboardingComplete,
      companyInfo: userProfiles.companyInfo,
    })
    .from(users)
    .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(
      and(
        eq(users.id, userId),
        eq(users.role, 'customer'),
        eq(userProfiles.approved, true),
        eq(userProfiles.onboardingComplete, true),
      ),
    )
    .limit(1)

  if (!row) {
    const error: any = new Error('Selected user is not fully registered or approved.')
    error.statusCode = 400
    throw error
  }

  return row
}

export const getAllOrdersControllerAdmin = async (req: any, res: Response) => {
  try {
    // Pagination params
    const page = parseInt(req.query.page as string, 10) || 1
    const limit = parseInt(req.query.limit as string, 10) || 10

    // Filters from query
    const filters = {
      status: req.query.status as string | undefined,
      fromDate: req.query.fromDate as string | undefined,
      toDate: req.query.toDate as string | undefined,
      search: req.query.search as string | undefined,
      userId: req.query.userId as string | undefined,
      type: req.query.type as 'b2c' | 'b2b' | undefined,
      tag: req.query.tag as string | undefined,
      pickupStatus: req.query.pickupStatus as string | undefined,
      dashboardView: req.query.dashboardView as string | undefined,
      businessDate: req.query.businessDate as string | undefined,
      sortBy: (req.query.sortBy as 'created_at' | undefined) || 'created_at',
      sortOrder: (req.query.sortOrder as 'asc' | 'desc' | undefined) || 'desc',
    }

    const { orders, totalCount, totalPages } = await getAllOrdersServiceAdmin({
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

export const exportOrdersControllerAdmin = async (req: any, res: Response) => {
  try {
    // Filters from query
    const filters = {
      status: req.query.status as string | undefined,
      fromDate: req.query.fromDate as string | undefined,
      toDate: req.query.toDate as string | undefined,
      search: req.query.search as string | undefined,
      userId: req.query.userId as string | undefined,
      type: req.query.type as 'b2c' | 'b2b' | undefined,
      tag: req.query.tag as string | undefined,
      pickupStatus: req.query.pickupStatus as string | undefined,
      dashboardView: req.query.dashboardView as string | undefined,
      businessDate: req.query.businessDate as string | undefined,
      sortBy: (req.query.sortBy as 'created_at' | undefined) || 'created_at',
      sortOrder: (req.query.sortOrder as 'asc' | 'desc' | undefined) || 'desc',
    }

    // Fetch all orders without pagination for export
    const { orders } = await getAllOrdersServiceAdmin({
      page: 1,
      limit: 100000, // Large limit to get all orders
      filters,
    })

    const rows = orders.map(toAdminOrderExportRow)
    const csv = buildCsv(ADMIN_ORDER_EXPORT_HEADERS, rows)

    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename=orders_export_${new Date().toISOString().split('T')[0]}.csv`)
    res.status(200).send(csv)
  } catch (error: any) {
    console.error('Error exporting orders:', error.message)
    res.status(500).json({ success: false, message: error.message })
  }
}

export const listManualBookingUsersController = async (req: any, res: Response) => {
  try {
    const search = normalizeSearch(req.query.search)
    const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 30, 1), 100)

    const baseWhere = and(
      eq(users.role, 'customer'),
      eq(userProfiles.approved, true),
      eq(userProfiles.onboardingComplete, true),
      search
        ? or(
            ilike(users.email, `%${search}%`),
            ilike(users.phone, `%${search}%`),
          )
        : undefined,
    )

    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        phone: users.phone,
        companyInfo: userProfiles.companyInfo,
        businessType: userProfiles.businessType,
      })
      .from(users)
      .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(baseWhere)
      .limit(limit)

    const normalizedRows = rows
      .map((row) => ({
        id: row.id,
        email: row.email,
        phone: row.phone,
        companyName: getCompanyName(row),
        businessType: row.businessType,
      }))
      .filter((row) => {
        if (!search) return true
        const keyword = search.toLowerCase()
        return [row.email, row.phone, row.companyName].some((value) =>
          String(value || '').toLowerCase().includes(keyword),
        )
      })

    return res.status(200).json({ success: true, users: normalizedRows })
  } catch (error: any) {
    console.error('Error fetching manual booking users:', error?.message || error)
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to fetch users',
    })
  }
}

export const listManualBookingWarehousesController = async (req: any, res: Response) => {
  try {
    const userId = String(req.params.userId || '').trim()
    await assertManualBookingUser(userId)

    const rows = await db
      .select({
        pickupId: pickupAddresses.id,
        isPrimary: pickupAddresses.isPrimary,
        isPickupEnabled: pickupAddresses.isPickupEnabled,
        isRTOSame: pickupAddresses.isRTOSame,
        addressId: addresses.id,
        contactName: addresses.contactName,
        contactPhone: addresses.contactPhone,
        contactEmail: addresses.contactEmail,
        addressLine1: addresses.addressLine1,
        addressLine2: addresses.addressLine2,
        addressNickname: addresses.addressNickname,
        city: addresses.city,
        state: addresses.state,
        country: addresses.country,
        pincode: addresses.pincode,
        gstNumber: addresses.gstNumber,
      })
      .from(pickupAddresses)
      .innerJoin(addresses, eq(addresses.id, pickupAddresses.addressId))
      .where(
        and(
          eq(pickupAddresses.userId, userId),
          eq(addresses.userId, userId),
          eq(pickupAddresses.isPickupEnabled, true),
        ),
      )

    const warehouses = rows.map((row) => ({
      pickupId: row.pickupId,
      isPrimary: row.isPrimary,
      isPickupEnabled: row.isPickupEnabled,
      isRTOSame: row.isRTOSame,
      pickup: {
        id: row.addressId,
        warehouse_name: row.addressNickname || row.contactName || 'Warehouse',
        name: row.contactName,
        phone: row.contactPhone,
        email: row.contactEmail,
        address: row.addressLine1,
        address_2: row.addressLine2,
        city: row.city,
        state: row.state,
        country: row.country || 'India',
        pincode: row.pincode,
        gst_number: row.gstNumber,
      },
    }))

    return res.status(200).json({ success: true, warehouses })
  } catch (error: any) {
    console.error('Error fetching manual booking warehouses:', error?.message || error)
    return res.status(error?.statusCode || 500).json({
      success: false,
      message: error?.message || 'Failed to fetch warehouses',
    })
  }
}

export const createManualB2CDraftController = async (req: any, res: Response) => {
  try {
    const userId = String(req.body?.userId || '').trim()
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User is required.' })
    }

    await assertManualBookingUser(userId)
    const { userId: _ignoredUserId, ...payload } = req.body || {}
    payload.tags = Array.from(
      new Set(
        String(payload.tags || '')
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
          .concat('admin_manual_booking'),
      ),
    ).join(',')
    const result = await createB2CDraftOrderService(payload, userId, false)

    return res.status(201).json({
      success: true,
      message: 'B2C draft order created successfully.',
      data: result,
    })
  } catch (error: any) {
    console.error('Error creating admin manual B2C draft:', error?.message || error)
    return res.status(error?.statusCode || 400).json({
      success: false,
      message: error?.message || 'Failed to create B2C draft order',
    })
  }
}

export const fetchManualBookingCouriersController = async (req: any, res: Response) => {
  try {
    const userId = String(req.body?.userId || '').trim()
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User is required.' })
    }

    await assertManualBookingUser(userId)

    const origin = req.body?.origin ?? req.body?.pickupPincode ?? req.body?.source_pincode
    const destination =
      req.body?.destination ?? req.body?.deliveryPincode ?? req.body?.destination_pincode

    if (!origin || !destination) {
      return res.status(400).json({
        success: false,
        error: 'pickupPincode and deliveryPincode are required',
      })
    }

    const orderAmountResult = extractOrderAmountFromBody(req.body)
    if (orderAmountResult.invalid) {
      return res.status(400).json({ success: false, error: 'order_amount must be valid.' })
    }

    const codBasisResult = extractCodChargeBasisFromBody(req.body, orderAmountResult.value)
    if (codBasisResult.invalid) {
      return res.status(400).json({ success: false, error: 'cod_charge_basis must be valid.' })
    }

    const couriers = await fetchAvailableCouriersWithRates(
      {
        origin: Number(origin),
        destination: Number(destination),
        payment_type: req.body?.payment_type,
        order_amount: orderAmountResult.value,
        cod_charge_basis: codBasisResult.value,
        shipment_type: 'b2c',
        weight: Number(req.body?.weight ?? 0),
        length: Number(req.body?.length ?? 0),
        breadth: Number(req.body?.breadth ?? 0),
        height: Number(req.body?.height ?? 0),
        pickupId: req.body?.pickupId ?? req.body?.pickup_id,
      },
      userId,
    )

    return res.status(200).json({ success: true, data: couriers ?? [] })
  } catch (error: any) {
    console.error('Error fetching admin manual booking couriers:', error?.message || error)
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to fetch available couriers',
    })
  }
}

export const bookManualB2CCourierController = async (req: any, res: Response) => {
  try {
    const orderId = String(req.params.orderId || '').trim()
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'Order ID is required.' })
    }

    const [order] = await db
      .select({ id: b2c_orders.id, userId: b2c_orders.user_id })
      .from(b2c_orders)
      .where(eq(b2c_orders.id, orderId))
      .limit(1)

    if (!order?.userId) {
      return res.status(404).json({ success: false, message: 'Order not found.' })
    }

    await assertManualBookingUser(order.userId)
    const result = await bookB2CCourierForOrderService(orderId, req.body, order.userId)

    return res.status(200).json({
      success: true,
      message: 'Courier booked successfully.',
      data: result,
    })
  } catch (error: any) {
    console.error('Error booking admin manual B2C courier:', error?.message || error)
    return res.status(error?.statusCode || 400).json({
      success: false,
      message: error?.message || 'Failed to book courier',
    })
  }
}

export const regenerateOrderDocumentsControllerAdmin = async (req: any, res: Response) => {
  try {
    const orderId = String(req.params.id || '').trim()
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
    })

    return res.status(200).json({
      success: true,
      message: 'Order documents regenerated successfully',
      data: result,
    })
  } catch (error: any) {
    console.error('Error regenerating order documents:', error?.message || error)
    return res.status(400).json({
      success: false,
      message: error?.message || 'Failed to regenerate order documents',
    })
  }
}

export const updateOrderStatusControllerAdmin = async (req: any, res: Response) => {
  try {
    const orderId = String(req.params.id || '').trim()
    const nextStatus = String(req.body?.status || '').trim()
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : undefined

    if (!orderId) {
      return res.status(400).json({ success: false, message: 'Order ID is required' })
    }

    if (!nextStatus) {
      return res.status(400).json({ success: false, message: 'Status is required' })
    }

    const result = await updateOrderStatusServiceAdmin({
      orderId,
      nextStatus,
      note,
      adminUserId: req.user?.sub,
    })

    return res.status(200).json({
      success: true,
      message: result.updated ? 'Order status updated successfully' : 'Order status already up to date',
      data: result,
    })
  } catch (error: any) {
    console.error('Error updating admin order status:', error?.message || error)
    return res.status(400).json({
      success: false,
      message: error?.message || 'Failed to update order status',
    })
  }
}
