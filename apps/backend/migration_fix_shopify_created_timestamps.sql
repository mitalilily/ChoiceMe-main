-- Keep Shopify orders sorted by the timestamp when Shopify created them,
-- rather than by the time ChoiceMee last synchronized them.
UPDATE b2c_orders
SET
  created_at = order_date::timestamptz,
  updated_at = NOW()
WHERE integration_type = 'shopify'
  AND order_date IS NOT NULL
  AND trim(order_date) <> '';
