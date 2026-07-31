import { db } from '../client'
import { tracking_events } from '../schema/trackingEvents'

export async function logTrackingEvent(params: {
  orderId: string
  userId: string
  awbNumber?: string | null
  courier?: string | null
  statusCode?: string | null
  statusText?: string | null
  location?: string | null
  eventTime?: string | Date | null
  raw?: any
}) {
  const { orderId, userId, awbNumber, courier, statusCode, statusText, location, eventTime, raw } =
    params
  const createdAt = parseCourierTrackingDate(eventTime) ?? extractRawEventTime(raw) ?? new Date()

  await db.insert(tracking_events).values({
    order_id: orderId,
    user_id: userId,
    awb_number: awbNumber || null,
    courier: courier || null,
    status_code: statusCode || null,
    status_text: statusText || null,
    location: location || null,
    raw: raw || null,
    created_at: createdAt,
  })
}

const IST_OFFSET_MINUTES = 330

export function parseCourierTrackingDate(value?: string | Date | null): Date | null {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value

  const raw = String(value).trim()
  if (!raw) return null

  const hasExplicitTimezone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(raw)
  if (hasExplicitTimezone) {
    const date = new Date(raw)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const normalized = raw.replace(/\//g, '-').replace('T', ' ')
  const ymd = normalized.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/,
  )
  const dmy = normalized.match(
    /^(\d{1,2})-(\d{1,2})-(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/,
  )

  const parts = ymd
    ? {
        year: Number(ymd[1]),
        month: Number(ymd[2]),
        day: Number(ymd[3]),
        hour: Number(ymd[4] || 0),
        minute: Number(ymd[5] || 0),
        second: Number(ymd[6] || 0),
      }
    : dmy
      ? {
          year: Number(dmy[3]),
          month: Number(dmy[2]),
          day: Number(dmy[1]),
          hour: Number(dmy[4] || 0),
          minute: Number(dmy[5] || 0),
          second: Number(dmy[6] || 0),
        }
      : null

  if (parts) {
    const utcMs =
      Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) -
      IST_OFFSET_MINUTES * 60 * 1000
    const date = new Date(utcMs)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const fallback = new Date(raw)
  return Number.isNaN(fallback.getTime()) ? null : fallback
}

function extractRawEventTime(raw: any): Date | null {
  const candidates = [
    raw?.event_time,
    raw?.eventTime,
    raw?.timestamp,
    raw?.scan_time,
    raw?.scanTime,
    raw?.scan_date_time,
    raw?.scanDateTime,
    raw?.scan_date,
    raw?.scanDate,
    raw?.status_date_time,
    raw?.statusDateTime,
    raw?.StatusDateTime,
    raw?.StatusDate,
    raw?.ScanDateTime,
    raw?.ScanDate,
    raw?.ScanTime,
    raw?.Shipment?.Status?.StatusDateTime,
    raw?.Shipment?.Status?.StatusDate,
    raw?.Shipment?.ScanDetail?.ScanDateTime,
    raw?.Shipment?.ScanDetail?.ScanDate,
    raw?.Shipment?.Scans?.[0]?.ScanDetail?.ScanDateTime,
    raw?.track?.timestamp,
    raw?.track?.updated_at,
    raw?.track?.event_time,
  ]

  for (const candidate of candidates) {
    const date = parseCourierTrackingDate(candidate)
    if (date) return date
  }

  return null
}
