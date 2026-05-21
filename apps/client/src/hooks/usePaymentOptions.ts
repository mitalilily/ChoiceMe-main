import { useQuery } from '@tanstack/react-query'
import { paymentOptionsService, type PaymentOptions } from '../api/paymentOptions.service'

export const usePaymentOptions = () => {
  return useQuery<PaymentOptions>({
    queryKey: ['paymentOptions'],
    queryFn: () => paymentOptionsService.getPaymentOptions(),
    staleTime: 0,
    gcTime: 30 * 1000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    retry: 3,
  })
}
