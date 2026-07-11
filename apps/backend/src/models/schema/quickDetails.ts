import { jsonb, numeric, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'
import { b2c_orders } from './b2cOrders'
import { users } from './users'
import { walletTransactions } from './wallet'

export type QuickDetailStatus = 'generated' | 'submitted' | 'approved' | 'rejected'

export interface QuickDetailCustomerDetails {
  fullName: string
  phone: string
  email?: string
  address: string
  landmark?: string
  pincode: string
  city: string
  state: string
  country: string
  paymentMode: 'cod' | 'prepaid'
}

export const quickDetails = pgTable(
  'quick_details',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    token: varchar('token', { length: 80 }).notNull(),
    storeName: varchar('store_name', { length: 255 }).notNull(),
    storeSlug: varchar('store_slug', { length: 255 }).notNull(),
    status: varchar('status', { length: 30 }).$type<QuickDetailStatus>().default('generated').notNull(),
    chargeAmount: numeric('charge_amount', { precision: 12, scale: 2 }).$type<number>().default(1).notNull(),
    walletTransactionId: uuid('wallet_transaction_id').references(() => walletTransactions.id),
    customerDetails: jsonb('customer_details').$type<QuickDetailCustomerDetails | null>(),
    b2cOrderId: uuid('b2c_order_id').references(() => b2c_orders.id),
    rejectionReason: varchar('rejection_reason', { length: 255 }),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    tokenUnique: uniqueIndex('quick_details_token_unique').on(table.token),
  }),
)
