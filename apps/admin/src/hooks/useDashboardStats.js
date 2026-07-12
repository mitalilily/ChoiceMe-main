import { useQuery } from '@tanstack/react-query'
import { getAdminDashboardStats } from 'services/dashboard.service'

export const useDashboardStats = () => {
  return useQuery({
    queryKey: ['admin-dashboard-stats'],
    queryFn: () => getAdminDashboardStats(),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    refetchInterval: 60 * 1000,
  })
}

