CREATE TABLE IF NOT EXISTS "quick_details" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "token" varchar(80) NOT NULL,
  "store_name" varchar(255) NOT NULL,
  "store_slug" varchar(255) NOT NULL,
  "status" varchar(30) NOT NULL DEFAULT 'generated',
  "charge_amount" numeric(12, 2) NOT NULL DEFAULT 1,
  "wallet_transaction_id" uuid REFERENCES "wallet_transactions"("id"),
  "customer_details" jsonb,
  "b2c_order_id" uuid REFERENCES "b2c_orders"("id"),
  "rejection_reason" varchar(255),
  "submitted_at" timestamp with time zone,
  "approved_at" timestamp with time zone,
  "rejected_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "quick_details_token_unique" ON "quick_details" ("token");
CREATE INDEX IF NOT EXISTS "quick_details_user_status_idx" ON "quick_details" ("user_id", "status");
