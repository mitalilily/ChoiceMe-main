-- Pending COD remittances represent the amount collected from the customer:
-- item COD amount plus customer-facing shipping. Platform freight remains a wallet charge.
UPDATE cod_remittances cr
SET
  shipping_charges = COALESCE(bo.shipping_charges, 0),
  remittable_amount = COALESCE(bo.order_amount, cr.cod_amount) + COALESCE(bo.shipping_charges, 0),
  updated_at = NOW()
FROM b2c_orders bo
WHERE cr.order_type = 'b2c'
  AND cr.order_id = bo.id
  AND cr.status = 'pending';

UPDATE cod_remittances cr
SET
  shipping_charges = COALESCE(bo.shipping_charges, 0),
  remittable_amount = COALESCE(bo.order_amount, cr.cod_amount) + COALESCE(bo.shipping_charges, 0),
  updated_at = NOW()
FROM b2b_orders bo
WHERE cr.order_type = 'b2b'
  AND cr.order_id = bo.id
  AND cr.status = 'pending';
