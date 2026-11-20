import { createHash } from 'crypto'
import type { ShipmentParams } from '../shiprocket.service'
import { ShadowfaxDirection, ShadowfaxError, validateShadowfaxOrder } from './shadowfax.service'

export const shadowfaxOrderId = (sellerId: string, orderNumber: string) =>
  `CM-${createHash('sha256').update(`${sellerId}:${orderNumber}`).digest('hex').slice(0, 48)}`

/** Mirrors the existing booking weight convention: <=50 is kg, >50 is grams. */
export function shadowfaxWeightKg(value: unknown) {
  const weight = Number(value)
  if (!Number.isFinite(weight) || weight <= 0) throw new ShadowfaxError('Positive shipment weight is required.', 400)
  return weight > 50 ? weight / 1000 : weight
}

export function buildShadowfaxPayload(params: ShipmentParams, sellerId: string, direction: ShadowfaxDirection): Record<string, any> {
  const reverse = direction === 'reverse'
  // Reverse workflow supplies pickup=customer, consignee=return warehouse, just as Delhivery does.
  const customer = reverse ? params.pickup : params.consignee
  const returnAddress = reverse ? params.consignee : params.is_rto_different === 'yes' ? params.rto : params.pickup
  if (!customer || !returnAddress) throw new ShadowfaxError('Customer and return addresses are required.', 400)
  const address = (source: any, key: string) => ({
    name: source.name,
    contact: source.phone,
    [key]: [source.address, source.address_2].filter(Boolean).join(', '),
    city: source.city, state: source.state, pincode: Number(source.pincode),
  })
  const weight = shadowfaxWeightKg(params.package_weight ?? params.weight)
  const value = Number(params.order_amount)
  const products = (params.order_items || []).map((item: any, index) => ({
    sku_name: item.name,
    sku_id: item.sku || `ITEM-${index + 1}`,
    price: Number(item.price),
    hsn_code: item.hsn || item.hsnCode || '',
    invoice_no: params.invoice_number || params.order_number,
    seller_details: {
      seller_name: params.company?.name || returnAddress.name,
      seller_address: returnAddress.address,
      seller_state: returnAddress.state,
      gstin_number: params.company?.gst || params.pickup?.gst_number || '',
    },
    additional_details: reverse
      ? { quantity_value: Number(item.qty ?? item.quantity ?? 1) }
      : { quantity: Number(item.qty ?? item.quantity ?? 1) },
    ...(reverse ? {
      return_reason: String(item.return_reason || 'Customer return'),
      // QC must be requested deliberately. Do not inherit Shadowfax's default=true.
      qc_required: item.qc_required === true,
      ...(item.qc_required === true && Array.isArray(item.qc_rules) ? { qc_rules: item.qc_rules } : {}),
    } : {}),
  }))
  const order = {
    client_order_id: shadowfaxOrderId(sellerId, params.order_number),
    ...(params.waybill ? { awb_number: params.waybill } : {}),
    actual_weight: weight,
    volumetric_weight: Number(params.package_length || 0) * Number(params.package_breadth || 0) * Number(params.package_height || 0) / 5000,
    ...(params.ewaybill_number || params.ewbn || params.ewb ? { eway_bill: params.ewaybill_number || params.ewbn || params.ewb } : {}),
    ...(reverse ? { price: value, total_amount: value, pickup_type: 'regular' } : {
      product_value: value,
      total_amount: value,
      payment_mode: params.payment_type,
      cod_amount: params.payment_type === 'cod' ? Number((params as any).collectable_amount ?? value) : 0,
      order_service: 'Regular',
    }),
  }
  const payload = {
    customer_details: address(customer, reverse ? 'address' : 'address_line_1'),
    return_details: { ...address(returnAddress, reverse ? 'address' : 'address_line_1'), return_type: 'seller' },
    order_details: order,
    ...(reverse ? { sku_details: products } : {
      order_type: 'marketplace',
      pickup_details: {
        ...address(params.pickup, 'address_line_1'), pickup_type: 'seller',
        ...(params.pickup_date ? { pickup_date: params.pickup_date } : {}),
      },
      product_details: products,
    }),
  }
  validateShadowfaxOrder(direction, payload)
  return payload
}

const token = (value: unknown) => String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
export function shadowfaxStatus(value: unknown, reverse = false): string | null {
  const status = token(value)
  const map: Record<string, string> = {
    new: 'booked', assigned: 'pickup_initiated', assigned_for_pickup: 'pickup_initiated',
    assigned_for_seller_pickup: 'pickup_initiated', ofp: 'pickup_initiated', out_for_pickup: 'pickup_initiated',
    picked: 'in_transit', received: 'in_transit', received_from_client_warehouse: 'in_transit',
    recd_at_rev_hub: 'in_transit', recd_at_fwd_hub: 'in_transit', recd_at_fwd_dc: 'in_transit',
    recd_at_dc: 'in_transit', bag_in_transit: 'in_transit', bag_received: 'in_transit',
    item_added_to_bag: 'in_transit', bag_received_at_via: 'in_transit', received_at_return_dc: 'in_transit',
    assigned_for_delivery: 'out_for_delivery', assigned_for_customer_delivery: 'out_for_delivery', ofd: 'out_for_delivery', out_for_delivery: 'out_for_delivery',
    delivered: 'delivered', returned_to_client: reverse ? 'delivered' : 'rto_delivered',
    rts_d: reverse ? 'delivered' : 'rto_delivered', rto_d: reverse ? 'delivered' : 'rto_delivered', returned_to_seller: reverse ? 'delivered' : 'rto_delivered',
    rts: 'rto_initiated', rto: 'rto_initiated', return_to_seller_initiated: 'rto_initiated',
    rts_in_process: 'rto_in_transit', in_transit_for_rts: 'rto_in_transit', in_transit_for_rto: 'rto_in_transit',
    cancelled: 'cancelled', cancelled_by_customer: 'cancelled',
    cid: 'ndr', nc: 'ndr', na: 'ndr', not_contactable: 'ndr', not_attempted: 'ndr', on_hold: 'ndr',
    qc_failed: 'ndr', undelivered: 'ndr', rts_nd: 'ndr', rto_nd: 'ndr', lost: 'lost',
    reopen_ndr: 'in_transit', require_delivery_ndr: 'in_transit',
  }
  // Unknown events remain visible in history without fabricating a shipment transition.
  return map[status] || null
}

export function normalizeShadowfaxTracking(raw: any, reverse = false) {
  const data = raw?.data && !Array.isArray(raw.data) ? raw.data : raw
  const details = data?.order_details || data || {}
  const events: any[] = reverse ? data?.pickup_request_state_histories || [] : data?.tracking_details || []
  const status = details.status_id || details.status
  return {
    status: shadowfaxStatus(status, reverse) || undefined,
    edd: details.promised_delivery_date || null,
    courier_name: 'Shadowfax',
    history: events.map((event: any) => ({
      status_code: String(event.status_id || event.status || event.state || ''),
      location: String(event.current_location || event.location || ''),
      event_time: String(event.created || event.created_at || event.timestamp || event.updated_at || event.event_timestamp || ''),
      message: String(event.comment || event.remarks || event.status_display || event.status || event.state || ''),
    })).sort((a, b) => (Date.parse(b.event_time) || 0) - (Date.parse(a.event_time) || 0)),
    raw,
  }
}
