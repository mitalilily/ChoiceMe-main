-- Remove India's +91 prefix from existing Shopify-synced buyer phone numbers.
UPDATE b2c_orders
SET
  buyer_phone = substring(trim(buyer_phone) from 4),
  updated_at = NOW()
WHERE integration_type = 'shopify'
  AND trim(buyer_phone) LIKE '+91%';
