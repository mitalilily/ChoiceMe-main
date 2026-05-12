import { eq } from 'drizzle-orm'
import { db } from '../client'
import { b2b_orders } from '../schema/b2bOrders'
import { b2c_orders } from '../schema/b2cOrders'
import { codRemittances } from '../schema/codRemittance'
import { couriers } from '../schema/couriers'
import { kyc } from '../schema/kyc'
import { ndr_events } from '../schema/ndr'
import { rto_events } from '../schema/rto'
import { supportTickets } from '../schema/supportTickets'
import { users } from '../schema/users'
import { weight_discrepancies } from '../schema/weightDiscrepancies'

const numberValue = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const getFirstValidDate = (...values: unknown[]) => {
  for (const value of values) {
    if (!value) continue
    const parsed = new Date(value as string | number | Date)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  return new Date(0)
}

const isSameLocalDay = (date: Date, target: Date) =>
  date.getFullYear() === target.getFullYear() &&
  date.getMonth() === target.getMonth() &&
  date.getDate() === target.getDate()

const formatLocalDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`

const getOrderTimestamp = (order: any) =>
  getFirstValidDate(order.order_date, order.orderDate, order.created_at, order.createdAt, order.updated_at)

const getOrderStatus = (order: any) => String(order.order_status || order.orderStatus || '').toLowerCase()

const getCourierName = (order: any) =>
  order.courier_partner || order.courierPartner || order.integration_type || order.integrationType || 'Unknown'

const getOrderUserId = (order: any) => String(order.user_id || order.userId || '')

const getPlatformRevenue = (order: any) => {
  const freightCharge = numberValue(order.freight_charges || order.freightCharges)
  const courierCost = numberValue(order.courier_cost || order.courierCost)
  return freightCharge > 0 && courierCost > 0 ? freightCharge - courierCost : 0
}

const getShippingCharge = (order: any) =>
  numberValue(order.shipping_charges || order.shippingCharge || order.shipping_charge)

export const getAdminDashboardStats = async () => {
  const [
    b2cOrders,
    b2bOrders,
    userRows,
    kycRows,
    ticketRows,
    courierRows,
    codRows,
    ndrRows,
    rtoRows,
    weightRows,
  ] = await Promise.all([
    db.select().from(b2c_orders),
    db.select().from(b2b_orders),
    db
      .select({
        id: users.id,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users),
    db
      .select({
        userId: kyc.userId,
        status: kyc.status,
      })
      .from(kyc),
    db.select().from(supportTickets),
    db.select().from(couriers).where(eq(couriers.isEnabled, true)),
    db.select().from(codRemittances),
    db.select().from(ndr_events),
    db.select().from(rto_events),
    db.select().from(weight_discrepancies),
  ])

  const orders: any[] = [...b2cOrders, ...b2bOrders]
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const lastWeek = new Date(today)
  lastWeek.setDate(lastWeek.getDate() - 7)
  const lastMonth = new Date(today)
  lastMonth.setMonth(lastMonth.getMonth() - 1)

  const customerUsers = userRows.filter((user) => user.role !== 'admin')
  const kycByUser = new Map(kycRows.map((row) => [String(row.userId), row.status]))
  const pendingKycUsers = customerUsers.filter((user) => {
    const status = kycByUser.get(String(user.id)) || 'pending'
    return ['pending', 'verification_in_progress'].includes(status)
  })

  const ndrOrderIds = new Set(ndrRows.map((event) => String(event.order_id)))
  const rtoOrderIds = new Set(rtoRows.map((event) => String(event.order_id)))

  const nonCancelledOrders = orders.filter((order) => getOrderStatus(order) !== 'cancelled')
  const operationalBaseCount = nonCancelledOrders.length

  const todayOrders = orders.filter((order) => {
    const orderDate = getOrderTimestamp(order)
    return !Number.isNaN(orderDate.getTime()) && isSameLocalDay(orderDate, today)
  })

  const todayPendingOrders = todayOrders.filter((order) =>
    ['pending', 'booked', 'pickup_initiated'].includes(getOrderStatus(order)),
  )
  const todayInTransitOrders = todayOrders.filter((order) =>
    ['shipment_created', 'in_transit', 'out_for_delivery'].includes(getOrderStatus(order)),
  )
  const deliveredToday = orders.filter((order) => {
    const deliveredDate = getFirstValidDate(order.delivered_at, order.deliveredAt, order.updated_at, order.updatedAt)
    return getOrderStatus(order) === 'delivered' &&
      !Number.isNaN(deliveredDate.getTime()) &&
      isSameLocalDay(deliveredDate, today)
  })
  const activeNdrOrders = orders.filter((order) => {
    const status = getOrderStatus(order)
    return ndrOrderIds.has(String(order.id)) ||
      ['ndr', 'undelivered', 'delivery_attempt_failed', 'door_closed', 'address_issue'].some((keyword) =>
        status.includes(keyword),
      )
  })
  const rtoOrders = orders.filter((order) => {
    const status = getOrderStatus(order)
    return rtoOrderIds.has(String(order.id)) || status.includes('rto') || status === 'returned_to_origin'
  })
  const todayNdrOrders = todayOrders.filter((order) => activeNdrOrders.some((ndr) => String(ndr.id) === String(order.id)))
  const todayStuckOrders = todayOrders.filter((order) => {
    const status = getOrderStatus(order)
    const orderDate = getOrderTimestamp(order)
    const daysDiff = Math.floor((now.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24))
    return ['in_transit', 'out_for_delivery'].includes(status) && daysDiff > 5
  })

  const todayShippingCharges = todayOrders.reduce((sum, order) => sum + getShippingCharge(order), 0)
  const todayRevenue = todayOrders.reduce((sum, order) => sum + getPlatformRevenue(order), 0)
  const totalShippingCharges = orders.reduce((sum, order) => sum + getShippingCharge(order), 0)
  const totalFreightCharges = orders.reduce(
    (sum, order) => sum + numberValue(order.freight_charges || order.freightCharges),
    0,
  )
  const totalCourierCosts = orders.reduce(
    (sum, order) => sum + numberValue(order.courier_cost || order.courierCost),
    0,
  )
  const totalRevenue = orders.reduce((sum, order) => sum + getPlatformRevenue(order), 0)

  const codOrders = orders.filter((order) => {
    const orderType = String(order.order_type || order.orderType || '').toLowerCase()
    const paymentMethod = String(order.payment_method || order.paymentMethod || '').toUpperCase()
    return orderType === 'cod' || paymentMethod === 'COD'
  })
  const codAmount = codOrders.reduce(
    (sum, order) => sum + numberValue(order.cod_amount || order.codAmount || order.order_amount || order.orderAmount),
    0,
  )
  const codStats = codRows.reduce(
    (acc, row) => {
      const amount = numberValue(row.remittableAmount)
      if (row.status === 'pending') {
        acc.totalPending.amount += amount
        acc.totalPending.count += 1
      }
      if (row.status === 'credited') {
        acc.totalCredited.amount += amount
        acc.totalCredited.count += 1
        if (row.creditedAt && isSameLocalDay(new Date(row.creditedAt), today)) {
          acc.todayCredited.amount += amount
          acc.todayCredited.count += 1
        }
      }
      return acc
    },
    {
      totalPending: { amount: 0, count: 0 },
      totalCredited: { amount: 0, count: 0 },
      todayCredited: { amount: 0, count: 0 },
    },
  )

  const deliveredOrders = orders.filter((order) => getOrderStatus(order) === 'delivered')
  const deliverySuccessRate =
    operationalBaseCount > 0 ? Math.round((deliveredOrders.length / operationalBaseCount) * 100) : 0
  const ndrRate =
    operationalBaseCount > 0 ? Math.round((activeNdrOrders.length / operationalBaseCount) * 100) : 0
  const rtoRate =
    operationalBaseCount > 0 ? Math.round((rtoOrders.length / operationalBaseCount) * 100) : 0

  const deliveredOrdersWithDates = deliveredOrders.filter((order) => {
    const created = getOrderTimestamp(order)
    const delivered = getFirstValidDate(order.delivered_at, order.deliveredAt, order.updated_at, order.updatedAt)
    return !Number.isNaN(created.getTime()) && !Number.isNaN(delivered.getTime())
  })
  const avgDeliveryTime =
    deliveredOrdersWithDates.length > 0
      ? Math.round(
          deliveredOrdersWithDates.reduce((sum, order) => {
            const created = getOrderTimestamp(order)
            const delivered = getFirstValidDate(order.delivered_at, order.deliveredAt, order.updated_at, order.updatedAt)
            return sum + Math.floor((delivered.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
          }, 0) / deliveredOrdersWithDates.length,
        )
      : 0

  const openTickets = ticketRows.filter((ticket) => ticket.status === 'open')
  const inProgressTickets = ticketRows.filter((ticket) => ticket.status === 'in_progress')
  const overdueTickets = ticketRows.filter((ticket) => {
    if (!ticket.dueDate) return false
    return new Date(ticket.dueDate) < now && ['open', 'in_progress'].includes(ticket.status || '')
  })
  const actionableWeightRows = weightRows.filter((row) =>
    ['pending', 'disputed', 'open', 'under_review'].includes(String(row.status || '').toLowerCase()),
  )

  const ordersByCourier = orders.reduce<Record<string, any>>((acc, order) => {
    const courierName = getCourierName(order)
    if (!acc[courierName]) {
      acc[courierName] = {
        count: 0,
        delivered: 0,
        ndr: 0,
        rto: 0,
        revenue: 0,
        shippingCharges: 0,
        freightCharges: 0,
        courierCosts: 0,
        avgDeliveryTime: 0,
        deliveryTimes: [],
      }
    }

    const status = getOrderStatus(order)
    if (status !== 'cancelled') acc[courierName].count += 1
    acc[courierName].shippingCharges += getShippingCharge(order)
    acc[courierName].freightCharges += numberValue(order.freight_charges || order.freightCharges)
    acc[courierName].courierCosts += numberValue(order.courier_cost || order.courierCost)
    acc[courierName].revenue += getPlatformRevenue(order)

    if (status === 'delivered') {
      acc[courierName].delivered += 1
      const created = getOrderTimestamp(order)
      const delivered = getFirstValidDate(order.delivered_at, order.deliveredAt, order.updated_at, order.updatedAt)
      if (!Number.isNaN(created.getTime()) && !Number.isNaN(delivered.getTime())) {
        acc[courierName].deliveryTimes.push(
          Math.floor((delivered.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)),
        )
      }
    }
    if (activeNdrOrders.some((ndr) => String(ndr.id) === String(order.id))) acc[courierName].ndr += 1
    if (rtoOrders.some((rto) => String(rto.id) === String(order.id))) acc[courierName].rto += 1

    return acc
  }, {})

  Object.keys(ordersByCourier).forEach((key) => {
    const courier = ordersByCourier[key]
    courier.deliveryRate = courier.count > 0 ? Math.round((courier.delivered / courier.count) * 100) : 0
    courier.ndrRate = courier.count > 0 ? Math.round((courier.ndr / courier.count) * 100) : 0
    courier.rtoRate = courier.count > 0 ? Math.round((courier.rto / courier.count) * 100) : 0
    courier.avgDeliveryTime =
      courier.deliveryTimes.length > 0
        ? Math.round(courier.deliveryTimes.reduce((a: number, b: number) => a + b, 0) / courier.deliveryTimes.length)
        : 0
    delete courier.deliveryTimes
  })

  const topOriginCities = orders.reduce<Record<string, number>>((acc, order) => {
    const city = order.pickup_city || order.pickupCity || order.pickup_details?.city || order.city || 'Unknown'
    acc[city] = (acc[city] || 0) + 1
    return acc
  }, {})
  const topDestinationCities = orders.reduce<Record<string, number>>((acc, order) => {
    const city = order.city || order.destination_city || order.destinationCity || 'Unknown'
    acc[city] = (acc[city] || 0) + 1
    return acc
  }, {})
  const orderStatusCounts = orders.reduce<Record<string, number>>((acc, order) => {
    const status = order.order_status || order.orderStatus || 'unknown'
    acc[status] = (acc[status] || 0) + 1
    return acc
  }, {})

  const ordersByDate: Record<string, number> = {}
  const ordersByDateByIntegration: Record<string, Record<string, number>> = {}
  const shippingChargesByDate: Record<string, number> = {}
  const revenueByDate: Record<string, number> = {}

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateStr = formatLocalDateKey(date)
    const dayOrders = orders.filter((order) => {
      const orderDate = getOrderTimestamp(order)
      return !Number.isNaN(orderDate.getTime()) && isSameLocalDay(orderDate, date)
    })
    ordersByDate[dateStr] = dayOrders.length
    ordersByDateByIntegration[dateStr] = dayOrders.reduce<Record<string, number>>((acc, order) => {
      const courierName = getCourierName(order)
      acc[courierName] = (acc[courierName] || 0) + 1
      return acc
    }, {})
    shippingChargesByDate[dateStr] = dayOrders.reduce((sum, order) => sum + getShippingCharge(order), 0)
    revenueByDate[dateStr] = dayOrders.reduce((sum, order) => sum + getPlatformRevenue(order), 0)
  }

  const todayUsers = customerUsers.filter((user) => {
    const userDate = getFirstValidDate(user.createdAt)
    return !Number.isNaN(userDate.getTime()) && isSameLocalDay(userDate, today)
  })
  const lastWeekUsers = customerUsers.filter((user) => {
    const userDate = getFirstValidDate(user.createdAt)
    return !Number.isNaN(userDate.getTime()) && userDate >= lastWeek
  })
  const activeUsers = customerUsers.filter((user) =>
    orders.some((order) => {
      if (getOrderUserId(order) !== String(user.id)) return false
      if (getOrderStatus(order) === 'cancelled') return false
      const orderDate = getOrderTimestamp(order)
      return !Number.isNaN(orderDate.getTime()) && orderDate >= lastMonth
    }),
  )
  const veryActiveUsers = customerUsers.filter((user) =>
    orders.some((order) => {
      if (getOrderUserId(order) !== String(user.id)) return false
      const orderDate = getOrderTimestamp(order)
      return !Number.isNaN(orderDate.getTime()) && orderDate >= lastWeek
    }),
  )

  const couriersByServiceProvider = courierRows.reduce<Record<string, number>>((acc, courier) => {
    const provider = courier.serviceProvider || 'unknown'
    const providerName = provider === 'delhivery' ? 'Delhivery' : provider
    acc[providerName] = (acc[providerName] || 0) + 1
    return acc
  }, {})

  const recentOrders = [...orders]
    .sort((a, b) => getOrderTimestamp(b).getTime() - getOrderTimestamp(a).getTime())
    .slice(0, 10)
  const recentTickets = [...ticketRows]
    .sort((a, b) => getFirstValidDate(b.createdAt).getTime() - getFirstValidDate(a.createdAt).getTime())
    .slice(0, 10)

  return {
    success: true,
    data: {
      todayOperations: {
        orders: todayOrders.length,
        pending: todayPendingOrders.length,
        inTransit: todayInTransitOrders.length,
        delivered: deliveredToday.length,
        ndr: todayNdrOrders.length,
        stuck: todayStuckOrders.length,
      },
      financial: {
        todayShippingCharges,
        todayRevenue,
        totalShippingCharges,
        totalFreightCharges,
        totalCourierCosts,
        totalRevenue,
        codAmount,
        codRemittanceDue: codStats.totalPending.amount,
        codStats: {
          totalCollected: codStats.totalCredited.amount,
          remitted: codStats.todayCredited.amount,
          pendingRemittance: codStats.totalPending.amount,
        },
      },
      operational: {
        deliverySuccessRate,
        ndrRate,
        rtoRate,
        avgDeliveryTime,
        totalOrders: orders.length,
        deliveredOrders: deliveredOrders.length,
        ndrOrders: activeNdrOrders.length,
        rtoOrders: rtoOrders.length,
      },
      alerts: {
        openTickets: openTickets.length,
        inProgressTickets: inProgressTickets.length,
        overdueTickets: overdueTickets.length,
        pendingKyc: pendingKycUsers.length,
        weightDiscrepancies: actionableWeightRows.length,
        ndrKpis: {
          total: ndrRows.length,
          affectedOrders: ndrOrderIds.size,
        },
        rtoKpis: {
          total: rtoRows.length,
          affectedOrders: rtoOrderIds.size,
        },
      },
      couriers: {
        performance: ordersByCourier,
        total: courierRows.length,
        byServiceProvider: couriersByServiceProvider,
      },
      geographic: {
        topOriginCities: Object.entries(topOriginCities)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([city, count]) => ({ city, count })),
        topDestinationCities: Object.entries(topDestinationCities)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([city, count]) => ({ city, count })),
      },
      users: {
        total: customerUsers.length,
        today: todayUsers.length,
        lastWeek: lastWeekUsers.length,
        active: activeUsers.length,
        veryActive: veryActiveUsers.length,
        pendingKyc: pendingKycUsers.length,
      },
      charts: {
        ordersByDate: Object.entries(ordersByDate).map(([date, count]) => ({ date, orders: count })),
        ordersByIntegration: Object.entries(ordersByDateByIntegration).map(([date, types]) => ({
          date,
          ...types,
        })),
        shippingChargesByDate: Object.entries(shippingChargesByDate).map(([date, amount]) => ({
          date,
          shippingCharges: amount,
        })),
        revenueByDate: Object.entries(revenueByDate).map(([date, amount]) => ({ date, revenue: amount })),
      },
      orderStatusCounts,
      recentOrders,
      recentTickets,
    },
  }
}
