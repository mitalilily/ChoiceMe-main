-- Idempotent invoice generation schema migration.
-- This supplements the initial Drizzle migration for databases that were created
-- before the billing invoice generation tables and preference columns existed.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN
    CREATE TYPE public.invoice_status AS ENUM ('paid', 'pending', 'overdue', 'disputed');
  END IF;
END $$;

ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'paid';
ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'overdue';
ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'disputed';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'billingInvoiceTypeEnum') THEN
    CREATE TYPE public."billingInvoiceTypeEnum" AS ENUM ('weekly', 'monthly_summary', 'manual');
  END IF;
END $$;

ALTER TYPE public."billingInvoiceTypeEnum" ADD VALUE IF NOT EXISTS 'weekly';
ALTER TYPE public."billingInvoiceTypeEnum" ADD VALUE IF NOT EXISTS 'monthly_summary';
ALTER TYPE public."billingInvoiceTypeEnum" ADD VALUE IF NOT EXISTS 'manual';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_payment_method') THEN
    CREATE TYPE public.invoice_payment_method AS ENUM ('upi', 'neft', 'pg', 'wallet');
  END IF;
END $$;

ALTER TYPE public.invoice_payment_method ADD VALUE IF NOT EXISTS 'upi';
ALTER TYPE public.invoice_payment_method ADD VALUE IF NOT EXISTS 'neft';
ALTER TYPE public.invoice_payment_method ADD VALUE IF NOT EXISTS 'pg';
ALTER TYPE public.invoice_payment_method ADD VALUE IF NOT EXISTS 'wallet';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_adjustment_type') THEN
    CREATE TYPE public.invoice_adjustment_type AS ENUM ('credit', 'debit', 'waiver', 'surcharge');
  END IF;
END $$;

ALTER TYPE public.invoice_adjustment_type ADD VALUE IF NOT EXISTS 'credit';
ALTER TYPE public.invoice_adjustment_type ADD VALUE IF NOT EXISTS 'debit';
ALTER TYPE public.invoice_adjustment_type ADD VALUE IF NOT EXISTS 'waiver';
ALTER TYPE public.invoice_adjustment_type ADD VALUE IF NOT EXISTS 'surcharge';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_dispute_status') THEN
    CREATE TYPE public.invoice_dispute_status AS ENUM ('open', 'in_review', 'resolved', 'rejected');
  END IF;
END $$;

ALTER TYPE public.invoice_dispute_status ADD VALUE IF NOT EXISTS 'open';
ALTER TYPE public.invoice_dispute_status ADD VALUE IF NOT EXISTS 'in_review';
ALTER TYPE public.invoice_dispute_status ADD VALUE IF NOT EXISTS 'resolved';
ALTER TYPE public.invoice_dispute_status ADD VALUE IF NOT EXISTS 'rejected';

CREATE TABLE IF NOT EXISTS public."billingInvoices" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  invoice_no varchar(50) NOT NULL,
  seller_id uuid NOT NULL,
  billing_start date NOT NULL,
  billing_end date NOT NULL,
  taxable_value numeric(12, 2) DEFAULT '0',
  cgst numeric(12, 2) DEFAULT '0',
  sgst numeric(12, 2) DEFAULT '0',
  igst numeric(12, 2) DEFAULT '0',
  total_amount numeric(12, 2) DEFAULT '0',
  gst_rate integer DEFAULT 18,
  status public.invoice_status DEFAULT 'pending' NOT NULL,
  type public."billingInvoiceTypeEnum" DEFAULT 'weekly' NOT NULL,
  pdf_url text NOT NULL,
  csv_url text NOT NULL,
  order_numbers jsonb,
  is_disputed boolean DEFAULT false,
  remarks text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "billingInvoices_invoice_no_unique"
  ON public."billingInvoices" (invoice_no);

CREATE TABLE IF NOT EXISTS public.invoice_sequences (
  user_id uuid PRIMARY KEY NOT NULL,
  last_sequence bigint DEFAULT 0 NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  invoice_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  method public.invoice_payment_method NOT NULL,
  amount numeric(12, 2) NOT NULL,
  reference varchar(120),
  notes text,
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoice_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  invoice_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  type public.invoice_adjustment_type NOT NULL,
  amount numeric(12, 2) NOT NULL,
  reason text,
  is_applied boolean DEFAULT false NOT NULL,
  created_by uuid,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoice_cod_offsets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  invoice_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  cod_remittance_id uuid NOT NULL,
  amount numeric(12, 2) NOT NULL,
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoice_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  invoice_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  status public.invoice_dispute_status DEFAULT 'open' NOT NULL,
  subject varchar(140) NOT NULL,
  details text,
  line_item_ref varchar(120),
  resolution_notes text,
  resolved_by uuid,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoice_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  prefix varchar(10) DEFAULT 'INV' NOT NULL,
  suffix varchar(10) DEFAULT '',
  template varchar(20) DEFAULT 'classic' NOT NULL,
  include_logo boolean DEFAULT true NOT NULL,
  include_signature boolean DEFAULT true NOT NULL,
  logo_file varchar(255),
  signature_file varchar(255),
  seller_name varchar(255),
  brand_name varchar(255),
  gst_number varchar(32),
  pan_number varchar(32),
  seller_address text,
  state_code varchar(10),
  support_email varchar(150),
  support_phone varchar(50),
  invoice_notes text,
  terms_and_conditions text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.invoice_preferences ADD COLUMN IF NOT EXISTS seller_name varchar(255);
ALTER TABLE public.invoice_preferences ADD COLUMN IF NOT EXISTS brand_name varchar(255);
ALTER TABLE public.invoice_preferences ADD COLUMN IF NOT EXISTS gst_number varchar(32);
ALTER TABLE public.invoice_preferences ADD COLUMN IF NOT EXISTS pan_number varchar(32);
ALTER TABLE public.invoice_preferences ADD COLUMN IF NOT EXISTS seller_address text;
ALTER TABLE public.invoice_preferences ADD COLUMN IF NOT EXISTS state_code varchar(10);
ALTER TABLE public.invoice_preferences ADD COLUMN IF NOT EXISTS support_email varchar(150);
ALTER TABLE public.invoice_preferences ADD COLUMN IF NOT EXISTS support_phone varchar(50);
ALTER TABLE public.invoice_preferences ADD COLUMN IF NOT EXISTS invoice_notes text;
ALTER TABLE public.invoice_preferences ADD COLUMN IF NOT EXISTS terms_and_conditions text;

DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'billingInvoices_seller_id_users_id_fk') THEN
    ALTER TABLE public."billingInvoices"
      ADD CONSTRAINT "billingInvoices_seller_id_users_id_fk"
      FOREIGN KEY (seller_id) REFERENCES public.users(id) ON DELETE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_sequences_user_id_users_id_fk') THEN
    ALTER TABLE public.invoice_sequences
      ADD CONSTRAINT invoice_sequences_user_id_users_id_fk
      FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_payments_seller_id_users_id_fk') THEN
    ALTER TABLE public.invoice_payments
      ADD CONSTRAINT invoice_payments_seller_id_users_id_fk
      FOREIGN KEY (seller_id) REFERENCES public.users(id) ON DELETE cascade;
  END IF;

  IF to_regclass('public."billingInvoices"') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_payments_invoice_id_billingInvoices_id_fk') THEN
    ALTER TABLE public.invoice_payments
      ADD CONSTRAINT "invoice_payments_invoice_id_billingInvoices_id_fk"
      FOREIGN KEY (invoice_id) REFERENCES public."billingInvoices"(id) ON DELETE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_adjustments_seller_id_users_id_fk') THEN
    ALTER TABLE public.invoice_adjustments
      ADD CONSTRAINT invoice_adjustments_seller_id_users_id_fk
      FOREIGN KEY (seller_id) REFERENCES public.users(id) ON DELETE cascade;
  END IF;

  IF to_regclass('public.users') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_adjustments_created_by_users_id_fk') THEN
    ALTER TABLE public.invoice_adjustments
      ADD CONSTRAINT invoice_adjustments_created_by_users_id_fk
      FOREIGN KEY (created_by) REFERENCES public.users(id);
  END IF;

  IF to_regclass('public."billingInvoices"') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_adjustments_invoice_id_billingInvoices_id_fk') THEN
    ALTER TABLE public.invoice_adjustments
      ADD CONSTRAINT "invoice_adjustments_invoice_id_billingInvoices_id_fk"
      FOREIGN KEY (invoice_id) REFERENCES public."billingInvoices"(id) ON DELETE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_cod_offsets_seller_id_users_id_fk') THEN
    ALTER TABLE public.invoice_cod_offsets
      ADD CONSTRAINT invoice_cod_offsets_seller_id_users_id_fk
      FOREIGN KEY (seller_id) REFERENCES public.users(id) ON DELETE cascade;
  END IF;

  IF to_regclass('public."billingInvoices"') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_cod_offsets_invoice_id_billingInvoices_id_fk') THEN
    ALTER TABLE public.invoice_cod_offsets
      ADD CONSTRAINT "invoice_cod_offsets_invoice_id_billingInvoices_id_fk"
      FOREIGN KEY (invoice_id) REFERENCES public."billingInvoices"(id) ON DELETE cascade;
  END IF;

  IF to_regclass('public.cod_remittances') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_cod_offsets_cod_remittance_id_cod_remittances_id_fk') THEN
    ALTER TABLE public.invoice_cod_offsets
      ADD CONSTRAINT invoice_cod_offsets_cod_remittance_id_cod_remittances_id_fk
      FOREIGN KEY (cod_remittance_id) REFERENCES public.cod_remittances(id) ON DELETE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_disputes_seller_id_users_id_fk') THEN
    ALTER TABLE public.invoice_disputes
      ADD CONSTRAINT invoice_disputes_seller_id_users_id_fk
      FOREIGN KEY (seller_id) REFERENCES public.users(id) ON DELETE cascade;
  END IF;

  IF to_regclass('public.users') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_disputes_resolved_by_users_id_fk') THEN
    ALTER TABLE public.invoice_disputes
      ADD CONSTRAINT invoice_disputes_resolved_by_users_id_fk
      FOREIGN KEY (resolved_by) REFERENCES public.users(id);
  END IF;

  IF to_regclass('public."billingInvoices"') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_disputes_invoice_id_billingInvoices_id_fk') THEN
    ALTER TABLE public.invoice_disputes
      ADD CONSTRAINT "invoice_disputes_invoice_id_billingInvoices_id_fk"
      FOREIGN KEY (invoice_id) REFERENCES public."billingInvoices"(id) ON DELETE cascade;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_preferences_user_id_users_id_fk') THEN
    ALTER TABLE public.invoice_preferences
      ADD CONSTRAINT invoice_preferences_user_id_users_id_fk
      FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE cascade;
  END IF;
END $$;
