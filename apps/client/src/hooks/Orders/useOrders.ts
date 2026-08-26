import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteB2COrder,
  bookB2CCourier,
  createB2BShipment,
  createShipment,
  fetchAllOrders,
  fetchB2BOrdersByUser,
  fetchB2COrdersByUser,
  generateManifestService,
  regenerateOrderDocumentsService,
  requestB2CPickupService,
  retryFailedManifestService,
  updateB2COrder,
  syncB2COrderTrackingService,
  type CreateB2BShipmentParams,
  type CreateShipmentParams,
  type BookB2CCourierParams,
  type GenerateManifestParams,
  type GenerateManifestResponse,
  type RequestB2CPickupParams,
  type RequestB2CPickupResponse,
  type RetryManifestResponse,
  type SyncB2CTrackingResponse,
} from '../../api/order.service'
import { cancelShipment as cancelShipmentApi } from '../../api/pickups'
import { createReverseShipment } from '../../api/returns'
import { toast } from '../../components/UI/Toast'

type ApiError = {
  response?: { data?: { message?: string } }
  message?: string
}

const getApiErrorMessage = (error: unknown, fallback: string) => {
  const apiError = error as ApiError
  return apiError.response?.data?.message ?? apiError.message ?? fallback
}

const getApiErrorDetails = (error: unknown) => {
  const apiError = error as ApiError
  return apiError.response?.data ?? apiError.message ?? error
}

export const useCreateShipment = (onClose?: () => void) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateShipmentParams) => createShipment(data),

    // 🔹 Error handling
    onError: (error: unknown) => {
      const message = getApiErrorMessage(error, 'Failed to create shipment. Please try again.')
      toast.open({ message, severity: 'error' })
      console.error('Failed to create shipment:', getApiErrorDetails(error))
    },

    // 🔹 Success handling
    onSuccess: (data) => {
      toast.open({ message: 'Order created successfully', severity: 'success' })
      console.log('Order created successfully:', data)
      queryClient.invalidateQueries({ queryKey: ['b2cOrdersByUser'] })
      queryClient.invalidateQueries({ queryKey: ['customerHistory'] })
      if (onClose) onClose() // ✅ Close modal/drawer after success
    },
  })
}

export const useUpdateB2COrder = (onClose?: () => void) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, data }: { orderId: string; data: CreateShipmentParams }) =>
      updateB2COrder(orderId, data),
    onError: (error: unknown) => {
      const message = getApiErrorMessage(error, 'Failed to update order. Please try again.')
      toast.open({ message, severity: 'error' })
      console.error('Failed to update order:', getApiErrorDetails(error))
    },
    onSuccess: () => {
      toast.open({ message: 'Order updated successfully', severity: 'success' })
      queryClient.invalidateQueries({ queryKey: ['b2cOrdersByUser'] })
      queryClient.invalidateQueries({ queryKey: ['customerHistory'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      if (onClose) onClose()
    },
  })
}

export const useDeleteB2COrder = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (orderId: string) => deleteB2COrder(orderId),
    onError: (error: unknown) => {
      const message = getApiErrorMessage(error, 'Failed to delete order. Please try again.')
      toast.open({ message, severity: 'error' })
      console.error('Failed to delete order:', getApiErrorDetails(error))
    },
    onSuccess: () => {
      toast.open({ message: 'Draft order deleted successfully', severity: 'success' })
      queryClient.invalidateQueries({ queryKey: ['b2cOrdersByUser'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}

export const useCreateB2BShipment = (onClose?: () => void) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateB2BShipmentParams) => createB2BShipment(data),

    // 🔹 Error handling
    onError: (error: unknown) => {
      const message = getApiErrorMessage(
        error,
        'Failed to create B2B shipment. Please try again.',
      )
      toast.open({ message, severity: 'error' })
      console.error('Failed to create B2B shipment:', getApiErrorDetails(error))
    },

    // 🔹 Success handling
    onSuccess: (data) => {
      toast.open({ message: 'B2B Shipment created successfully', severity: 'success' })
      console.log('B2B Shipment created successfully:', data)
      queryClient.invalidateQueries({ queryKey: ['b2bOrdersByUser'] })
      queryClient.invalidateQueries({ queryKey: ['customerHistory'] })
      if (onClose) onClose() // ✅ Close modal/drawer after success
    },
  })
}

export const useBookB2CCourier = (onClose?: () => void) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      orderId,
      data,
    }: {
      orderId: string
      data: BookB2CCourierParams
    }) => bookB2CCourier(orderId, data),
    onError: (error: unknown) => {
      const message = getApiErrorMessage(error, 'Failed to book courier. Please try again.')
      toast.open({ message, severity: 'error' })
      console.error('Failed to book courier:', getApiErrorDetails(error))
    },
    onSuccess: (data) => {
      toast.open({
        message: data?.message || 'Courier selected and shipment booked successfully',
        severity: 'success',
      })
      queryClient.invalidateQueries({ queryKey: ['b2cOrdersByUser'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      if (onClose) onClose()
    },
  })
}
// useOrders.ts
interface Filters {
  status?: string | string[]
  draftOnly?: boolean
  sortBy?: 'created_at'
  sortOrder?: 'asc' | 'desc'
  fromDate?: string
  toDate?: string
  search?: string
}

const TRACKING_POLL_STATUSES = new Set([
  'pending',
  'booked',
  'pickup_initiated',
  'shipment_created',
  'manifest_generated',
  'in_transit',
  'out_for_delivery',
  'ndr',
  'undelivered',
  'rto_initiated',
  'rto',
  'rto_in_transit',
  'cancellation_requested',
])

type B2CTrackingPollOrder = {
  awb_number?: string | null
  order_status?: string | null
}

const shouldPollB2CTracking = (data: unknown) => {
  const payload = data as { orders?: B2CTrackingPollOrder[] } | undefined
  const orders = Array.isArray(payload?.orders) ? payload.orders : []

  return orders.some((order) => {
    const awb = String(order.awb_number || '').trim()
    const status = String(order.order_status || '')
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_')

    return Boolean(awb) && TRACKING_POLL_STATUSES.has(status)
  })
}

export const useB2COrdersByUser = (
  page: number,
  limit: number,
  filters: Filters = {},
  enabled = true,
) => {
  return useQuery({
    queryKey: ['b2cOrdersByUser', page, limit, filters],
    queryFn: () => fetchB2COrdersByUser({ page, limit, ...filters }),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 45 * 1000,
    refetchInterval: (query) => (shouldPollB2CTracking(query.state.data) ? 30000 : false),
    refetchIntervalInBackground: false,
  })
}

export const useB2BOrdersByUser = (
  page: number,
  limit: number,
  filters: Filters = {},
  enabled = true,
) => {
  return useQuery({
    queryKey: ['b2bOrdersByUser', page, limit, filters],
    queryFn: () => fetchB2BOrdersByUser({ page, limit, ...filters }),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 45 * 1000,
  })
}

export const useGenerateManifest = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: GenerateManifestParams) => generateManifestService(params),
    onSuccess: (data: GenerateManifestResponse) => {
      toast.open({ message: 'Manifest generated successfully!', severity: 'success' })
      // Refresh all merchant order lists that can surface manifest state.
      queryClient.invalidateQueries({ queryKey: ['b2cOrdersByUser'] })
      queryClient.invalidateQueries({ queryKey: ['b2bOrdersByUser'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      console.log('Manifest generated:', data)
    },
    onError: (error: unknown) => {
      const message = getApiErrorMessage(error, 'Failed to generate manifest')
      toast.open({ message, severity: 'error' })
      console.error('Manifest generation error:', error)
    },
  })
}

export const useRetryFailedManifest = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (orderId: string) => retryFailedManifestService(orderId),
    onSuccess: (data: RetryManifestResponse) => {
      toast.open({ message: 'Manifest retried successfully.', severity: 'success' })
      queryClient.invalidateQueries({ queryKey: ['b2cOrdersByUser'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      console.log('Manifest retried:', data)
    },
    onError: (error: unknown) => {
      const message = getApiErrorMessage(error, 'Failed to retry manifest')
      toast.open({ message, severity: 'error' })
      console.error('Manifest retry error:', error)
    },
  })
}

export const useSyncB2CTracking = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (orderId: string) => syncB2COrderTrackingService(orderId),
    onSuccess: (data: SyncB2CTrackingResponse) => {
      toast.open({
        message: data.message || 'Tracking status synced successfully.',
        severity: 'success',
      })
      queryClient.invalidateQueries({ queryKey: ['b2cOrdersByUser'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
    onError: (error: unknown) => {
      const message = getApiErrorMessage(error, 'Failed to sync tracking status')
      toast.open({ message, severity: 'error' })
      console.error('Tracking sync error:', error)
    },
  })
}

export const useRequestB2CPickup = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      orderId,
      ...params
    }: RequestB2CPickupParams & { orderId: string }) =>
      requestB2CPickupService(orderId, params),
    onSuccess: (data: RequestB2CPickupResponse) => {
      toast.open({
        message: data.message || 'Pickup request scheduled successfully.',
        severity: 'success',
      })
      queryClient.invalidateQueries({ queryKey: ['b2cOrdersByUser'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
    onError: (error: unknown) => {
      const message = getApiErrorMessage(error, 'Failed to request pickup')
      toast.open({ message, severity: 'error' })
      console.error('Pickup request error:', error)
    },
  })
}

export const useRegenerateOrderDocuments = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      orderId,
      regenerateLabel = true,
      regenerateInvoice = true,
    }: {
      orderId: string
      regenerateLabel?: boolean
      regenerateInvoice?: boolean
    }) => regenerateOrderDocumentsService(orderId, { regenerateLabel, regenerateInvoice }),
    onSuccess: () => {
      toast.open({ message: 'Documents regenerated successfully.', severity: 'success' })
      queryClient.invalidateQueries({ queryKey: ['b2cOrdersByUser'] })
      queryClient.invalidateQueries({ queryKey: ['b2bOrdersByUser'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
    onError: (error: unknown) => {
      const message = getApiErrorMessage(error, 'Failed to regenerate documents')
      toast.open({ message, severity: 'error' })
    },
  })
}

export const useCancelShipment = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (orderId: string) => cancelShipmentApi(orderId),
    onSuccess: () => {
      toast.open({ message: 'Cancellation request sent', severity: 'success' })
      queryClient.invalidateQueries({ queryKey: ['b2cOrdersByUser'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
    onError: (error: unknown) => {
      const message = getApiErrorMessage(error, 'Failed to cancel shipment')
      toast.open({ message, severity: 'error' })
    },
  })
}

export const useCreateReverseShipment = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => createReverseShipment(payload),
    onSuccess: () => {
      toast.open({ message: 'Reverse shipment created', severity: 'success' })
      queryClient.invalidateQueries({ queryKey: ['b2cOrdersByUser'] })
    },
    onError: (error: unknown) => {
      const message = getApiErrorMessage(error, 'Failed to create reverse shipment')
      toast.open({ message, severity: 'error' })
    },
  })
}
export interface FetchOrdersParams {
  page?: number
  limit?: number
  status?: string
  fromDate?: string
  toDate?: string
  search?: string
}

export const useAllOrders = (params: FetchOrdersParams, enabled = true) => {
  return useQuery({
    queryKey: ['orders', params], // cache key includes all params
    queryFn: () => fetchAllOrders(params), // fetch function
    staleTime: 1000 * 60, // cache data for 1 min
    placeholderData: keepPreviousData,
    enabled,
  })
}
