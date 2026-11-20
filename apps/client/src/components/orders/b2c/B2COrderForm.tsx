import { Box, Button, LinearProgress, Stack, Typography, alpha } from '@mui/material'
import { useEffect, useState } from 'react'
import { FormProvider, useFieldArray, useForm, type FieldErrors } from 'react-hook-form'
import { FaBox, FaCheck, FaUser } from 'react-icons/fa'
import { useNavigate } from 'react-router-dom'
import { fetchLocations } from '../../../api/locations'
import type { CreateShipmentParams } from '../../../api/order.service'
import { useCreateShipment, useUpdateB2COrder } from '../../../hooks/Orders/useOrders'
import { usePaymentOptions } from '../../../hooks/usePaymentOptions'
import { normalizeParcelWeightInputToGrams } from '../../../utils/weight'
import AmountSummaryCard from '../AmountSummaryCard'
import DeliveryDetailsForm from '../DeliveryDetailsForm'
import OptionalChargesForm from '../OptionalChargesForm'
import OrderDetailsForm from '../OrderDetailsForm'
import PickupLocationForm from '../PickupLocationForm'
import PaymentModeSelector from '../PaymentModeSelector'
import PackageDetailsForm from './PackageDetailsForm'
import PackageDimensionsForm from './PackageDimensionsForm'

const ACCENT = '#0D3B8E'
const TEXT_PRIMARY = '#102A54'
const TEXT_MUTED = '#496189'
const padDatePart = (value: number) => String(value).padStart(2, '0')
const getLocalDateInputValue = () => {
  const today = new Date()
  return `${today.getFullYear()}-${padDatePart(today.getMonth() + 1)}-${padDatePart(today.getDate())}`
}

export type Product = {
  productName: string
  price: number
  quantity: number
  discount?: number
  taxRate?: number
  hsnCode?: string
  sku?: string
}

export type B2CFormData = {
  buyerName: string
  buyerPhone: string
  buyerEmail: string
  address: string
  pincode: string
  city: string
  state: string
  country: string
  products: Product[]
  weight: number
  length: number
  breadth: number
  height: number
  orderId: string
  orderDate: string
  orderType: 'prepaid' | 'cod'
  courierPartner: string
  shippingCharges?: number
  transactionFee?: number
  isRtoSame?: boolean
  giftWrap?: number
  discount?: number
  prepaidAmount?: number
  courierCod?: number
  otherCharges?: number
  forwardCharges?: number
  courierCost?: number | null // Estimated courier cost from serviceability (what platform pays courier)

  rtoLocationPincode?: string
  rtoLocationName?: string
  pickupCity?: string
  pickupState?: string
  rtoCity?: string
  rtoState?: string
  rtoLocationPOCName?: string
  rtoLocationPOCPhone?: string
  rtoAddress?: string
  pickupLocationPOCPhone?: string
  pickupLocationId?: string
  pickupLocationPincode?: string
  pickupLocationName?: string
  integrationType?: 'delhivery' | 'xpressbees' | 'ekart' | 'deliveryone' | 'icarry' | 'shadowfax'
  shippingMode?: string
  pickupAddress?: string
  pickupLocationPOCName?: string
  courierPartnerId: string
  courierOptionKey?: string
  selectedMaxSlabWeight?: number | null
  orderAmount: number
  pickupDate: string
  pickupTime: string
  chargeableWeight?: number | null
  volumetricWeight?: number | null
  slabs?: number | null
  zone?: string
  zoneId?: string
}

type B2COrderFormStepsProps = {
  onClose?: () => void
  initialValues?: Partial<B2CFormData>
  mode?: 'create' | 'edit'
  existingOrderId?: string | null
  submitOverride?: (payload: CreateShipmentParams) => void | Promise<void>
}

export default function B2COrderFormSteps({
  onClose,
  initialValues,
  mode = 'create',
  existingOrderId,
  submitOverride,
}: B2COrderFormStepsProps) {
  const createShipmentMutation = useCreateShipment(onClose)
  const updateOrderMutation = useUpdateB2COrder(onClose)
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)
  const { data: paymentOptions } = usePaymentOptions()
  const isEditMode = mode === 'edit'

  const defaultPickupDate = getLocalDateInputValue()

  // Determine default order type based on enabled payment options
  const getDefaultOrderType = (): 'prepaid' | 'cod' => {
    if (!paymentOptions) return 'prepaid' // Default fallback
    if (paymentOptions.prepaidEnabled) return 'prepaid'
    if (paymentOptions.codEnabled) return 'cod'
    return 'prepaid' // Final fallback
  }

  const baseDefaultValues: Partial<B2CFormData> = {
    products: [{ productName: '', price: 0, quantity: 1 }],
    weight: 0,
    length: 0,
    breadth: 0,
    height: 0,
    courierPartnerId: '',
    pickupDate: defaultPickupDate,
    pickupTime: '',
    orderType: getDefaultOrderType(),
    selectedMaxSlabWeight: null,
  }

  const methods = useForm<B2CFormData>({
    defaultValues: {
      ...baseDefaultValues,
      ...initialValues,
      products:
        initialValues?.products && initialValues.products.length > 0
          ? initialValues.products
          : baseDefaultValues.products,
    },
  })

  const {
    control,
    watch,
    setValue,
    handleSubmit,
    trigger,
    formState: { errors },
  } = methods
  const { fields, append, remove } = useFieldArray({ control, name: 'products' })

  const shippingCharges = Number(watch('shippingCharges') || 0)
  const transactionFee = Number(watch('transactionFee') || 0)
  const giftWrap = Number(watch('giftWrap') || 0)
  const discount = Number(watch('discount') || 0)
  const prepaidAmount = Number(watch('prepaidAmount') || 0)
  const orderType = watch('orderType') || getDefaultOrderType()

  // Ensure orderType is valid based on payment options
  useEffect(() => {
    if (paymentOptions && orderType) {
      const isCurrentTypeEnabled =
        (orderType === 'cod' && paymentOptions.codEnabled) ||
        (orderType === 'prepaid' && paymentOptions.prepaidEnabled)

      if (!isCurrentTypeEnabled) {
        const newOrderType = paymentOptions.prepaidEnabled
          ? 'prepaid'
          : paymentOptions.codEnabled
            ? 'cod'
            : 'prepaid'
        setValue('orderType', newOrderType)
      }
    }
  }, [paymentOptions, orderType, setValue])

  const subtotal = fields.reduce(
    (sum, _, idx) =>
      sum +
      (watch(`products.${idx}.price`) || 0) * (watch(`products.${idx}.quantity`) || 0) -
      (watch(`products.${idx}.discount`) || 0),
    0,
  )

  // Calculate total order value (customer-facing)
  // Includes: subtotal + shipping + transaction_fee + gift_wrap - discount
  const totalOrderValue = subtotal + shippingCharges + transactionFee + giftWrap - discount
  const totalCollectable = totalOrderValue - prepaidAmount

  const onSubmit = async (data: B2CFormData) => {
    try {
      const normalizedOrderId = data.orderId.trim()

      if (!normalizedOrderId) {
        methods.setError('orderId', {
          type: 'manual',
          message: 'Order ID is required',
        })
        return
      }

      const payload: CreateShipmentParams = {
        order_number: normalizedOrderId,
        payment_type: data.orderType,
        order_amount: subtotal,
        cod_charge_basis: Math.max(totalCollectable, 0),
        order_date: data?.orderDate,
        package_weight: normalizeParcelWeightInputToGrams(data.weight),
        package_length: data.length,
        cod_charges: data?.courierCod,
        package_breadth: data.breadth,
        package_height: data.height,
        shipping_mode: data.shippingMode,
        shipping_charges: Number(data?.shippingCharges ?? 0), // What seller charges customer
        freight_charges: Number(data?.forwardCharges ?? 0), // What platform charges seller (based on rate card)
        courier_cost: data?.courierCost ? Number(data.courierCost) : undefined, // Estimated courier cost from serviceability (what platform pays courier)
        other_charges: Number(data?.otherCharges ?? 0),
        prepaid_amount: data?.prepaidAmount,
        is_rto_different: data?.isRtoSame ? 'no' : 'yes',
        discount: data.discount ?? 0,
        integration_type: data?.integrationType,
        transaction_fee: data?.transactionFee,
        gift_wrap: data?.giftWrap,
        consignee: {
          name: data.buyerName,
          address: data.address,
          city: data.city,
          state: data.state,
          pincode: data.pincode,
          email: data?.buyerEmail,
          phone: data.buyerPhone,
        },
        pickup_location_id: data.pickupLocationId,
        pickup: {
          warehouse_name: data?.pickupLocationName ?? '',
          address: data?.pickupAddress ?? '',
          name: data?.pickupLocationPOCName ?? '',
          phone: data?.pickupLocationPOCPhone ?? '',
          city: data?.pickupCity ?? '',
          state: data?.pickupState ?? '',
          pincode: data.pickupLocationPincode ?? data.pincode,
          pickup_date: data.pickupDate,
          pickup_time: data.pickupTime,
        },

        ...(!data?.isRtoSame && {
          rto: {
            warehouse_name: data?.rtoLocationName ?? '',
            address: data?.rtoAddress ?? '',
            name: data?.rtoLocationPOCName ?? '',
            phone: data?.rtoLocationPOCPhone ?? '',
            city: data?.rtoCity ?? '',
            state: data?.rtoState ?? '',
            pincode: data?.rtoLocationPincode ?? '',
          },
        }),
        order_items: data.products.map((p) => ({
          name: p.productName,
          sku: p.sku ?? 'NA',
          qty: p.quantity,
          price: p.price,
          hsn: p.hsnCode ?? '',
          discount: p.discount ?? 0,
          tax_rate: p.taxRate ?? 0,
        })),
        pickup_date: data.pickupDate,
        pickup_time: data.pickupTime,
        ...(data.courierPartnerId
          ? {
              courier_id: Number(data.courierPartnerId),
              courier_option_key: data.courierOptionKey,
              selected_max_slab_weight:
                data.selectedMaxSlabWeight !== undefined && data.selectedMaxSlabWeight !== null
                  ? Number(data.selectedMaxSlabWeight)
                  : undefined,
              delivery_location: data.zone,
              zone_id: data.zoneId,
            }
          : {}),
      }
      if (submitOverride) {
        await submitOverride(payload)
        return
      }

      if (isEditMode) {
        if (!existingOrderId) {
          throw new Error('Missing order ID for update')
        }

        updateOrderMutation.mutate({ orderId: existingOrderId, data: payload })
        return
      }

      createShipmentMutation.mutate(payload, {
        onSuccess: () => {
          navigate('/orders/b2c/list')
        },
      })
    } catch (error) {
      console.error('Error submitting B2C order:', error)
    }
  }

  const stepLabels = [
    { title: 'Customer', caption: 'Who is this order going to?', icon: <FaUser /> },
    { title: 'Order', caption: 'Products, pricing and payment', icon: <FaBox /> },
    { title: 'Package', caption: 'Weight, dimensions and pickup warehouse', icon: <FaBox /> },
  ]
  const busy = isEditMode ? updateOrderMutation.isPending : createShipmentMutation.isPending

  const validateStep = async () => {
    if (currentStep === 0) {
      const valid = await trigger([
        'buyerName',
        'buyerPhone',
        'address',
        'pincode',
        'city',
        'state',
        'country',
      ])
      if (!valid) return false
      try {
        const response = await fetchLocations({ pincode: watch('pincode') })
        if (!(Array.isArray(response?.data) ? response.data.length > 0 : !!response?.data)) {
          methods.setError('pincode', {
            type: 'manual',
            message: 'Destination pincode not serviceable by any courier',
          })
          return false
        }
      } catch {
        /* Final serviceability is checked by the booking API. */
      }
      return true
    }
    if (currentStep === 1) {
      if (!fields.length) {
        methods.setError('products', { type: 'manual', message: 'Add at least one product' })
        return false
      }
      const productFields = fields.flatMap((_, index) =>
        ['productName', 'price', 'quantity'].map(
          (key) => `products.${index}.${key}` as keyof B2CFormData,
        ),
      )
      return trigger(['orderId', 'orderDate', 'orderType', ...productFields])
    }
    return trigger([
      'weight',
      'length',
      'breadth',
      'height',
      'pickupLocationId',
      'pickupDate',
      'pickupTime',
    ])
  }

  const nextStep = async () => {
    if (await validateStep()) setCurrentStep((step) => Math.min(step + 1, 2))
  }
  useEffect(() => {
    setValue('orderAmount', totalCollectable, { shouldValidate: true })
  }, [setValue, totalCollectable])

  return (
    <FormProvider {...methods}>
      <Box
        sx={{
          bgcolor: '#fff',
          border: '1px solid #E5E9EF',
          borderRadius: 3,
          overflow: 'hidden',
          color: TEXT_PRIMARY,
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          height: { xs: '100%', sm: 'min(720px, calc(92dvh - 112px))' },
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}
        >
          <Stack
            component="nav"
            aria-label="Order steps"
            spacing={1}
            sx={{
              width: { xs: '100%', md: 180 },
              flexShrink: 0,
              bgcolor: '#F8FAFC',
              p: { xs: 1.5, md: 2 },
              borderRight: { md: '1px solid #E5E9EF' },
              flexDirection: { xs: 'row', md: 'column' },
              gap: 1,
            }}
          >
            {stepLabels.map((step, index) => (
              <Button
                key={step.title}
                disabled={busy || index > currentStep}
                onClick={() => setCurrentStep(index)}
                aria-current={index === currentStep ? 'step' : undefined}
                sx={{
                  justifyContent: 'flex-start',
                  textAlign: 'left',
                  textTransform: 'none',
                  minWidth: 0,
                  flex: { xs: 1, md: 'unset' },
                  px: { xs: 1, md: 1.5 },
                  py: 1.5,
                  borderLeft:
                    index === currentStep ? `3px solid ${ACCENT}` : '3px solid transparent',
                  bgcolor: index === currentStep ? alpha(ACCENT, 0.08) : 'transparent',
                  color: index < currentStep ? '#16865D' : TEXT_PRIMARY,
                }}
              >
                <Box
                  sx={{
                    display: { xs: 'none', sm: 'grid' },
                    placeItems: 'center',
                    width: 32,
                    height: 32,
                    mr: 1,
                    flexShrink: 0,
                    borderRadius: '50%',
                    bgcolor: index < currentStep ? '#E4F5EC' : '#E9EEF6',
                  }}
                >
                  {index < currentStep ? <FaCheck size={12} /> : step.icon}
                </Box>
                <Box>
                  <Typography fontSize={13} fontWeight={750}>
                    {step.title}
                  </Typography>
                  <Typography fontSize={11} color="text.secondary">
                    Step {index + 1}
                  </Typography>
                </Box>
              </Button>
            ))}
            <Box sx={{ mt: 'auto !important', pt: 5, display: { xs: 'none', md: 'block' } }}>
              <Typography variant="caption" color="text.secondary">
                Progress
              </Typography>
              <LinearProgress
                variant="determinate"
                value={((currentStep + 1) / 3) * 100}
                sx={{ my: 1, height: 4, borderRadius: 2 }}
              />
              <Typography variant="caption" color="text.secondary">
                {currentStep + 1} / 3 steps
              </Typography>
            </Box>
          </Stack>
          <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, overflowY: 'auto', p: { xs: 2, sm: 3 } }}>
            <Stack
              direction="row"
              alignItems="center"
              spacing={1.5}
              sx={{ pb: 2, mb: 2.5, borderBottom: '1px solid #EDF0F5' }}
            >
              <Box
                sx={{
                  p: 1.25,
                  bgcolor: alpha(ACCENT, 0.07),
                  color: ACCENT,
                  borderRadius: 2,
                  display: 'flex',
                }}
              >
                {stepLabels[currentStep].icon}
              </Box>
              <Box>
                <Typography fontWeight={800}>{stepLabels[currentStep].title} Details</Typography>
                <Typography variant="body2" color="text.secondary">
                  {stepLabels[currentStep].caption}
                </Typography>
              </Box>
              <Typography variant="caption" sx={{ ml: 'auto !important', color: TEXT_MUTED }}>
                Step {currentStep + 1} of 3
              </Typography>
            </Stack>
            <Box sx={{ display: currentStep === 0 ? 'block' : 'none' }}>
              <DeliveryDetailsForm />
            </Box>
            <Stack spacing={2.5} sx={{ display: currentStep === 1 ? 'flex' : 'none' }}>
              <OrderDetailsForm skipOrderIdAvailabilityCheck={isEditMode} hidePaymentMode />
              <Box>
                <Typography fontWeight={750} mb={1.25}>
                  Products · {fields.length} item{fields.length === 1 ? '' : 's'}
                </Typography>
                <PackageDetailsForm
                  append={append}
                  control={control}
                  fields={fields}
                  remove={remove}
                />
                {errors.products?.message && (
                  <Typography color="error" variant="caption">
                    {String(errors.products.message)}
                  </Typography>
                )}
              </Box>
              <OptionalChargesForm />
              <PaymentModeSelector />
              <AmountSummaryCard
                subtotal={subtotal}
                totalCollectable={totalCollectable}
                totalOrderValue={totalOrderValue}
                errors={errors as FieldErrors<B2CFormData>}
              />
            </Stack>
            <Stack spacing={3} sx={{ display: currentStep === 2 ? 'flex' : 'none' }}>
              <PackageDimensionsForm />
              <Box sx={{ borderTop: '1px solid #EDF0F5', pt: 2.5 }}>
                <PickupLocationForm />
              </Box>
            </Stack>
          </Box>
        </Stack>
        <Stack
          direction="row"
          spacing={2}
          justifyContent="space-between"
          sx={{
            p: { xs: 1.5, sm: 2 },
            borderTop: '1px solid #E5E9EF',
            bgcolor: '#FAFBFC',
            flexShrink: 0,
          }}
        >
          <Button
            type="button"
            variant="outlined"
            disabled={busy}
            onClick={() => (currentStep ? setCurrentStep((step) => step - 1) : onClose?.())}
            sx={{ minWidth: { xs: 90, sm: 150 }, borderColor: '#DCE3ED', textTransform: 'none' }}
          >
            {currentStep ? 'Back' : 'Cancel'}
          </Button>
          <Button
            type="button"
            variant="contained"
            loading={busy}
            onClick={
              currentStep < 2
                ? nextStep
                : async () => {
                    if (await validateStep())
                      await handleSubmit(onSubmit, (issues) => {
                        setCurrentStep(
                          issues.buyerName ||
                            issues.buyerPhone ||
                            issues.address ||
                            issues.pincode ||
                            issues.city ||
                            issues.state ||
                            issues.country
                            ? 0
                            : issues.orderId ||
                                issues.orderDate ||
                                issues.orderType ||
                                issues.products
                              ? 1
                              : 2,
                        )
                      })()
                  }
            }
            sx={{
              minWidth: { xs: 150, sm: 220 },
              bgcolor: ACCENT,
              textTransform: 'none',
              fontWeight: 750,
              boxShadow: 'none',
            }}
          >
            {currentStep < 2
              ? `Next · ${stepLabels[currentStep + 1].title}`
              : isEditMode
                ? 'Save Changes'
                : 'Create Order'}
          </Button>
        </Stack>
      </Box>
    </FormProvider>
  )
}
