import { useQuery } from '@tanstack/react-query'
import { fetchCustomerHistory } from '../api/customerHistory'

export const useCustomerHistory = () =>
  useQuery({
    queryKey: ['customerHistory'],
    queryFn: fetchCustomerHistory,
    staleTime: 5 * 60 * 1000,
  })
