-- Keep COD remittance rows one-per-order/AWB before adding uniqueness guards.
-- Exact duplicate rows can be created by repeated reconciliation jobs; keep the earliest row.
WITH ranked_by_order AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, order_id, order_type
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM cod_remittances
  WHERE order_id IS NOT NULL
),
deleted_order_duplicates AS (
  DELETE FROM cod_remittances cr
  USING ranked_by_order r
  WHERE cr.id = r.id
    AND r.rn > 1
  RETURNING cr.id
),
ranked_by_awb AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, awb_number
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM cod_remittances
  WHERE awb_number IS NOT NULL
    AND trim(awb_number) <> ''
)
DELETE FROM cod_remittances cr
USING ranked_by_awb r
WHERE cr.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS cod_remittances_unique_order
  ON cod_remittances (user_id, order_id, order_type)
  WHERE order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS cod_remittances_unique_awb
  ON cod_remittances (user_id, awb_number)
  WHERE awb_number IS NOT NULL
    AND trim(awb_number) <> '';
