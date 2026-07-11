import { randomBytes } from 'crypto'
import { and, count, desc, eq, getTableColumns } from 'drizzle-orm'
import { HttpError } from '../../utils/classes'
import { db } from '../client'
import { b2c_orders } from '../schema/b2cOrders'
import {
  quickDetails,
  type QuickDetailCustomerDetails,
  type QuickDetailStatus,
} from '../schema/quickDetails'
import { stores } from '../schema/stores'
import { users } from '../schema/users'
import { createB2CDraftOrderService, type ShipmentParams } from './shiprocket.service'
import { createWalletTransaction, getOrCreateWalletForUser } from './wallet.service'

const QUICK_DETAIL_LINK_CHARGE = 1

const slugify = (value: string) => {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)

  return slug || 'store'
}

const makeToken = () => randomBytes(24).toString('hex')

const getFrontendBaseUrl = () =>
  (process.env.FRONTEND_URL || process.env.CLIENT_URL || 'https://app.choicemee.in').replace(/\/+$/, '')

const publicPathFor = (storeSlug: string, token: string) => `/quick-details/${storeSlug}/${token}`

const buildPublicUrl = (storeSlug: string, token: string) =>
  `${getFrontendBaseUrl()}${publicPathFor(storeSlug, token)}`

async function getSellerStoreIdentity(userId: string) {
  const [store] = await db
    .select({ name: stores.name, domain: stores.domain })
    .from(stores)
    .where(eq(stores.userId, userId))
    .limit(1)

  if (store) {
    const name = String(store.name || store.domain || 'ChoiceMee Store').trim()
    return { storeName: name, storeSlug: slugify(name) }
  }

  const [user] = await db
    .select({ email: users.email, phone: users.phone })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  const fallbackName = String(user?.email || user?.phone || 'ChoiceMee Store').trim()
  return { storeName: fallbackName, storeSlug: slugify(fallbackName.split('@')[0] || fallbackName) }
}

export async function generateQuickDetailLinkService(userId: string) {
  const { storeName, storeSlug } = await getSellerStoreIdentity(userId)
  const token = makeToken()

  const link = await db.transaction(async (tx) => {
    const wallet = await getOrCreateWalletForUser(userId, tx)
    if (Number(wallet.balance ?? 0) < QUICK_DETAIL_LINK_CHARGE) {
      throw new HttpError(400, 'Insufficient wallet balance to generate a quick details link.')
    }

    const [row] = await tx
      .insert(quickDetails)
      .values({
        userId,
        token,
        storeName,
        storeSlug,
        status: 'generated',
        chargeAmount: QUICK_DETAIL_LINK_CHARGE,
      })
      .returning()

    const [transaction] = await createWalletTransaction({
      walletId: wallet.id,
      amount: QUICK_DETAIL_LINK_CHARGE,
      type: 'debit',
      ref: row.id,
      reason: 'Quick Details Link Generation',
      currency: wallet.currency ?? 'INR',
      meta: {
        source: 'quick_details',
        quick_detail_id: row.id,
        token: row.token,
        store_name: row.storeName,
      },
      tx: tx as any,
    })

    await tx
      .update(quickDetails)
      .set({ walletTransactionId: transaction.id, updatedAt: new Date() })
      .where(eq(quickDetails.id, row.id))

    return { ...row, walletTransactionId: transaction.id }
  })

  return {
    ...link,
    publicPath: publicPathFor(link.storeSlug, link.token),
    publicUrl: buildPublicUrl(link.storeSlug, link.token),
  }
}

export async function getQuickDetailLinkPublicService(token: string, storeSlug: string) {
  const [link] = await db
    .select({
      id: quickDetails.id,
      token: quickDetails.token,
      storeName: quickDetails.storeName,
      storeSlug: quickDetails.storeSlug,
      status: quickDetails.status,
      createdAt: quickDetails.createdAt,
      submittedAt: quickDetails.submittedAt,
    })
    .from(quickDetails)
    .where(and(eq(quickDetails.token, token), eq(quickDetails.storeSlug, storeSlug)))
    .limit(1)

  if (!link) throw new HttpError(404, 'Quick details link not found.')

  return {
    ...link,
    canSubmit: link.status === 'generated',
  }
}

const normalizeCustomerDetails = (payload: any): QuickDetailCustomerDetails => {
  const details: QuickDetailCustomerDetails = {
    fullName: String(payload.fullName || '').trim(),
    phone: String(payload.phone || '').trim(),
    email: String(payload.email || '').trim(),
    address: String(payload.address || '').trim(),
    landmark: String(payload.landmark || '').trim(),
    pincode: String(payload.pincode || '').trim(),
    city: String(payload.city || '').trim(),
    state: String(payload.state || '').trim(),
    country: String(payload.country || 'India').trim() || 'India',
    paymentMode: String(payload.paymentMode || '').toLowerCase() === 'prepaid' ? 'prepaid' : 'cod',
  }

  const missing = [
    ['fullName', details.fullName],
    ['phone', details.phone],
    ['address', details.address],
    ['pincode', details.pincode],
    ['city', details.city],
    ['state', details.state],
    ['country', details.country],
  ].filter(([, value]) => !value)

  if (missing.length > 0) {
    throw new HttpError(400, `Missing required fields: ${missing.map(([key]) => key).join(', ')}.`)
  }

  return details
}

export async function submitQuickDetailPublicService(
  token: string,
  storeSlug: string,
  payload: any,
) {
  const customerDetails = normalizeCustomerDetails(payload)

  return db.transaction(async (tx) => {
    const [link] = await tx
      .select()
      .from(quickDetails)
      .where(and(eq(quickDetails.token, token), eq(quickDetails.storeSlug, storeSlug)))
      .limit(1)

    if (!link) throw new HttpError(404, 'Quick details link not found.')
    if (link.status !== 'generated') {
      throw new HttpError(400, 'This quick details link has already been used.')
    }

    const [updated] = await tx
      .update(quickDetails)
      .set({
        status: 'submitted',
        customerDetails,
        submittedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(quickDetails.id, link.id))
      .returning()

    return updated
  })
}

export async function listQuickDetailsService({
  userId,
  page = 1,
  limit = 20,
  status,
}: {
  userId: string
  page?: number
  limit?: number
  status?: QuickDetailStatus
}) {
  const conditions = [eq(quickDetails.userId, userId)]
  if (status) conditions.push(eq(quickDetails.status, status))
  const where = conditions.length === 1 ? conditions[0] : and(...conditions)
  const offset = (Math.max(1, page) - 1) * limit

  const [totalRow] = await db.select({ value: count().as('value') }).from(quickDetails).where(where)
  const rows = await db
    .select({
      ...getTableColumns(quickDetails),
      b2cOrderNumber: b2c_orders.order_number,
    })
    .from(quickDetails)
    .leftJoin(b2c_orders, eq(quickDetails.b2cOrderId, b2c_orders.id))
    .where(where)
    .orderBy(desc(quickDetails.createdAt))
    .limit(limit)
    .offset(offset)

  return {
    rows: rows.map((row) => ({
      ...row,
      publicPath: publicPathFor(row.storeSlug, row.token),
      publicUrl: buildPublicUrl(row.storeSlug, row.token),
    })),
    totalCount: Number(totalRow?.value ?? 0),
    totalPages: Math.ceil(Number(totalRow?.value ?? 0) / limit),
  }
}

export async function rejectQuickDetailService(userId: string, id: string, reason?: string) {
  const [link] = await db
    .select()
    .from(quickDetails)
    .where(and(eq(quickDetails.id, id), eq(quickDetails.userId, userId)))
    .limit(1)

  if (!link) throw new HttpError(404, 'Quick details request not found.')
  if (link.status !== 'submitted') throw new HttpError(400, 'Only submitted quick details can be rejected.')

  const [updated] = await db
    .update(quickDetails)
    .set({
      status: 'rejected',
      rejectionReason: String(reason || '').trim() || null,
      rejectedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(quickDetails.id, id))
    .returning()

  return updated
}

export async function approveQuickDetailService(userId: string, id: string, payload: ShipmentParams) {
  const [link] = await db
    .select()
    .from(quickDetails)
    .where(and(eq(quickDetails.id, id), eq(quickDetails.userId, userId)))
    .limit(1)

  if (!link) throw new HttpError(404, 'Quick details request not found.')
  if (link.status !== 'submitted') throw new HttpError(400, 'Only submitted quick details can be approved.')
  if (!link.customerDetails) throw new HttpError(400, 'Customer details are missing.')

  const customer = link.customerDetails
  const address = [customer.address, customer.landmark ? `Landmark: ${customer.landmark}` : '']
    .filter(Boolean)
    .join(', ')

  const draftPayload: ShipmentParams = {
    ...payload,
    payment_type: customer.paymentMode,
    consignee: {
      ...(payload.consignee || {}),
      name: customer.fullName,
      phone: customer.phone,
      email: customer.email,
      address,
      city: customer.city,
      state: customer.state,
      country: customer.country,
      pincode: customer.pincode,
    },
  }

  const result = await createB2CDraftOrderService(draftPayload, userId, false)
  const orderId = result.order?.id

  await db
    .update(quickDetails)
    .set({
      status: 'approved',
      b2cOrderId: orderId,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(quickDetails.id, id))

  return {
    quickDetailId: id,
    order: result.order,
  }
}
