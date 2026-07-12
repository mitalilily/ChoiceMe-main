import { pool } from '../client'

const quickDetailsTablePatch = `
  create table if not exists quick_details (
    id uuid primary key default gen_random_uuid() not null,
    user_id uuid not null references users(id) on delete cascade,
    token varchar(80) not null,
    store_name varchar(255) not null,
    store_slug varchar(255) not null,
    status varchar(30) not null default 'generated',
    charge_amount numeric(12, 2) not null default 1,
    wallet_transaction_id uuid references wallet_transactions(id),
    customer_details jsonb,
    b2c_order_id uuid references b2c_orders(id),
    rejection_reason varchar(255),
    submitted_at timestamp with time zone,
    approved_at timestamp with time zone,
    rejected_at timestamp with time zone,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
  );

  create unique index if not exists quick_details_token_unique
    on quick_details (token);

  create index if not exists quick_details_user_status_idx
    on quick_details (user_id, status);
`

export const ensureQuickDetailsTable = async () => {
  await pool.query(quickDetailsTablePatch)
  console.log('Quick details schema is ready')
}
