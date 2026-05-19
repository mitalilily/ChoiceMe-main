// hooks/useTracking.ts
import { useQuery } from '@tanstack/react-query'
import { fetchTracking } from '../../api/tracking.service'

const TRACKING_TERMINAL_STATUSES = new Set([
  'delivered',
  'cancelled',
  'canceled',
  'rto_delivered',
  'lost',
  'closed',
  'dto',
])

const normalizeTrackingStatus = (value?: string | null) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')

const shouldPollTracking = (data: unknown) => {
  const status = normalizeTrackingStatus((data as { status?: string } | undefined)?.status)
  return Boolean(status) && !TRACKING_TERMINAL_STATUSES.has(status)
}

export const useTracking = (
  awb?: string | null,
  order?: string | null,
  contact?: string | null,
) => {
  return useQuery({
    queryKey: ['tracking', { awb, order, contact }],
    queryFn: () =>
      fetchTracking({
        awb: awb || undefined,
        orderNumber: order || undefined,
        contact: contact || undefined,
      }),
    enabled: !!awb || (!!order && !!contact),
    staleTime: 60_000, // 1 minute
    refetchInterval: (query) => (shouldPollTracking(query.state.data) ? 30000 : false),
    refetchIntervalInBackground: false,
    retry: 1,
  })
}
