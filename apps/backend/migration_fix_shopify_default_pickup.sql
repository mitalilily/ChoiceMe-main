-- Populate the user's primary enabled pickup warehouse on existing unbooked Shopify orders.
-- The fallback is the oldest enabled pickup address when no primary is configured.
WITH defaults AS (
  SELECT DISTINCT ON (orders.id)
    orders.id AS order_id,
    pickup.id AS pickup_id,
    jsonb_build_object(
      'warehouse_name', COALESCE(address.addressNickname, address.contactName, 'Warehouse'),
      'name', COALESCE(address.contactName, address.addressNickname, 'Warehouse'),
      'phone', COALESCE(address.contactPhone, ''),
      'address', concat_ws(', ', address.addressLine1, address.addressLine2),
      'city', address.city,
      'state', address.state,
      'country', COALESCE(address.country, 'India'),
      'pincode', address.pincode,
      'gst_number', COALESCE(address.gstNumber, '')
    ) AS pickup_details
  FROM b2c_orders orders
  INNER JOIN pickup_addresses pickup
    ON pickup."userId" = orders.user_id
   AND pickup."isPickupEnabled" = true
  INNER JOIN addresses address
    ON address.id = pickup."addressId"
   AND address."userId" = orders.user_id
  WHERE orders.integration_type = 'shopify'
    AND (orders.awb_number IS NULL OR trim(orders.awb_number) = '')
  ORDER BY orders.id, pickup."isPrimary" DESC, address."createdAt" ASC
)
UPDATE b2c_orders orders
SET
  pickup_location_id = defaults.pickup_id,
  pickup_details = defaults.pickup_details,
  rto_details = defaults.pickup_details,
  is_rto_different = false,
  updated_at = NOW()
FROM defaults
WHERE orders.id = defaults.order_id;
