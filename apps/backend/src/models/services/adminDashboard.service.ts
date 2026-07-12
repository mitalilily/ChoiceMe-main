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
import { userProfiles } from '../schema/userProfile'
import { users } from '../schema/users'
import { weight_discrepancies } from '../schema/weightDiscrepancies'
import {
  DEFAULT_BUSINESS_TIME_ZONE,
  addDaysToBusinessDateKey,
  differenceInBusinessDateKeys,
  formatBusinessDateKey,
  getBusinessDateKey,
  getFirstBusinessDateKey,
} from '../../utils/businessDate'

const MANIFEST_STATUSES = new Set(['pickup_initiated', 'manifest_generated'])
const SHIPPED_STATUSES = new Set(['shipment_created'])
const IN_TRANSIT_STATUSES = new Set(['in_transit', 'out_for_delivery'])
const NDR_STATUS_KEYWORDS = [
  'ndr',
  'undelivered',
  'delivery_attempt_failed',
  'door_closed',
  'address_issue',
]
const NDR_STATUSES = new Set(NDR_STATUS_KEYWORDS)

const numberValue = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const trimText = (value: unknown) => {
  if (typeof value !== 'string') return ''
  return value.trim()
}

const firstPresent = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed) return trimmed
      continue
    }

    if (value !== undefined && value !== null) return value
  }

  return null
}

const getFirstValidDate = (...values: unknown[]) => {
  for (const value of values) {
    if (!value) continue
    const parsed = new Date(value as string | number | Date)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  return new Date(0)
}

const getOrderTimestamp = (order: any) =>
  getFirstValidDate(order.order_date, order.orderDate, order.created_at, order.createdAt, order.updated_at)

const getOrderBusinessDateKey = (order: any) =>
  getFirstBusinessDateKey(order.order_date, order.orderDate, order.created_at, order.createdAt, order.updated_at)

const getOrderActivityBusinessDateKey = (order: any) =>
  getFirstBusinessDateKey(order.updated_at, order.updatedAt, order.created_at, order.createdAt, order.order_date)

const getDeliveredBusinessDateKey = (order: any) =>
  getFirstBusinessDateKey(order.delivered_at, order.deliveredAt, order.updated_at, order.updatedAt)

const getOrderStatus = (order: any) => String(order.order_status || order.orderStatus || '').toLowerCase()

const isNdrStatus = (status: string) =>
  NDR_STATUSES.has(status) || NDR_STATUS_KEYWORDS.some((keyword) => status.includes(keyword))

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

const getPickupDateValue = (order: any) =>
  firstPresent(
    order.pickup_date,
    order.pickupDate,
    order.pickup_details?.pickup_date,
    order.pickup_details?.pickupDate,
    order.pickup_details?.requested_pickup_date,
    order.pickup_details?.requestedPickupDate,
    order.pickup_details?.final_pickup_date,
    order.pickup_details?.finalPickupDate,
    order.pickup_details?.expected_pickup_date,
    order.pickup_details?.expectedPickupDate,
  )

const getPickupDateKey = (order: any) => {
  const pickupDate = getPickupDateValue(order)
  return pickupDate ? getFirstBusinessDateKey(pickupDate) || '' : ''
}

const getPickupTimeValue = (order: any) =>
  firstPresent(
    order.pickup_time,
    order.pickupTime,
    order.pickup_details?.pickup_time,
    order.pickup_details?.pickupTime,
  )

const isManifestedOrder = (order: any) =>
  Boolean(firstPresent(order.manifest, order.awb_number, order.shipment_id))

const isOnboardingComplete = (profile: any) =>
  Boolean(
    profile?.onboardingComplete ||
      profile?.profileComplete ||
      profile?.approved ||
      Number(profile?.onboardingStep ?? 0) < 0,
  )

const getOnboardingStage = (profile: any) => {
  if (!profile) {
    return {
      step: 0,
      label: 'Account created',
      description: 'Profile not started yet',
      progress: 15,
    }
  }

  const step = Number(profile.onboardingStep ?? 0)

  if (isOnboardingComplete(profile)) {
    return {
      step,
      label: 'Completed',
      description: 'Ready for shipping',
      progress: 100,
    }
  }

  if (step <= 0) {
    return {
      step,
      label: 'Basic profile pending',
      description: 'Company details not submitted',
      progress: 20,
    }
  }

  if (step === 1) {
    return {
      step,
      label: 'Business details added',
      description: 'Legal and brand details pending',
      progress: 45,
    }
  }

  if (step === 2) {
    return {
      step,
      label: 'KYC or final review pending',
      description: profile?.approved ? 'Waiting for completion sync' : 'Admin review still pending',
      progress: 75,
    }
  }

  return {
    step,
    label: `Step ${step} in progress`,
    description: 'Onboarding still in progress',
    progress: Math.min(95, 25 + step * 20),
  }
}

const toDashboardOrder = (order: any, seller: any) => ({
  ...order,
  merchantName: order.merchantName || seller.sellerName,
  merchantEmail: order.merchantEmail || seller.sellerEmail,
  merchantPhone: order.merchantPhone || seller.sellerPhone,
  pickupDate: getPickupDateValue(order),
  pickupTime: getPickupTimeValue(order),
  pickupStatus: trimText(order.pickup_status || order.pickupStatus) || 'pending',
})

const buildSellerContext = ({
  userId,
  userMap,
  profileMap,
}: {
  userId: string
  userMap: Map<string, any>
  profileMap: Map<string, any>
}) => {
  const user = userMap.get(userId) || null
  const profile = profileMap.get(userId) || null
  const companyInfo = profile?.companyInfo || {}

  const sellerName =
    firstPresent(
      companyInfo.businessName,
      companyInfo.brandName,
      companyInfo.companyName,
      companyInfo.displayName,
      companyInfo.contactPerson,
      user?.email,
      user?.phone,
      userId,
    ) || 'Unknown seller'

  return {
    userId,
    sellerName: String(sellerName),
    sellerEmail: user?.email || companyInfo.contactEmail || '',
    sellerPhone: user?.phone || companyInfo.contactNumber || '',
    companyName: companyInfo.businessName || companyInfo.brandName || companyInfo.companyName || '',
  }
}

const buildSellerGroups = ({
  orders,
  userMap,
  profileMap,
  groupLimit = 6,
  orderLimit = 16,
}: {
  orders: any[]
  userMap: Map<string, any>
  profileMap: Map<string, any>
  groupLimit?: number
  orderLimit?: number
}) => {
  const groups = new Map<string, any>()

  for (const order of orders) {
    const userId = getOrderUserId(order) || 'unknown'
    if (!groups.has(userId)) {
      groups.set(userId, {
        ...buildSellerContext({ userId, userMap, profileMap }),
        shipmentCount: 0,
        totalOrderAmount: 0,
        totalCodAmount: 0,
        pickupDates: [] as string[],
        pickupTimes: [] as string[],
        orders: [] as any[],
      })
    }

    const group = groups.get(userId)
    const dashboardOrder = toDashboardOrder(
      order,
      buildSellerContext({ userId, userMap, profileMap }),
    )

    group.shipmentCount += 1
    group.totalOrderAmount += numberValue(order.order_amount || order.orderAmount)

    if (String(order.order_type || order.orderType || '').toLowerCase() === 'cod') {
      group.totalCodAmount += numberValue(order.order_amount || order.orderAmount)
    }

    if (dashboardOrder.pickupDate) {
      group.pickupDates.push(String(dashboardOrder.pickupDate))
    }

    if (dashboardOrder.pickupTime) {
      group.pickupTimes.push(String(dashboardOrder.pickupTime))
    }

    group.orders.push(dashboardOrder)
  }

  return [...groups.values()]
    .map((group) => {
      const sortedOrders = [...group.orders].sort(
        (a, b) => getOrderTimestamp(b).getTime() - getOrderTimestamp(a).getTime(),
      )

      const pickupDates = [...new Set(group.pickupDates)].sort()
      const pickupTimes = [...new Set(group.pickupTimes)]

      return {
        ...group,
        pickupDate: pickupDates[0] || '',
        pickupTime: pickupTimes[0] || '',
        pickupStatus:
          sortedOrders.find((item) => trimText(item.pickupStatus))?.pickupStatus || 'pending',
        orders: sortedOrders.slice(0, orderLimit),
      }
    })
    .sort((a, b) => {
      if (b.shipmentCount !== a.shipmentCount) return b.shipmentCount - a.shipmentCount
      return a.sellerName.localeCompare(b.sellerName)
    })
    .slice(0, groupLimit)
}

const buildDashboardCard = ({
  key,
  title,
  description,
  count,
  route,
  orders,
  userMap,
  profileMap,
}: {
  key: string
  title: string
  description: string
  count: number
  route: string
  orders: any[]
  userMap: Map<string, any>
  profileMap: Map<string, any>
}) => ({
  key,
  title,
  description,
  count,
  route,
  sellerGroups: buildSellerGroups({ orders, userMap, profileMap }),
})

export const getAdminDashboardStats = async () => {
  const [
    b2cOrders,
    b2bOrders,
    userRows,
    profileRows,
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
        email: users.email,
        phone: users.phone,
        createdAt: users.createdAt,
      })
      .from(users),
    db.select().from(userProfiles),
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
  const todayKey = formatBusinessDateKey(now) || getBusinessDateKey(now) || ''
  const yesterdayKey = todayKey ? addDaysToBusinessDateKey(todayKey, -1) || '' : ''
  const lastWeekKey = todayKey ? addDaysToBusinessDateKey(todayKey, -7) || '' : ''
  const lastMonthKey = todayKey ? addDaysToBusinessDateKey(todayKey, -30) || '' : ''

  const userMap = new Map(userRows.map((user) => [String(user.id), user]))
  const profileMap = new Map(profileRows.map((profile) => [String(profile.userId), profile]))

  const ordersWithSellerContext = orders.map((order) => {
    const seller = buildSellerContext({
      userId: getOrderUserId(order),
      userMap,
      profileMap,
    })

    return {
      ...order,
      merchantName: seller.sellerName,
      merchantEmail: seller.sellerEmail,
      merchantPhone: seller.sellerPhone,
    }
  })

  const customerUsers = userRows.filter((user) => user.role !== 'admin')
  const kycByUser = new Map(kycRows.map((row) => [String(row.userId), row.status]))
  const pendingKycUsers = customerUsers.filter((user) => {
    const status = kycByUser.get(String(user.id)) || 'pending'
    return ['pending', 'verification_in_progress'].includes(status)
  })

  const ndrOrderIds = new Set(ndrRows.map((event) => String(event.order_id)))
  const rtoOrderIds = new Set(rtoRows.map((event) => String(event.order_id)))
  const todayNdrOrderIds = new Set(
    ndrRows
      .filter((event) => getFirstBusinessDateKey(event.created_at, event.updated_at) === todayKey)
      .map((event) => String(event.order_id)),
  )

  const nonCancelledOrders = ordersWithSellerContext.filter(
    (order) => getOrderStatus(order) !== 'cancelled',
  )
  const operationalBaseCount = nonCancelledOrders.length

  const todayOrders = ordersWithSellerContext.filter(
    (order) => getOrderBusinessDateKey(order) === todayKey,
  )
  const yesterdayOrders = ordersWithSellerContext.filter(
    (order) => getOrderBusinessDateKey(order) === yesterdayKey,
  )
  const todayPendingOrders = todayOrders.filter((order) =>
    ['pending', 'booked', 'pickup_initiated'].includes(getOrderStatus(order)),
  )
  const todayInTransitOrders = todayOrders.filter((order) => {
    const status = getOrderStatus(order)
    return SHIPPED_STATUSES.has(status) || IN_TRANSIT_STATUSES.has(status)
  })
  const deliveredToday = ordersWithSellerContext.filter(
    (order) => getOrderStatus(order) === 'delivered' && getDeliveredBusinessDateKey(order) === todayKey,
  )
  const todayShippedOrders = ordersWithSellerContext.filter(
    (order) =>
      SHIPPED_STATUSES.has(getOrderStatus(order)) &&
      getOrderActivityBusinessDateKey(order) === todayKey,
  )
  const todayManifestOrders = ordersWithSellerContext.filter(
    (order) =>
      MANIFEST_STATUSES.has(getOrderStatus(order)) &&
      isManifestedOrder(order) &&
      getOrderActivityBusinessDateKey(order) === todayKey,
  )
  const activeNdrOrders = ordersWithSellerContext.filter((order) => {
    const status = getOrderStatus(order)
    return ndrOrderIds.has(String(order.id)) || isNdrStatus(status)
  })
  const rtoOrders = ordersWithSellerContext.filter((order) => {
    const status = getOrderStatus(order)
    return rtoOrderIds.has(String(order.id)) || status.includes('rto') || status === 'returned_to_origin'
  })
  const todayNdrOrders = ordersWithSellerContext.filter((order) => {
    const status = getOrderStatus(order)
    return (
      todayNdrOrderIds.has(String(order.id)) ||
      (isNdrStatus(status) && getOrderActivityBusinessDateKey(order) === todayKey)
    )
  })
  const todayStuckOrders = todayOrders.filter((order) => {
    const status = getOrderStatus(order)
    const orderDateKey = getOrderBusinessDateKey(order)
    const daysDiff = orderDateKey ? differenceInBusinessDateKeys(orderDateKey, todayKey) : 0
    return ['in_transit', 'out_for_delivery'].includes(status) && daysDiff > 5
  })

  const scheduledPickupOrders = b2cOrders
    .map((order) => {
      const seller = buildSellerContext({
        userId: getOrderUserId(order),
        userMap,
        profileMap,
      })

      return {
        ...order,
        merchantName: seller.sellerName,
        merchantEmail: seller.sellerEmail,
        merchantPhone: seller.sellerPhone,
      }
    })
    .filter((order) => {
      const pickupStatus = trimText(order.pickup_status).toLowerCase()
      if (pickupStatus !== 'scheduled') return false
      const pickupDateKey = getPickupDateKey(order)
      return !pickupDateKey || pickupDateKey >= todayKey
    })

  const todayShippingCharges = todayOrders.reduce((sum, order) => sum + getShippingCharge(order), 0)
  const todayRevenue = todayOrders.reduce((sum, order) => sum + getPlatformRevenue(order), 0)
  const totalShippingCharges = ordersWithSellerContext.reduce(
    (sum, order) => sum + getShippingCharge(order),
    0,
  )
  const totalFreightCharges = ordersWithSellerContext.reduce(
    (sum, order) => sum + numberValue(order.freight_charges || order.freightCharges),
    0,
  )
  const totalCourierCosts = ordersWithSellerContext.reduce(
    (sum, order) => sum + numberValue(order.courier_cost || order.courierCost),
    0,
  )
  const totalRevenue = ordersWithSellerContext.reduce(
    (sum, order) => sum + getPlatformRevenue(order),
    0,
  )

  const codOrders = ordersWithSellerContext.filter((order) => {
    const orderType = String(order.order_type || order.orderType || '').toLowerCase()
    const paymentMethod = String(order.payment_method || order.paymentMethod || '').toUpperCase()
    return orderType === 'cod' || paymentMethod === 'COD'
  })
  const codAmount = codOrders.reduce(
    (sum, order) =>
      sum + numberValue(order.cod_amount || order.codAmount || order.order_amount || order.orderAmount),
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
        if (row.creditedAt && getBusinessDateKey(row.creditedAt) === todayKey) {
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

  const deliveredOrders = ordersWithSellerContext.filter((order) => getOrderStatus(order) === 'delivered')
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
            const delivered = getFirstValidDate(
              order.delivered_at,
              order.deliveredAt,
              order.updated_at,
              order.updatedAt,
            )
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

  const ordersByCourier = ordersWithSellerContext.reduce<Record<string, any>>((acc, order) => {
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

  const topOriginCities = ordersWithSellerContext.reduce<Record<string, number>>((acc, order) => {
    const city = order.pickup_city || order.pickupCity || order.pickup_details?.city || order.city || 'Unknown'
    acc[city] = (acc[city] || 0) + 1
    return acc
  }, {})
  const topDestinationCities = ordersWithSellerContext.reduce<Record<string, number>>((acc, order) => {
    const city = order.city || order.destination_city || order.destinationCity || 'Unknown'
    acc[city] = (acc[city] || 0) + 1
    return acc
  }, {})
  const orderStatusCounts = ordersWithSellerContext.reduce<Record<string, number>>((acc, order) => {
    const status = order.order_status || order.orderStatus || 'unknown'
    acc[status] = (acc[status] || 0) + 1
    return acc
  }, {})

  const ordersByDate: Record<string, number> = {}
  const ordersByDateByIntegration: Record<string, Record<string, number>> = {}
  const shippingChargesByDate: Record<string, number> = {}
  const revenueByDate: Record<string, number> = {}

  for (let i = 6; i >= 0; i--) {
    const dateStr = todayKey ? addDaysToBusinessDateKey(todayKey, -i) || todayKey : ''
    const dayOrders = ordersWithSellerContext.filter((order) => getOrderBusinessDateKey(order) === dateStr)
    ordersByDate[dateStr] = dayOrders.length
    ordersByDateByIntegration[dateStr] = dayOrders.reduce<Record<string, number>>((acc, order) => {
      const courierName = getCourierName(order)
      acc[courierName] = (acc[courierName] || 0) + 1
      return acc
    }, {})
    shippingChargesByDate[dateStr] = dayOrders.reduce((sum, order) => sum + getShippingCharge(order), 0)
    revenueByDate[dateStr] = dayOrders.reduce((sum, order) => sum + getPlatformRevenue(order), 0)
  }

  const todayUsers = customerUsers.filter((user) => getBusinessDateKey(user.createdAt) === todayKey)
  const lastWeekUsers = customerUsers.filter((user) => {
    const userDateKey = getBusinessDateKey(user.createdAt)
    return Boolean(userDateKey && lastWeekKey && userDateKey >= lastWeekKey)
  })
  const activeUsers = customerUsers.filter((user) =>
    ordersWithSellerContext.some((order) => {
      if (getOrderUserId(order) !== String(user.id)) return false
      if (getOrderStatus(order) === 'cancelled') return false
      const orderDateKey = getOrderBusinessDateKey(order)
      return Boolean(orderDateKey && lastMonthKey && orderDateKey >= lastMonthKey)
    }),
  )
  const veryActiveUsers = customerUsers.filter((user) =>
    ordersWithSellerContext.some((order) => {
      if (getOrderUserId(order) !== String(user.id)) return false
      const orderDateKey = getOrderBusinessDateKey(order)
      return Boolean(orderDateKey && lastWeekKey && orderDateKey >= lastWeekKey)
    }),
  )

  const couriersByServiceProvider = courierRows.reduce<Record<string, number>>((acc, courier) => {
    const provider = courier.serviceProvider || 'unknown'
    const providerName = provider === 'delhivery' ? 'Delhivery' : provider
    acc[providerName] = (acc[providerName] || 0) + 1
    return acc
  }, {})

  const recentOrders = [...ordersWithSellerContext]
    .sort((a, b) => getOrderTimestamp(b).getTime() - getOrderTimestamp(a).getTime())
    .slice(0, 10)
  const recentTickets = [...ticketRows]
    .sort((a, b) => getFirstValidDate(b.createdAt).getTime() - getFirstValidDate(a.createdAt).getTime())
    .slice(0, 10)

  const onboardingQueue = customerUsers
    .map((user) => {
      const profile = profileMap.get(String(user.id)) || null
      if (isOnboardingComplete(profile)) return null

      const stage = getOnboardingStage(profile)
      const companyInfo: any = profile?.companyInfo || {}
      const seller = buildSellerContext({
        userId: String(user.id),
        userMap,
        profileMap,
      })

      return {
        userId: String(user.id),
        sellerName: seller.sellerName,
        sellerEmail: seller.sellerEmail,
        sellerPhone: seller.sellerPhone,
        onboardingStep: stage.step,
        onboardingLabel: stage.label,
        onboardingDescription: stage.description,
        progress: stage.progress,
        businessType: Array.isArray(profile?.businessType) ? profile.businessType.join(', ') : '',
        city: companyInfo.city || '',
        state: companyInfo.state || '',
        createdAt: user.createdAt,
        submittedAt: profile?.submittedAt || null,
        updatedAt: profile?.updatedAt || null,
        approved: Boolean(profile?.approved),
      }
    })
    .filter(Boolean)
    .sort((a: any, b: any) => {
      const aDate = getFirstValidDate(a?.updatedAt, a?.submittedAt, a?.createdAt).getTime()
      const bDate = getFirstValidDate(b?.updatedAt, b?.submittedAt, b?.createdAt).getTime()
      return bDate - aDate
    })
    .slice(0, 8)

  const topCards = [
    buildDashboardCard({
      key: 'ndr',
      title: 'NDR Today',
      description: 'Shipments needing delivery attention',
      count: todayNdrOrders.length,
      route: `/admin/ops/ndr?fromDate=${todayKey}&toDate=${todayKey}`,
      orders: todayNdrOrders,
      userMap,
      profileMap,
    }),
    buildDashboardCard({
      key: 'delivered',
      title: 'Delivered Today',
      description: 'Shipments marked delivered on the business date',
      count: deliveredToday.length,
      route: `/admin/orders?dashboardView=todayDelivery&businessDate=${todayKey}`,
      orders: deliveredToday,
      userMap,
      profileMap,
    }),
    buildDashboardCard({
      key: 'shipped',
      title: 'Shipped Today',
      description: 'Shipments that moved into the shipping pipeline today',
      count: todayShippedOrders.length,
      route: `/admin/orders?dashboardView=todayShipped&businessDate=${todayKey}`,
      orders: todayShippedOrders,
      userMap,
      profileMap,
    }),
  ]

  const todayActionCards = [
    buildDashboardCard({
      key: 'todayOrders',
      title: 'Today Orders',
      description: 'New shipments created today',
      count: todayOrders.length,
      route: `/admin/orders?dashboardView=todayOrders&businessDate=${todayKey}`,
      orders: todayOrders,
      userMap,
      profileMap,
    }),
    buildDashboardCard({
      key: 'todayManifest',
      title: 'Today Manifest',
      description: 'Orders manifested or AWB tagged today',
      count: todayManifestOrders.length,
      route: `/admin/orders?dashboardView=todayManifest&businessDate=${todayKey}`,
      orders: todayManifestOrders,
      userMap,
      profileMap,
    }),
    buildDashboardCard({
      key: 'todayDelivery',
      title: 'Today Delivery',
      description: 'Delivered shipments for the business date',
      count: deliveredToday.length,
      route: `/admin/orders?dashboardView=todayDelivery&businessDate=${todayKey}`,
      orders: deliveredToday,
      userMap,
      profileMap,
    }),
    buildDashboardCard({
      key: 'todayNdr',
      title: 'Today NDR',
      description: 'NDR events created today',
      count: todayNdrOrders.length,
      route: `/admin/ops/ndr?fromDate=${todayKey}&toDate=${todayKey}`,
      orders: todayNdrOrders,
      userMap,
      profileMap,
    }),
  ]

  const upcomingPickups = {
    count: scheduledPickupOrders.length,
    route: `/admin/orders?dashboardView=upcomingPickup&pickupStatus=scheduled&businessDate=${todayKey}`,
    sellerGroups: buildSellerGroups({
      orders: scheduledPickupOrders,
      userMap,
      profileMap,
      groupLimit: 8,
      orderLimit: 20,
    }),
  }

  return {
    success: true,
    data: {
      todayOperations: {
        orders: todayOrders.length,
        pending: todayPendingOrders.length,
        inTransit: todayInTransitOrders.length,
        delivered: deliveredToday.length,
        ndr: todayNdrOrders.length,
        shipped: todayShippedOrders.length,
        manifest: todayManifestOrders.length,
        stuck: todayStuckOrders.length,
      },
      yesterdayOperations: {
        orders: yesterdayOrders.length,
      },
      businessDate: {
        today: todayKey,
        yesterday: yesterdayKey,
        timeZone: DEFAULT_BUSINESS_TIME_ZONE,
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
        totalOrders: ordersWithSellerContext.length,
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
      dashboardHome: {
        topCards,
        onboardingQueue,
        upcomingPickups,
        todayActionCards,
      },
    },
  }
}
