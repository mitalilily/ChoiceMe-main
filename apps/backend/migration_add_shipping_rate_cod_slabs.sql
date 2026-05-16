CREATE TABLE IF NOT EXISTS shipping_rate_cod_slabs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipping_rate_id uuid NOT NULL REFERENCES shipping_rates(id) ON DELETE CASCADE,
  amount_from numeric(12,2) NOT NULL,
  amount_to numeric(12,2),
  charge_type varchar(20) NOT NULL,
  charge_value numeric(10,2) NOT NULL,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  CONSTRAINT shipping_rate_cod_slabs_charge_type_check
    CHECK (charge_type IN ('flat', 'percent'))
);

CREATE INDEX IF NOT EXISTS idx_shipping_rate_cod_slabs_rate_id
  ON shipping_rate_cod_slabs (shipping_rate_id);

CREATE INDEX IF NOT EXISTS idx_shipping_rate_cod_slabs_amount_range
  ON shipping_rate_cod_slabs (shipping_rate_id, amount_from, amount_to);

INSERT INTO shipping_rate_cod_slabs (
  shipping_rate_id,
  amount_from,
  amount_to,
  charge_type,
  charge_value,
  updated_at
)
SELECT
  sr.id,
  0,
  2000,
  'flat',
  40,
  now()
FROM shipping_rates sr
WHERE sr.business_type = 'b2c'
  AND NOT EXISTS (
    SELECT 1
    FROM shipping_rate_cod_slabs existing
    WHERE existing.shipping_rate_id = sr.id
  );

INSERT INTO shipping_rate_cod_slabs (
  shipping_rate_id,
  amount_from,
  amount_to,
  charge_type,
  charge_value,
  updated_at
)
SELECT
  sr.id,
  2000,
  NULL,
  'percent',
  2,
  now()
FROM shipping_rates sr
WHERE sr.business_type = 'b2c'
  AND EXISTS (
    SELECT 1
    FROM shipping_rate_cod_slabs lower_slab
    WHERE lower_slab.shipping_rate_id = sr.id
      AND lower_slab.amount_from = 0
      AND lower_slab.amount_to = 2000
      AND lower_slab.charge_type = 'flat'
      AND lower_slab.charge_value = 40
  )
  AND NOT EXISTS (
    SELECT 1
    FROM shipping_rate_cod_slabs upper_slab
    WHERE upper_slab.shipping_rate_id = sr.id
      AND upper_slab.amount_from = 2000
      AND upper_slab.amount_to IS NULL
  );
