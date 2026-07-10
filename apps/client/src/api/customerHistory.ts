import axiosInstance from './axiosInstance'

export type PreviousCustomer = {
  id: string
  name: string
  phone: string
  email: string
  address: string
  city: string
  state: string
  country: string
  pincode: string
  companyName: string
  gstin: string
  orderCount: number
  lastOrderAt: string | null
  lastOrderNumber: string
  orderTypes: Array<'b2c' | 'b2b'>
  productNames: string[]
}

export type PreviousProduct = {
  id: string
  productName: string
  sku: string
  quantity: number
  price: number
  hsnCode: string
  discount: number
  taxRate: number
  orderCount: number
  lastUsedAt: string | null
}

export type CustomerHistoryResponse = {
  success: boolean
  customers: PreviousCustomer[]
  products: PreviousProduct[]
}

export const fetchCustomerHistory = async (): Promise<CustomerHistoryResponse> => {
  const response = await axiosInstance.get('/orders/customers')
  return response.data
}
