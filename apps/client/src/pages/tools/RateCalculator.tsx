import {
  alpha,
  Box,
  CircularProgress,
  Container,
  Divider,
  Grid,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { useEffect, useRef, useState } from 'react'
import { Controller, FormProvider, useForm } from 'react-hook-form'
import { BiRupee } from 'react-icons/bi'
import { TbCalculator, TbScale } from 'react-icons/tb'
import CourierRateCards from '../../components/CourierRateCard'
import BrandSurface from '../../components/brand/BrandSurface'
import PublicFooter from '../../components/public/PublicFooter'
import PublicNavbar from '../../components/public/PublicNavbar'
import B2BRateCalculator from '../../components/tools/B2BRateCalculator'
import B2CRateCalculator from '../../components/tools/B2CRateCalculator'
import CustomIconLoadingButton from '../../components/UI/button/CustomLoadingButton'
import PageHeading from '../../components/UI/heading/PageHeading'
import CustomInput from '../../components/UI/inputs/CustomInput'
import { SmartTabs } from '../../components/UI/tab/Tabs'
import { useAvailableCouriersMutation } from '../../hooks/Integrations/useCouriers'
import { usePaymentOptions } from '../../hooks/usePaymentOptions'
import { usePincodeLookup } from '../../hooks/User/usePincodeLookup'
import { brand, brandGradients } from '../../theme/brand'
import { defaultLogo } from '../../utils/constants'

type ShipmentType = 'b2b' | 'b2c'

interface RateCalculatorProps {
  publicView?: 'rate' | 'weight'
}

const termsAndConditions = {
  b2c: [
    'Above shared commercials are exclusive of GST.',
    'Pricing is subject to courier updates or revised commercial terms.',
    'Chargeable weight is whichever is higher between actual and volumetric weight.',
    'Return charges may mirror forward charges where special RTO pricing is not shared.',
    'Fixed COD charge or COD percentage applies, whichever is higher.',
    'Additional charges such as address correction or handling may apply.',
  ],
  b2b: [
    'Above shared commercials are exclusive of GST.',
    'Pricing is subject to courier updates or revised commercial terms.',
    'Chargeable weight is whichever is higher between actual and volumetric weight.',
    'Additional charges such as address correction or handling may apply.',
    'Prohibited items should not be shipped through the platform.',
    'Delhivery B2B volumetric formula: (L x B x H / 27000) x CFT.',
  ],
}

export const cardStyles = {
  borderRadius: '34px',
  border: `1px solid ${alpha(brand.ink, 0.08)}`,
  background: brandGradients.surface,
  boxShadow: '0 18px 36px rgba(68, 92, 138, 0.1)',
}

export function RateCalculator({ publicView }: RateCalculatorProps) {
  const { mutateAsync, isPending, isError, error } = useAvailableCouriersMutation()
  const couriersRef = useRef<HTMLDivElement | null>(null)
  const [shipmentType, setShipmentType] = useState<ShipmentType>('b2c')
  const [availableCouriers, setAvailableCouriers] = useState<any[]>([])
  const { data: paymentOptions } = usePaymentOptions()
  const isPublic = Boolean(publicView)
  const heading =
    publicView === 'weight'
      ? {
          eyebrow: 'Weight Calculator',
          title: 'Volumetric and chargeable weight made simple.',
          subtitle:
            'Use the same live courier-lookup logic while focusing on dimensions, applicable weight, and shipment economics.',
          icon: <TbScale size={18} />,
        }
      : {
          eyebrow: isPublic ? 'Rate Calculator' : 'Tools Panel',
          title: 'Compare shipping prices and courier availability instantly.',
          subtitle:
            'Estimate charges, compare courier availability, and validate shipment economics in a cleaner utility panel without changing the current calculator logic.',
          icon: <TbCalculator size={18} />,
        }

  const methods = useForm({
    mode: 'onBlur',
    defaultValues: {
      pickupPincode: '',
      pickupCity: '',
      pickupState: '',
      deliveryPincode: '',
      deliveryCity: '',
      deliveryState: '',
      paymentType: 'cod',
      length: '',
      breadth: '',
      height: '',
      weight: '',
      totalWeight: '',
      numberOfBoxes: '',
      orderAmount: '',
    },
  })

  const {
    watch,
    setValue,
    setError,
    clearErrors,
    register,
    handleSubmit,
    formState: { errors },
  } = methods

  const pickupPincode = watch('pickupPincode')
  const deliveryPincode = watch('deliveryPincode')

  const loadingPickup = usePincodeLookup(pickupPincode, 'pickup', setValue, setError, clearErrors)
  const loadingDelivery = usePincodeLookup(
    deliveryPincode,
    'delivery',
    setValue,
    setError,
    clearErrors,
  )

  const onSubmit = async (formData: any) => {
    try {
      const length = Number(formData.length) || 0
      const breadth = Number(formData.breadth) || 0
      const height = Number(formData.height) || 0
      const actualWeightKg = Number(formData.weight) || 0
      const volumetricWeightGrams = ((length * breadth * height) / 5000) * 1000
      const actualWeightGrams = actualWeightKg * 1000
      const applicableWeightGrams = Math.max(actualWeightGrams, volumetricWeightGrams, 500)
      const orderAmountValue = Number(formData.orderAmount || 0)

      const payload = {
        pickupPincode: formData.pickupPincode,
        deliveryPincode: formData.deliveryPincode,
        weight: applicableWeightGrams,
        cod: formData.paymentType === 'cod' ? Math.max(orderAmountValue, 1) : 0,
        length,
        breadth,
        height,
        orderAmount: orderAmountValue > 0 ? orderAmountValue : undefined,
        codChargeBasis: Math.max(orderAmountValue, 0),
        shipmentType,
        payment_type: formData.paymentType,
        context: 'rate_calculator',
      }

      const result = await mutateAsync(payload)
      setAvailableCouriers(result ?? [])
    } catch (err) {
      setAvailableCouriers([])
      console.error('Failed fetching couriers:', err)
    }
  }

  useEffect(() => {
    if (availableCouriers?.length > 0 && couriersRef.current) {
      couriersRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [availableCouriers])

  useEffect(() => {
    setAvailableCouriers([])
  }, [shipmentType])

  useEffect(() => {
    if (paymentOptions) {
      const currentPaymentType = methods.watch('paymentType')
      const isCurrentEnabled =
        (currentPaymentType === 'cod' && paymentOptions.codEnabled) ||
        (currentPaymentType === 'prepaid' && paymentOptions.prepaidEnabled)

      if (!isCurrentEnabled) {
        if (paymentOptions.codEnabled) {
          methods.setValue('paymentType', 'cod')
        } else if (paymentOptions.prepaidEnabled) {
          methods.setValue('paymentType', 'prepaid')
        }
      }
    }
  }, [paymentOptions, methods])

  const shell = (
    <Stack spacing={3.2}>
      <PageHeading
        eyebrow={heading.eyebrow}
        title={heading.title}
        subtitle={heading.subtitle}
        icon={heading.icon}
      />

      {isPublic ? (
        <BrandSurface
          variant="hero"
          sx={{
            p: { xs: 2.4, md: 3 },
            background: `
              radial-gradient(circle at 100% 0%, rgba(255, 156, 75, 0.18), transparent 24%),
              ${brandGradients.analytics}
            `,
          }}
        >
          <Grid container spacing={1.6}>
            {[
              {
                label: publicView === 'weight' ? 'Chargeable focus' : 'Rate intelligence',
                value: publicView === 'weight' ? '500g minimum' : 'Live courier matrix',
              },
              {
                label: 'Logic preserved',
                value: 'Same hooks and payloads',
              },
              {
                label: 'Seller ready',
                value: 'B2C and B2B supported',
              },
            ].map((item) => (
              <Grid key={item.label} size={{ xs: 12, md: 4 }}>
                <BrandSurface variant="glass" sx={{ p: 1.8, borderRadius: '24px' }}>
                  <Typography sx={{ color: brand.inkSoft, fontSize: '0.8rem', fontWeight: 700 }}>
                    {item.label}
                  </Typography>
                  <Typography sx={{ mt: 0.7, color: brand.ink, fontWeight: 800, fontSize: '1.05rem' }}>
                    {item.value}
                  </Typography>
                </BrandSurface>
              </Grid>
            ))}
          </Grid>
        </BrandSurface>
      ) : null}

      <FormProvider {...methods}>
        <BrandSurface variant="card" sx={{ p: { xs: 2.2, md: 2.8 }, ...cardStyles }}>
          <Stack spacing={2.5}>
            <Stack spacing={0.9}>
              <Typography sx={{ color: brand.ink, fontSize: '1.35rem', fontWeight: 800 }}>
                Shipment Details
              </Typography>
              <Typography sx={{ color: brand.inkSoft, lineHeight: 1.72 }}>
                Enter origin, destination, shipment measurements, and payment mode to fetch available couriers.
              </Typography>
            </Stack>

            <SmartTabs
              value={shipmentType}
              onChange={(value) => setShipmentType(value)}
              tabs={[
                { label: 'B2C', value: 'b2c' },
                { label: 'B2B', value: 'b2b' },
              ]}
            />

            <Divider sx={{ borderColor: alpha(brand.ink, 0.08) }} />

            <Grid container spacing={1.6}>
              <Grid size={{ xs: 12, md: 4 }}>
                <CustomInput
                  label="Pickup Pincode"
                  {...register('pickupPincode', {
                    required: 'Pickup pincode is required',
                    pattern: {
                      value: /^[1-9][0-9]{5}$/,
                      message: 'Enter a valid 6-digit pincode',
                    },
                  })}
                  error={!!errors.pickupPincode}
                  helperText={errors.pickupPincode?.message as string}
                  fullWidth
                  topMargin={false}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <CustomInput
                  label="Pickup City"
                  {...register('pickupCity')}
                  fullWidth
                  disabled
                  topMargin={false}
                  postfix={loadingPickup ? <CircularProgress size={16} /> : null}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <CustomInput
                  label="Pickup State"
                  {...register('pickupState')}
                  fullWidth
                  disabled
                  topMargin={false}
                  postfix={loadingPickup ? <CircularProgress size={16} /> : null}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <CustomInput
                  label="Delivery Pincode"
                  {...register('deliveryPincode', {
                    required: 'Delivery pincode is required',
                    pattern: {
                      value: /^[1-9][0-9]{5}$/,
                      message: 'Enter a valid 6-digit pincode',
                    },
                  })}
                  error={!!errors.deliveryPincode}
                  helperText={errors.deliveryPincode?.message as string}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <CustomInput
                  label="Delivery City"
                  {...register('deliveryCity')}
                  fullWidth
                  disabled
                  postfix={loadingDelivery ? <CircularProgress size={16} /> : null}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <CustomInput
                  label="Delivery State"
                  {...register('deliveryState')}
                  fullWidth
                  disabled
                  postfix={loadingDelivery ? <CircularProgress size={16} /> : null}
                />
              </Grid>
            </Grid>

            <Divider sx={{ borderColor: alpha(brand.ink, 0.08) }} />

            {shipmentType === 'b2c' ? <B2CRateCalculator /> : <B2BRateCalculator />}

            <Divider sx={{ borderColor: alpha(brand.ink, 0.08) }} />

            <Controller
              name="paymentType"
              control={methods.control}
              rules={{ required: 'Please select a payment type' }}
              render={({ field, fieldState }) => (
                <Stack spacing={1.2}>
                  <Typography sx={{ color: brand.ink, fontWeight: 700 }}>Payment Type</Typography>
                  <ToggleButtonGroup
                    value={field.value}
                    exclusive
                    onChange={(_, newValue) => {
                      if (newValue !== null) field.onChange(newValue)
                    }}
                  >
                    {(!paymentOptions || paymentOptions.prepaidEnabled) && (
                      <ToggleButton
                        value="prepaid"
                        sx={{
                          px: 3,
                          py: 1,
                          borderRadius: '999px !important',
                          border: `1px solid ${alpha(brand.ink, 0.12)}`,
                          textTransform: 'none',
                          fontWeight: 700,
                          color: brand.inkSoft,
                          '&.Mui-selected': {
                            background: brandGradients.button,
                            color: '#FFFFFF',
                          },
                        }}
                      >
                        Prepaid
                      </ToggleButton>
                    )}
                    {(!paymentOptions || paymentOptions.codEnabled) && (
                      <ToggleButton
                        value="cod"
                        sx={{
                          px: 3,
                          py: 1,
                          borderRadius: '999px !important',
                          border: `1px solid ${alpha(brand.ink, 0.12)}`,
                          textTransform: 'none',
                          fontWeight: 700,
                          color: brand.inkSoft,
                          '&.Mui-selected': {
                            background: brandGradients.button,
                            color: '#FFFFFF',
                          },
                        }}
                      >
                        COD
                      </ToggleButton>
                    )}
                  </ToggleButtonGroup>
                  {fieldState?.error ? (
                    <Typography sx={{ color: brand.danger, fontSize: '0.82rem' }}>
                      {fieldState.error.message}
                    </Typography>
                  ) : null}
                </Stack>
              )}
            />

            <Grid container spacing={1.6}>
              <Grid size={{ xs: 12, md: 4 }}>
                <CustomInput
                  label="Order Amount"
                  type="number"
                  placeholder="Enter shipment value"
                  {...register('orderAmount', {
                    required: 'Order amount is required',
                    min: { value: 1, message: 'Order amount must be at least 1' },
                  })}
                  error={!!errors.orderAmount}
                  helperText={errors.orderAmount?.message as string}
                  fullWidth
                  prefix={<BiRupee />}
                />
              </Grid>
            </Grid>

            <CustomIconLoadingButton
              onClick={handleSubmit(onSubmit)}
              text={publicView === 'weight' ? 'Calculate Weight And Rates' : 'Calculate Shipping Rate'}
              loading={isPending}
              loadingText="Calculating..."
              styles={{
                width: '100%',
                py: 1.5,
                borderRadius: 999,
                background: brandGradients.button,
                color: '#FFFFFF',
                fontWeight: 800,
                boxShadow: '0 18px 36px rgba(255, 122, 21, 0.28)',
              }}
            />
          </Stack>
        </BrandSurface>
      </FormProvider>

      <Box ref={couriersRef}>
        {isPending ? (
          <Typography sx={{ color: brand.inkSoft, textAlign: 'center', py: 1 }}>
            Loading available couriers...
          </Typography>
        ) : null}

        {isError ? (
          <Typography sx={{ color: brand.danger, textAlign: 'center', py: 1 }}>
            Failed to fetch couriers: {error?.message ?? 'Unknown error'}
          </Typography>
        ) : (
          <CourierRateCards
            shipmentType={watch('paymentType')}
            availableCouriers={availableCouriers}
            defaultLogo={defaultLogo}
          />
        )}
      </Box>

      <BrandSurface variant="soft" sx={{ p: { xs: 2.2, md: 2.6 }, borderRadius: '32px' }}>
        <Typography sx={{ color: brand.ink, fontWeight: 800, fontSize: '1.15rem' }}>
          Terms & Conditions ({shipmentType.toUpperCase()})
        </Typography>
        <Stack spacing={1} sx={{ mt: 1.5 }}>
          {termsAndConditions[shipmentType].map((term) => (
            <Typography key={term} sx={{ color: brand.inkSoft, lineHeight: 1.72 }}>
              • {term}
            </Typography>
          ))}
        </Stack>
      </BrandSurface>
    </Stack>
  )

  if (!isPublic) return shell

  return (
    <Box>
      <PublicNavbar />
      <Container maxWidth="xl" sx={{ px: { xs: 2, sm: 3 }, pb: 8 }}>
        <Box sx={{ pt: { xs: 1.5, md: 3 } }}>{shell}</Box>
      </Container>
      <PublicFooter />
    </Box>
  )
}

export default RateCalculator
