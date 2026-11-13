import { Alert, Box, Button, CircularProgress, Stack } from '@mui/material'
import { useEffect } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import type { CreateShipmentParams } from '../../../api/order.service'
import { useBookB2CCourier } from '../../../hooks/Orders/useOrders'
import type { B2COrder } from '../../../types/generic.types'
import { normalizeParcelWeightInputToGrams } from '../../../utils/weight'
import CustomDialog from '../../UI/modal/CustomModal'
import { SelectCourierForm } from '../SelectCourierForm'
import WarehouseSelector from '../WarehouseSelector'
import type { B2CFormData, Product } from './B2COrderForm'

type B2CSelectCourierDialogProps = {
  open: boolean
  order: B2COrder | null
  onClose: () => void
}

const padDatePart = (value: number) => String(value).padStart(2, '0')

const getLocalDateInputValue = () => {
  const today = new Date()
  return `${today.getFullYear()}-${padDatePart(today.getMonth() + 1)}-${padDatePart(today.getDate())}`
}

const normalizeDateInput = (value?: string | null) => {
  const normalized = String(value || '')
    .trim()
    .slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : getLocalDateInputValue()
}

const normalizeKgValue = (value?: number | string | null) => {
  const numericValue = Number(value ?? 0)
  if (!Number.isFinite(numericValue) || numericValue <= 0) return 0
  return numericValue > 50 ? numericValue / 1000 : numericValue
}

const getOrderProducts = (order: B2COrder | null): Product[] => {
  const rawProducts: unknown = order?.products
  const products = Array.isArray(rawProducts) ? rawProducts : []

  if (!products.length) {
    return [{ productName: '', price: 0, quantity: 1 }]
  }

  return products.map((product: any) => ({
    productName: String(product?.productName ?? product?.name ?? ''),
    price: Number(product?.price ?? 0),
    quantity: Number(product?.quantity ?? product?.qty ?? 1),
    sku: String(product?.sku ?? ''),
    hsnCode: String(product?.hsnCode ?? product?.hsn ?? ''),
    discount: Number(product?.discount ?? 0),
    taxRate: Number(product?.taxRate ?? product?.tax_rate ?? 0),
  }))
}

const getOrderDefaults = (order: B2COrder | null): B2CFormData => {
  const pickupDetails = (order?.pickup_details || {}) as NonNullable<B2COrder['pickup_details']> & {
    pickup_date?: string
    pickup_time?: string
  }
  const rtoDetails = (order?.rto_details || {}) as NonNullable<B2COrder['rto_details']>

  return {
    buyerName: order?.buyer_name || '',
    buyerPhone: order?.buyer_phone || '',
    buyerEmail: order?.buyer_email || '',
    address: order?.address || '',
    pincode: order?.pincode || '',
    city: order?.city || '',
    state: order?.state || '',
    country: order?.country || 'India',
    products: getOrderProducts(order),
    weight: normalizeKgValue(order?.weight),
    length: Number(order?.length ?? 0),
    breadth: Number(order?.breadth ?? 0),
    height: Number(order?.height ?? 0),
    orderId: order?.order_number || '',
    orderDate: normalizeDateInput(order?.order_date),
    orderType: order?.order_type || 'prepaid',
    courierPartner: '',
    shippingCharges: Number(order?.shipping_charges ?? 0),
    transactionFee: Number(order?.transaction_fee ?? 0),
    isRtoSame: !order?.is_rto_different,
    giftWrap: Number(order?.gift_wrap ?? 0),
    discount: Number(order?.discount ?? 0),
    prepaidAmount: Number(order?.prepaid_amount ?? 0),
    courierCod: 0,
    otherCharges: 0,
    forwardCharges: 0,
    courierCost: null,
    rtoLocationPincode: rtoDetails?.pincode || '',
    rtoLocationName: rtoDetails?.warehouse_name || rtoDetails?.name || '',
    pickupCity: pickupDetails?.city || '',
    pickupState: pickupDetails?.state || '',
    rtoCity: rtoDetails?.city || '',
    rtoState: rtoDetails?.state || '',
    rtoLocationPOCName: rtoDetails?.name || '',
    rtoLocationPOCPhone: rtoDetails?.phone || '',
    rtoAddress: rtoDetails?.address || '',
    pickupLocationPOCPhone: pickupDetails?.phone || '',
    pickupLocationId: order?.pickup_location_id || '',
    pickupLocationPincode: pickupDetails?.pincode || '',
    pickupLocationName: pickupDetails?.warehouse_name || pickupDetails?.name || '',
    pickupAddress: pickupDetails?.address || '',
    pickupLocationPOCName: pickupDetails?.name || '',
    courierPartnerId: '',
    courierOptionKey: '',
    selectedMaxSlabWeight: null,
    orderAmount: Number(order?.order_amount ?? 0),
    pickupDate: normalizeDateInput(pickupDetails?.pickup_date),
    pickupTime: pickupDetails?.pickup_time || '',
    chargeableWeight: null,
    volumetricWeight: null,
    slabs: null,
    zone: order?.delivery_location || '',
    zoneId: '',
  }
}

const getSubtotal = (products: Product[]) =>
  products.reduce(
    (sum, product) =>
      sum +
      Number(product.price ?? 0) * Number(product.quantity ?? 1) -
      Number(product.discount ?? 0),
    0,
  )

export default function B2CSelectCourierDialog({
  open,
  order,
  onClose,
}: B2CSelectCourierDialogProps) {
  const methods = useForm<B2CFormData>({
    defaultValues: getOrderDefaults(order),
  })
  const {
    handleSubmit,
    register,
    reset,
    setError,
    formState: { errors },
  } = methods
  const bookCourierMutation = useBookB2CCourier(onClose)

  useEffect(() => {
    reset(getOrderDefaults(order))
  }, [order, reset])

  useEffect(() => {
    register('courierPartnerId', {
      required: 'Please select a courier partner',
    })
  }, [register])

  const handleBookCourier = (data: B2CFormData) => {
    const orderId = String(order?.id || '').trim()
    if (!orderId) return

    if (!data.courierPartnerId) {
      setError('courierPartnerId', {
        type: 'manual',
        message: 'Please select a courier partner',
      })
      return
    }

    const subtotal = getSubtotal(data.products || [])
    const shippingCharges = Number(data.shippingCharges || 0)
    const transactionFee = Number(data.transactionFee || 0)
    const giftWrap = Number(data.giftWrap || 0)
    const discount = Number(data.discount || 0)
    const prepaidAmount = Number(data.prepaidAmount || 0)
    const totalOrderValue = subtotal + shippingCharges + transactionFee + giftWrap - discount
    const totalCollectable = totalOrderValue - prepaidAmount

    const payload: CreateShipmentParams = {
      order_number: data.orderId.trim(),
      payment_type: data.orderType,
      order_amount: subtotal,
      cod_charge_basis: Math.max(totalCollectable, 0),
      order_date: data.orderDate,
      package_weight: normalizeParcelWeightInputToGrams(data.weight),
      package_length: data.length,
      cod_charges: data.courierCod,
      package_breadth: data.breadth,
      package_height: data.height,
      shipping_mode: data.shippingMode,
      shipping_charges: shippingCharges,
      freight_charges: Number(data.forwardCharges ?? 0),
      courier_cost: data.courierCost ? Number(data.courierCost) : undefined,
      other_charges: Number(data.otherCharges ?? 0),
      prepaid_amount: data.prepaidAmount,
      is_rto_different: data.isRtoSame ? 'no' : 'yes',
      discount: data.discount ?? 0,
      integration_type: data.integrationType,
      transaction_fee: data.transactionFee,
      gift_wrap: data.giftWrap,
      consignee: {
        name: data.buyerName,
        address: data.address,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        email: data.buyerEmail,
        phone: data.buyerPhone,
      },
      pickup_location_id: data.pickupLocationId,
      pickup: {
        warehouse_name: data.pickupLocationName ?? '',
        address: data.pickupAddress ?? '',
        name: data.pickupLocationPOCName ?? '',
        phone: data.pickupLocationPOCPhone ?? '',
        city: data.pickupCity ?? '',
        state: data.pickupState ?? '',
        pincode: data.pickupLocationPincode ?? data.pincode,
        pickup_date: data.pickupDate,
        pickup_time: data.pickupTime,
      },
      ...(!data.isRtoSame && {
        rto: {
          warehouse_name: data.rtoLocationName ?? '',
          address: data.rtoAddress ?? '',
          name: data.rtoLocationPOCName ?? '',
          phone: data.rtoLocationPOCPhone ?? '',
          city: data.rtoCity ?? '',
          state: data.rtoState ?? '',
          pincode: data.rtoLocationPincode ?? '',
        },
      }),
      order_items: data.products.map((product) => ({
        name: product.productName,
        sku: product.sku ?? 'NA',
        qty: product.quantity,
        price: product.price,
        hsn: product.hsnCode ?? '',
        discount: product.discount ?? 0,
        tax_rate: product.taxRate ?? 0,
      })),
      courier_id: Number(data.courierPartnerId),
      courier_option_key: data.courierOptionKey,
      selected_max_slab_weight:
        data.selectedMaxSlabWeight !== undefined && data.selectedMaxSlabWeight !== null
          ? Number(data.selectedMaxSlabWeight)
          : undefined,
      pickup_date: data.pickupDate,
      pickup_time: data.pickupTime,
      delivery_location: data.zone,
      zone_id: data.zoneId,
    }

    bookCourierMutation.mutate({ orderId, data: payload })
  }

  return (
    <CustomDialog
      open={open}
      onClose={() => {
        if (!bookCourierMutation.isPending) onClose()
      }}
      title={order?.order_number ? `Select Courier - ${order.order_number}` : 'Select Courier'}
      maxWidth="xl"
      width="min(920px, calc(100vw - 24px))"
      borderRadius={20}
      footer={
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{ width: '100%', justifyContent: 'flex-end' }}
        >
          <Button
            variant="outlined"
            onClick={onClose}
            disabled={bookCourierMutation.isPending}
            sx={{ minWidth: 110, textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit(handleBookCourier)}
            disabled={bookCourierMutation.isPending}
            sx={{ minWidth: 150, textTransform: 'none' }}
          >
            {bookCourierMutation.isPending ? (
              <CircularProgress size={18} color="inherit" />
            ) : (
              'Book Shipment'
            )}
          </Button>
        </Stack>
      }
    >
      <FormProvider {...methods}>
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ mb: 2.5 }}>
            <WarehouseSelector compact disabled={bookCourierMutation.isPending} />
          </Box>
          {errors.courierPartnerId && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errors.courierPartnerId.message as string}
            </Alert>
          )}
          <SelectCourierForm
            shipment_type="b2c"
            compact
            disabled={bookCourierMutation.isPending}
            onShip={handleSubmit(handleBookCourier)}
          />
        </Box>
      </FormProvider>
    </CustomDialog>
  )
}
