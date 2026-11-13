type WarehouseSnapshot = {
  id?: string | null
  pickup: Record<string, any>
  rto?: Record<string, any> | null
  isRtoDifferent: boolean
}

/** Preserve draft data unless the booking explicitly selects another warehouse. */
export function resolveBookingWarehouseSelection(
  stored: WarehouseSnapshot,
  request: {
    pickup_location_id?: string
    pickup?: Record<string, any>
    rto?: Record<string, any>
    is_rto_different?: string
  },
) {
  const id = String(request.pickup_location_id || stored.id || '').trim() || undefined
  const changed = Boolean(id && id !== stored.id)
  const isRtoDifferent =
    request.is_rto_different === undefined
      ? stored.isRtoDifferent
      : request.is_rto_different === 'yes'
  return {
    id,
    // The shipment service subsequently validates ownership and hydrates this ID
    // from the seller's active warehouse record before contacting the courier.
    pickup: changed ? { ...(request.pickup || {}) } : { ...stored.pickup, ...request.pickup },
    rto: isRtoDifferent ? (request.rto ?? stored.rto ?? null) : null,
    isRtoDifferent,
  }
}
