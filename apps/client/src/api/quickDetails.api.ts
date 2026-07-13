import type { CreateShipmentParams } from './order.service'
import axiosInstance from './axiosInstance'

export type QuickDetailStatus = 'generated' | 'submitted' | 'approved' | 'rejected'

export type QuickDetailCustomerDetails = {
  fullName: string
  phone: string
  email?: string
  address: string
  landmark?: string
  pincode: string
  city: string
  state: string
  country: string
  paymentMode: 'cod' | 'prepaid'
}

export type QuickDetail = {
  id: string
  token: string
  userId: string
  storeName: string
  storeSlug: string
  status: QuickDetailStatus
  chargeAmount: number
  customerDetails?: QuickDetailCustomerDetails | null
  b2cOrderId?: string | null
  b2cOrderNumber?: string | null
  publicPath: string
  publicUrl: string
  createdAt?: string
  submittedAt?: string
  approvedAt?: string
  rejectedAt?: string
  rejectionReason?: string | null
}

export const fetchQuickDetails = async (params: {
  page?: number
  limit?: number
  status?: QuickDetailStatus
}) => {
  const res = await axiosInstance.get('/quick-details', { params })
  return res.data as { success: boolean; rows: QuickDetail[]; totalCount: number; totalPages: number }
}

export const generateQuickDetailLink = async () => {
  const res = await axiosInstance.post('/quick-details/generate')
  return res.data as { success: boolean; data: QuickDetail }
}

export const rejectQuickDetail = async (id: string, reason?: string) => {
  const res = await axiosInstance.post(`/quick-details/${id}/reject`, { reason })
  return res.data
}

export const approveQuickDetail = async (id: string, payload: CreateShipmentParams) => {
  const res = await axiosInstance.post(`/quick-details/${id}/approve`, payload, {
    timeout: 210000,
  })
  return res.data
}

export const fetchPublicQuickDetail = async (storeSlug: string, token: string) => {
  const res = await axiosInstance.get(`/quick-details/public/${storeSlug}/${token}`)
  return res.data as {
    success: boolean
    data: {
      id: string
      token: string
      storeName: string
      sellerPhone: string
      storeSlug: string
      status: QuickDetailStatus
      canSubmit: boolean
    }
  }
}

export const submitPublicQuickDetail = async (
  storeSlug: string,
  token: string,
  payload: QuickDetailCustomerDetails,
) => {
  const res = await axiosInstance.post(`/quick-details/public/${storeSlug}/${token}`, payload)
  return res.data
}
