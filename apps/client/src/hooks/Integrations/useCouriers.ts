// src/hooks/useCouriers.ts
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  fetchAllCouriers,
  fetchAvailableCouriers,
  fetchCouriersWithDetails,
  fetchShippingRates,
  getCouriers,
  type CourierListResponse,
} from '../../api/courier'

interface UseCouriersParams {
  page?: number
  limit?: number
  filters?: Record<string, string | boolean | number>
}

export const useCouriers = ({ page, limit, filters = {} }: UseCouriersParams = {}) => {
  return useQuery<CourierListResponse>({
    queryKey: ['couriers', page, limit, filters],
    queryFn: () => getCouriers({ page, limit, filters }),
  })
}

export interface UseAvailableCouriersParams {
  pickupPincode: string
  pickupName?: string
  pickupId?: string
  deliveryPincode: string
  pickupAddressKey?: string
  deliveryAddressKey?: string
  weight?: number
  cod?: number
  orderAmount?: number
  codChargeBasis?: number
  length?: number
  breadth?: number
  height?: number
  enabled?: boolean
  shipmentType?: 'b2b' | 'b2c'
  payment_type: 'cod' | 'prepaid'
  context?: string
  isCalculator?: boolean
  useGuest?: boolean
}

export const useAvailableCouriers = (params: UseAvailableCouriersParams) => {
  const {
    pickupPincode,
    deliveryPincode,
    pickupId,
    pickupAddressKey,
    deliveryAddressKey,
    weight,
    cod,
    orderAmount,
    codChargeBasis,
    length,
    breadth,
    height,
    enabled = true,
    shipmentType,
    payment_type,
  } = params

  const normalizedOrderAmount =
    typeof orderAmount === 'number' && orderAmount > 0 ? orderAmount : undefined
  const normalizedCodChargeBasis =
    typeof codChargeBasis === 'number' && codChargeBasis >= 0
      ? codChargeBasis
      : normalizedOrderAmount

  return useQuery({
    queryKey: [
      'availableCouriers',
      pickupPincode,
      deliveryPincode,
      pickupId,
      pickupAddressKey,
      deliveryAddressKey,
      weight,
      cod,
      orderAmount,
      codChargeBasis,
      length,
      breadth,
      height,
      shipmentType,
      params.useGuest,
      params?.pickupName,
    ],
    queryFn: () =>
      fetchAvailableCouriers({
        origin: pickupPincode,
        destination: deliveryPincode,
        pickupId,
        payment_type: payment_type,
        order_amount: normalizedOrderAmount,
        cod_charge_basis: normalizedCodChargeBasis,
        weight,
        length,
        ...(shipmentType && { shipment_type: shipmentType }),
        isCalculator: params.isCalculator === true || params.context === 'rate_calculator',
        breadth,
        height,
        useGuest: params.useGuest === true,
    }),
    enabled: enabled && !!pickupPincode && !!deliveryPincode && (!!weight || !!cod),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    refetchInterval: enabled ? 15000 : false,
    retry: 1,
  })
}

export const useAvailableCouriersMutation = () => {
  return useMutation({
    mutationFn: (params: UseAvailableCouriersParams) => {
      const normalizedOrderAmount =
        typeof params.orderAmount === 'number' && params.orderAmount > 0 ? params.orderAmount : undefined
      const normalizedCodChargeBasis =
        typeof params.codChargeBasis === 'number' && params.codChargeBasis >= 0
          ? params.codChargeBasis
          : normalizedOrderAmount

      return fetchAvailableCouriers({
        origin: params.pickupPincode,
        destination: params.deliveryPincode,
        pickupId: params.pickupId,
        payment_type: params.payment_type ?? (params.cod && params.cod > 0 ? 'cod' : 'prepaid'),
        order_amount: normalizedOrderAmount,
        cod_charge_basis: normalizedCodChargeBasis,
        weight: params.weight,
        length: params.length,
        breadth: params.breadth,
        height: params.height,
        shipment_type: params?.shipmentType,
        isCalculator: params.isCalculator === true || params.context === 'rate_calculator',
        useGuest: params.useGuest === true,
      })
    },
    retry: 1,
  })
}

export const useShippingRates = (filters = {}) => {
  return useQuery({
    queryKey: ['getShippingRates', filters],
    queryFn: () => fetchShippingRates(filters),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    refetchInterval: 15000,
  })
}

export const useAllCouriers = () => {
  return useQuery({
    queryKey: ['allCouriers'],
    queryFn: () => fetchAllCouriers(),
  })
}

export const useAllCouriersWithDetails = () => {
  return useQuery({
    queryKey: ['allCouriers'],
    queryFn: () => fetchCouriersWithDetails(),
  })
}
