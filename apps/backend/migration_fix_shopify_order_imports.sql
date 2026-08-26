-- Shopify total_price already includes customer shipping. Normalize imported rows
-- to ChoiceMee's order_amount + shipping_charges split and keep unbooked rows as drafts.
WITH normalized AS (
  SELECT
    id,
    COALESCE(invoice_amount, order_amount + COALESCE(shipping_charges, 0))::numeric AS total_order_value,
    COALESCE(shipping_charges, 0)::numeric AS customer_shipping,
    order_type,
    awb_number
  FROM b2c_orders
  WHERE integration_type = 'shopify'
)
UPDATE b2c_orders orders
SET
  order_amount = GREATEST(normalized.total_order_value - normalized.customer_shipping, 0),
  prepaid_amount = CASE
    WHEN normalized.order_type = 'prepaid' THEN normalized.total_order_value
    ELSE 0
  END,
  courier_partner = CASE
    WHEN normalized.awb_number IS NULL OR trim(normalized.awb_number) = '' THEN NULL
    ELSE orders.courier_partner
  END,
  order_status = CASE
    WHEN normalized.awb_number IS NULL OR trim(normalized.awb_number) = '' THEN 'pending'
    ELSE orders.order_status
  END,
  updated_at = NOW()
FROM normalized
WHERE orders.id = normalized.id;
