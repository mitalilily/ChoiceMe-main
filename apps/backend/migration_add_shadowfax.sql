-- Additive only: no existing orders, warehouses, wallet balances or database settings change.
BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE TABLE IF NOT EXISTS choicemee_shadowfax_bookings (
  account_key text NOT NULL,
  client_order_id text NOT NULL,
  seller_id uuid NOT NULL,
  direction text NOT NULL CHECK (direction IN ('forward','reverse')),
  payload_hash text NOT NULL,
  state text NOT NULL CHECK (state IN ('pending','confirmed','uncertain')),
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_key, client_order_id)
);
CREATE TABLE IF NOT EXISTS choicemee_shadowfax_callbacks (
  event_key text PRIMARY KEY,
  order_id uuid NOT NULL,
  payload jsonb NOT NULL,
  processed_at timestamptz,
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS choicemee_shadowfax_callbacks_pending_idx
  ON choicemee_shadowfax_callbacks(received_at) WHERE processed_at IS NULL;
-- A disabled catalog entry is not a usable shipping option. No rate cards are invented.
INSERT INTO couriers (id, name, "serviceProvider", "isEnabled", business_type)
VALUES (101, 'Shadowfax', 'shadowfax', false, '["b2c"]'::jsonb)
ON CONFLICT (id, "serviceProvider") DO NOTHING;
COMMIT;
