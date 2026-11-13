import { eq } from 'drizzle-orm'
import { db } from '../client'
import { b2b_orders } from '../schema/b2bOrders'
import { b2c_orders } from '../schema/b2cOrders'
import { userProfiles } from '../schema/userProfile'
import { users } from '../schema/users'
import { uniqueShipments } from '../../utils/shipmentIdentity'

// Export one database snapshot rather than concatenating changing list pages.
export async function getSellerOrderExport(
  userId: string,
  scope: 'all' | 'b2c' | 'b2b',
  filters: Record<string, any>,
) {
  return db.transaction(
    async (tx) => {
      const b2c =
        scope === 'b2b'
          ? []
          : await tx.select().from(b2c_orders).where(eq(b2c_orders.user_id, userId))
      const b2b =
        scope === 'b2c'
          ? []
          : await tx.select().from(b2b_orders).where(eq(b2b_orders.user_id, userId))
      const [profile] = await tx
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.userId, userId))
        .limit(1)
      const [user] = await tx
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
      const company = profile?.companyInfo as Record<string, any> | undefined
      const sellerName =
        company?.businessName ||
        company?.brandName ||
        company?.companyName ||
        company?.displayName ||
        company?.contactPerson ||
        user?.email ||
        userId
      const text = (value: unknown) =>
        String(value ?? '')
          .trim()
          .toLowerCase()
      const statuses = (Array.isArray(filters.status) ? filters.status : [filters.status])
        .flatMap((s) => String(s ?? '').split(','))
        .filter(Boolean)
      let rows = uniqueShipments(
        [
          ...b2c.map((row) => ({ ...row, type: 'b2c' })),
          ...b2b.map((row) => ({ ...row, type: 'b2b' })),
        ],
        userId,
      )
      rows = rows.filter((row) => {
        if (statuses.length && !statuses.includes(String(row.order_status))) return false
        if (
          String(filters.draftOnly) === 'true' &&
          (row.order_status !== 'pending' || String(row.awb_number ?? '').trim())
        )
          return false
        if (filters.type && row.order_type !== filters.type) return false
        if (
          filters.courier &&
          !(
            String(row.courier_id) === String(filters.courier) ||
            text(row.courier_partner).includes(text(filters.courier))
          )
        )
          return false
        const pickup = row.pickup_details as Record<string, any> | null
        if (
          filters.warehouse &&
          ![row.pickup_location_id, pickup?.warehouse_name, pickup?.name].some((value) =>
            text(value).includes(text(filters.warehouse)),
          )
        )
          return false
        const created = new Date(row.created_at ?? 0).getTime()
        if (
          filters.fromDate &&
          created < new Date(`${String(filters.fromDate).slice(0, 10)}T00:00:00+05:30`).getTime()
        )
          return false
        if (
          filters.toDate &&
          created > new Date(`${String(filters.toDate).slice(0, 10)}T23:59:59.999+05:30`).getTime()
        )
          return false
        if (
          filters.search &&
          ![
            row.order_number,
            row.awb_number,
            row.buyer_name,
            row.buyer_phone,
            row.buyer_email,
            row.city,
            row.state,
            row.pincode,
          ].some((value) => text(value).includes(text(filters.search)))
        )
          return false
        return true
      })
      rows.sort((a, b) => {
        const difference =
          new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime() ||
          String(a.id).localeCompare(String(b.id))
        return filters.sortOrder === 'asc' ? difference : -difference
      })
      // Explicit export fields: never return internal provider costs or document credentials.
      const fields = [
        'id',
        'user_id',
        'type',
        'order_number',
        'order_id',
        'buyer_name',
        'buyer_phone',
        'buyer_email',
        'city',
        'state',
        'country',
        'pincode',
        'address',
        'order_amount',
        'order_type',
        'order_status',
        'awb_number',
        'courier_partner',
        'order_date',
        'pickup_date',
        'pickup_details',
        'delivered_at',
        'delivery_date',
        'delivery_message',
        'charged_weight',
        'weight',
        'created_at',
        'updated_at',
      ]
      return rows.map((row) => ({
        ...Object.fromEntries(fields.map((key) => [key, (row as Record<string, any>)[key]])),
        merchantName: sellerName,
      }))
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  )
}
