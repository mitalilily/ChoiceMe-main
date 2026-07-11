import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  approveQuickDetail,
  fetchQuickDetails,
  generateQuickDetailLink,
  rejectQuickDetail,
  type QuickDetailStatus,
} from '../api/quickDetails.api'
import type { CreateShipmentParams } from '../api/order.service'
import { toast } from '../components/UI/Toast'

const getApiErrorMessage = (error: unknown, fallback: string) => {
  const apiError = error as { response?: { data?: { message?: string } }; message?: string }
  return apiError.response?.data?.message ?? apiError.message ?? fallback
}

export const useQuickDetails = (
  page: number,
  limit: number,
  status?: QuickDetailStatus,
) =>
  useQuery({
    queryKey: ['quickDetails', page, limit, status],
    queryFn: () => fetchQuickDetails({ page, limit, status }),
  })

export const useGenerateQuickDetailLink = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: generateQuickDetailLink,
    onSuccess: () => {
      toast.open({ message: 'Quick details link generated. ₹1 debited from wallet.', severity: 'success' })
      queryClient.invalidateQueries({ queryKey: ['quickDetails'] })
      queryClient.invalidateQueries({ queryKey: ['walletBalance'] })
      queryClient.invalidateQueries({ queryKey: ['walletTransactions'] })
    },
    onError: (error) => {
      toast.open({
        message: getApiErrorMessage(error, 'Failed to generate quick details link.'),
        severity: 'error',
      })
    },
  })
}

export const useRejectQuickDetail = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => rejectQuickDetail(id, reason),
    onSuccess: () => {
      toast.open({ message: 'Quick details rejected.', severity: 'success' })
      queryClient.invalidateQueries({ queryKey: ['quickDetails'] })
    },
    onError: (error) => {
      toast.open({
        message: getApiErrorMessage(error, 'Failed to reject quick details.'),
        severity: 'error',
      })
    },
  })
}

export const useApproveQuickDetail = (onSuccess?: () => void) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CreateShipmentParams }) =>
      approveQuickDetail(id, payload),
    onSuccess: () => {
      toast.open({
        message: 'Quick details approved and B2C draft order created.',
        severity: 'success',
      })
      queryClient.invalidateQueries({ queryKey: ['quickDetails'] })
      queryClient.invalidateQueries({ queryKey: ['b2cOrdersByUser'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      onSuccess?.()
    },
    onError: (error) => {
      toast.open({
        message: getApiErrorMessage(error, 'Failed to approve quick details.'),
        severity: 'error',
      })
    },
  })
}
