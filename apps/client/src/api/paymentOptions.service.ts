import axiosInstance from './axiosInstance'

export interface PaymentOptions {
  codEnabled: boolean
  prepaidEnabled: boolean
  minWalletRecharge: number
}

export const paymentOptionsService = {
  getPaymentOptions: async (): Promise<PaymentOptions> => {
    const response = await axiosInstance.get<PaymentOptions>('/payment-options', {
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
      params: { _t: Date.now() },
    })
    return response.data
  },
}
