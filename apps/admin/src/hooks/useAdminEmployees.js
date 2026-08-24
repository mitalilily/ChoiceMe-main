import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createAdminEmployee,
  deleteAdminEmployee,
  fetchAdminAccess,
  fetchAdminEmployees,
  updateAdminEmployee,
  updateAdminEmployeeStatus,
} from 'services/adminEmployee.service'

export const useAdminAccess = () =>
  useQuery({
    queryKey: ['admin-access'],
    queryFn: fetchAdminAccess,
    staleTime: 60 * 1000,
    retry: 1,
  })

export const useAdminEmployees = (page, limit, filters) =>
  useQuery({
    queryKey: ['admin-employees', page, limit, filters],
    queryFn: () => fetchAdminEmployees(page, limit, filters),
    keepPreviousData: true,
  })

export const useCreateAdminEmployeeMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createAdminEmployee,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-employees'] }),
  })
}

export const useUpdateAdminEmployeeMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ memberId, payload }) => updateAdminEmployee(memberId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-employees'] }),
  })
}

export const useUpdateAdminEmployeeStatusMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ memberId, isActive }) => updateAdminEmployeeStatus(memberId, isActive),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-employees'] }),
  })
}

export const useDeleteAdminEmployeeMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteAdminEmployee,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-employees'] }),
  })
}
