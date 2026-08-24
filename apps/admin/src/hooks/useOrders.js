import { useMutation, useQuery } from '@tanstack/react-query'
import {
  cancelAdminOrder,
  bookAdminManualB2CCourier,
  createAdminManualB2COrder,
  fetchAllOrders,
  fetchAdminManualB2CCouriers,
  fetchManualBookingUsers,
  fetchManualBookingWarehouses,
  regenerateAdminOrderDocuments,
  updateAdminOrderStatus,
} from 'services/order.service'

export const useOrders = (page, limit, filters) => {
  return useQuery({
    queryKey: ['orders', page, limit, filters],
    queryFn: () => fetchAllOrders(page, limit, filters),
    keepPreviousData: true,
  })
}

export const useCancelOrderMutation = () => {
  return useMutation({
    mutationFn: (orderId) => cancelAdminOrder(orderId),
  })
}

export const useRegenerateOrderDocumentsMutation = () => {
  return useMutation({
    mutationFn: ({ orderId, regenerateLabel = true, regenerateInvoice = true }) =>
      regenerateAdminOrderDocuments(orderId, { regenerateLabel, regenerateInvoice }),
  })
}

export const useUpdateOrderStatusMutation = () => {
  return useMutation({
    mutationFn: ({ orderId, status, note }) => updateAdminOrderStatus(orderId, { status, note }),
  })
}

export const useManualBookingUsers = (search) => {
  return useQuery({
    queryKey: ['manualBookingUsers', search],
    queryFn: () => fetchManualBookingUsers({ search }),
    keepPreviousData: true,
  })
}

export const useManualBookingWarehouses = (userId) => {
  return useQuery({
    queryKey: ['manualBookingWarehouses', userId],
    queryFn: () => fetchManualBookingWarehouses(userId),
    enabled: Boolean(userId),
  })
}

export const useCreateAdminManualB2COrderMutation = () => {
  return useMutation({
    mutationFn: (payload) => createAdminManualB2COrder(payload),
  })
}

export const useFetchAdminManualB2CCouriersMutation = () => {
  return useMutation({
    mutationFn: (payload) => fetchAdminManualB2CCouriers(payload),
  })
}

export const useBookAdminManualB2CCourierMutation = () => {
  return useMutation({
    mutationFn: ({ orderId, payload }) => bookAdminManualB2CCourier(orderId, payload),
  })
}
