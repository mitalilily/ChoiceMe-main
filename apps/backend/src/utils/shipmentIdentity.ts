type ShipmentRecord = Record<string, any>

export const normalizeAwb = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toUpperCase()

/** Identity always includes the seller. Blank AWBs never collapse draft orders. */
export function uniqueShipments<T extends ShipmentRecord>(rows: T[], sellerId?: string): T[] {
  const selected = new Map<string, T>()
  rows.forEach((row, index) => {
    const owner = String(
      row.user_id ?? row.userId ?? row.seller_id ?? row.sellerId ?? sellerId ?? '',
    )
    if (sellerId && owner !== sellerId)
      throw new Error('Shipment does not belong to the requested seller')
    const awb = normalizeAwb(row.awb_number ?? row.awbNumber ?? row.awb)
    const key = JSON.stringify([
      owner,
      awb && awb !== '-' && awb !== 'N/A'
        ? `awb:${awb}`
        : `order:${row.type ?? row.orderType ?? ''}:${row.id ?? row.orderId ?? index}`,
    ])
    const existing = selected.get(key)
    const updated =
      new Date(row.updated_at ?? row.updatedAt ?? row.created_at ?? row.createdAt ?? 0).getTime() ||
      0
    const previous = existing
      ? new Date(
          existing.updated_at ??
            existing.updatedAt ??
            existing.created_at ??
            existing.createdAt ??
            0,
        ).getTime() || 0
      : -1
    if (!existing || updated > previous) selected.set(key, row)
  })
  return [...selected.values()]
}
