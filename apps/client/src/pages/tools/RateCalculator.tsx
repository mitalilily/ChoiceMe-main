import {
  alpha,
  Box,
  Button,
  CircularProgress,
  Container,
  Grid,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { FaPlane, FaTruck } from 'react-icons/fa'
import { TbScale } from 'react-icons/tb'
import type { Courier } from '../../components/CourierRateCard'
import PublicFooter from '../../components/public/PublicFooter'
import PublicNavbar from '../../components/public/PublicNavbar'
import { useAvailableCouriersMutation } from '../../hooks/Integrations/useCouriers'
import { usePaymentOptions } from '../../hooks/usePaymentOptions'
import { usePincodeLookup } from '../../hooks/User/usePincodeLookup'
import { brand, brandGradients } from '../../theme/brand'
import { defaultLogo } from '../../utils/constants'
import { getCourierDisplayName, getCourierLogo } from '../../utils/courierDisplay'
import { kgToGrams, MIN_B2C_CHARGEABLE_WEIGHT_GRAMS } from '../../utils/weight'

type MovementType = 'forward' | 'return'

type RateCalculatorFormValues = {
  movementType: MovementType
  pickupPincode: string
  pickupCity: string
  pickupState: string
  deliveryPincode: string
  deliveryCity: string
  deliveryState: string
  paymentType: 'prepaid' | 'cod'
  length: string
  breadth: string
  height: string
  weight: string
  orderAmount: string
}

interface RateCalculatorProps {
  publicView?: 'rate' | 'weight'
}

const defaultFormValues: RateCalculatorFormValues = {
  movementType: 'forward',
  pickupPincode: '',
  pickupCity: '',
  pickupState: '',
  deliveryPincode: '',
  deliveryCity: '',
  deliveryState: '',
  paymentType: 'prepaid',
  length: '',
  breadth: '',
  height: '',
  weight: '',
  orderAmount: '',
}

const ui = {
  ink: brand.ink,
  muted: brand.inkSoft,
  accent: brand.accent,
  accentDark: '#D96200',
  success: '#1B9A55',
  line: alpha(brand.ink, 0.1),
  panelShadow: '0 16px 34px rgba(15, 44, 67, 0.08)',
  softAccent: alpha(brand.accent, 0.1),
  softNavy: alpha(brand.ink, 0.055),
}

export const cardStyles = {
  borderRadius: '34px',
  border: `1px solid ${alpha(brand.ink, 0.08)}`,
  background: brandGradients.surface,
  boxShadow: '0 18px 36px rgba(68, 92, 138, 0.1)',
}

const panelSx = {
  borderRadius: '12px',
  border: `1px solid ${ui.line}`,
  background: '#FFFFFF',
  boxShadow: ui.panelShadow,
}

const inputSx = {
  '& .MuiOutlinedInput-root': {
    height: 44,
    borderRadius: '8px',
    backgroundColor: '#FFFFFF',
    fontSize: '0.9rem',
    fontWeight: 600,
    '& fieldset': {
      borderColor: ui.line,
    },
    '&:hover fieldset': {
      borderColor: alpha(ui.accent, 0.48),
    },
    '&.Mui-focused fieldset': {
      borderColor: ui.accent,
      borderWidth: 1.5,
    },
  },
  '& .MuiInputBase-input': {
    px: 1.45,
    py: 1,
    color: ui.ink,
  },
  '& .MuiFormHelperText-root': {
    ml: 0,
    mt: 0.45,
    fontSize: '0.7rem',
    fontWeight: 600,
  },
}

const highlightedInputSx = {
  ...inputSx,
  '& .MuiOutlinedInput-root': {
    ...inputSx['& .MuiOutlinedInput-root'],
    backgroundColor: alpha(brand.sky, 0.46),
  },
}

const formatLocation = (city?: string, state?: string, pincode?: string) => {
  const location = [city, state].filter(Boolean).join(', ')
  return location || pincode || '-'
}

const toNumber = (value: unknown) => {
  const numeric = Number(value ?? 0)
  return Number.isFinite(numeric) ? numeric : 0
}

const formatAmount = (value: number) =>
  value.toLocaleString('en-IN', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })

const formatWeightKg = (value: unknown) => {
  const numeric = toNumber(value)
  if (!numeric) return '-'
  const kg = numeric > 20 ? numeric / 1000 : numeric
  return `${kg.toLocaleString('en-IN', { maximumFractionDigits: 2 })} kg`
}

const getCompactCourierName = (courier: Courier) =>
  getCourierDisplayName(courier).replace(/^Delivery One/i, 'Delhivery')

const getCompactCourierMode = (courier: Courier) => {
  const text = [
    courier.localRates?.forward?.mode,
    courier.name,
    courier.displayName,
    courier.serviceProvider,
    courier.service_provider,
    courier.integration_type,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return text.includes('air') || text.includes('express') ? 'air' : 'surface'
}

const getCompactFreight = (courier: Courier) => {
  const forward = courier.localRates?.forward
  return toNumber(
    courier.rate ??
      courier.seller_freight_charge ??
      courier.final_freight_charge ??
      courier.platform_rate ??
      forward?.rate,
  )
}

const getCompactCod = (courier: Courier) => toNumber(courier.localRates?.forward?.cod_charges)

const getZoneChipLabel = (courier: Courier) => {
  const courierWithZone = courier as Courier & {
    zone?: string | { code?: string | null; name?: string | null } | null
    zone_code?: string | null
    zone_name?: string | null
    pricing_zone?: string | null
    pricingZone?: string | null
    delivery_location?: string | null
  }
  const zone = (courier.approxZone || courierWithZone.zone) as
    | string
    | { code?: string | null; name?: string | null }
    | null
    | undefined
  const pricingZone = String(courierWithZone.pricing_zone || courierWithZone.pricingZone || '').trim()
  const deliveryLocation = String(courierWithZone.delivery_location || '').trim()

  if (typeof zone === 'string') {
    return zone.trim() || pricingZone || deliveryLocation || 'Not returned'
  }

  const code = String(zone?.code || courierWithZone.zone_code || '').trim()
  const name = String(zone?.name || courierWithZone.zone_name || '').trim()

  if (code && name) return `${code} - ${name}`
  if (code || name) return code || name
  if (pricingZone) return pricingZone
  if (deliveryLocation) return deliveryLocation
  if (courier.special_zone) return 'Special Zone'
  return 'Not returned'
}

export function RateCalculator({ publicView }: RateCalculatorProps) {
  const isPublic = Boolean(publicView)
  const { mutateAsync, isPending, isError, error } = useAvailableCouriersMutation()
  const { data: paymentOptions } = usePaymentOptions()
  const [availableCouriers, setAvailableCouriers] = useState<Courier[]>([])

  const methods = useForm<RateCalculatorFormValues>({
    mode: 'onBlur',
    defaultValues: defaultFormValues,
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
  const watchedLength = watch('length')
  const watchedBreadth = watch('breadth')
  const watchedHeight = watch('height')
  const watchedWeight = watch('weight')
  const watchedPaymentType = watch('paymentType')
  const watchedMovementType = watch('movementType')
  const pickupLocationLabel = formatLocation(watch('pickupCity'), watch('pickupState'), pickupPincode)
  const deliveryLocationLabel = formatLocation(
    watch('deliveryCity'),
    watch('deliveryState'),
    deliveryPincode,
  )
  const routeZoneLabel = useMemo(() => {
    if (!availableCouriers.length) return 'Calculate first'

    const returnedZones = availableCouriers
      .map(getZoneChipLabel)
      .filter((label) => label && label !== 'Not returned')
    const uniqueZones = Array.from(new Set(returnedZones))

    if (uniqueZones.length === 1) return uniqueZones[0]
    if (uniqueZones.length > 1) return 'Multiple zones'
    return 'Not returned'
  }, [availableCouriers])

  usePincodeLookup(pickupPincode, 'pickup', setValue, setError, clearErrors)
  usePincodeLookup(deliveryPincode, 'delivery', setValue, setError, clearErrors)

  useEffect(() => {
    if (!paymentOptions) return

    const currentPaymentType = methods.watch('paymentType')
    const currentEnabled =
      (currentPaymentType === 'cod' && paymentOptions.codEnabled) ||
      (currentPaymentType === 'prepaid' && paymentOptions.prepaidEnabled)

    if (currentEnabled) return

    if (paymentOptions.prepaidEnabled) {
      methods.setValue('paymentType', 'prepaid')
    } else if (paymentOptions.codEnabled) {
      methods.setValue('paymentType', 'cod')
    }
  }, [methods, paymentOptions])

  const clientMetrics = useMemo(() => {
    const length = toNumber(watchedLength)
    const breadth = toNumber(watchedBreadth)
    const height = toNumber(watchedHeight)
    const actualWeightGrams = kgToGrams(toNumber(watchedWeight))
    const volumetricWeightGrams = Math.round(((length * breadth * height) / 5000) * 1000)
    const applicableWeightGrams = Math.max(
      actualWeightGrams,
      volumetricWeightGrams,
      MIN_B2C_CHARGEABLE_WEIGHT_GRAMS,
    )

    return {
      volumetricWeightKg: (volumetricWeightGrams / 1000).toFixed(2),
      applicableWeightKg: (applicableWeightGrams / 1000).toFixed(2),
      applicableWeightGrams,
    }
  }, [watchedBreadth, watchedHeight, watchedLength, watchedWeight])

  const onSubmit = async (formData: RateCalculatorFormValues) => {
    try {
      const length = toNumber(formData.length)
      const breadth = toNumber(formData.breadth)
      const height = toNumber(formData.height)
      const orderAmount = toNumber(formData.orderAmount)

      const result = await mutateAsync({
        pickupPincode: formData.pickupPincode,
        deliveryPincode: formData.deliveryPincode,
        weight: clientMetrics.applicableWeightGrams,
        cod: formData.paymentType === 'cod' ? Math.max(orderAmount, 1) : 0,
        length,
        breadth,
        height,
        orderAmount: orderAmount > 0 ? orderAmount : undefined,
        codChargeBasis: Math.max(orderAmount, 0),
        shipmentType: 'b2c',
        payment_type: formData.paymentType,
        context: 'rate_calculator',
        useGuest: isPublic,
      })

      setAvailableCouriers((result ?? []) as Courier[])
    } catch (err) {
      setAvailableCouriers([])
      console.error('Failed fetching couriers:', err)
    }
  }

  const handleReset = () => {
    methods.reset(defaultFormValues)
    setAvailableCouriers([])
  }

  const optionSx = (selected: boolean) => ({
    flex: 1,
    minHeight: 46,
    px: 1.35,
    borderRadius: '8px',
    border: `1.5px solid ${selected ? ui.accent : ui.line}`,
    bgcolor: selected ? ui.softAccent : '#FFFFFF',
    color: selected ? ui.accentDark : ui.ink,
    fontWeight: 800,
    justifyContent: 'flex-start',
    textTransform: 'none',
    boxShadow: selected ? `0 0 0 1px ${alpha(ui.accent, 0.08)}` : 'none',
    '&:hover': {
      borderColor: ui.accent,
      bgcolor: selected ? ui.softAccent : alpha(ui.accent, 0.055),
    },
  })

  const renderRadioDot = (selected: boolean) => (
    <Box
      sx={{
        width: 18,
        height: 18,
        mr: 1,
        borderRadius: '50%',
        border: `1.5px solid ${selected ? ui.accent : alpha(ui.ink, 0.55)}`,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
      }}
    >
      {selected ? <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: ui.accent }} /> : null}
    </Box>
  )

  const renderLocationChip = (label: string) => (
    <Box
      sx={{
        mt: 0.7,
        minHeight: 39,
        px: 1.15,
        py: 0.75,
        borderRadius: '7px',
        bgcolor: alpha(ui.accent, 0.08),
        color: ui.accentDark,
        display: 'flex',
        alignItems: 'center',
        gap: 0.6,
        fontSize: '0.72rem',
        fontWeight: 900,
        lineHeight: 1.25,
      }}
    >
      <Box component="span">{label}</Box>
    </Box>
  )

  const renderMoney = (value: number, color = ui.success, showZero = false) => (
    <Typography sx={{ fontSize: '0.86rem', fontWeight: 900, color, whiteSpace: 'nowrap' }}>
      {value > 0 || showZero ? (
        <>
          <Box component="span">&#8377;</Box>
          {formatAmount(value)}
        </>
      ) : (
        'N/A'
      )}
    </Typography>
  )

  const calculatorPanel = (
    <FormProvider {...methods}>
      <Box
        sx={{
          width: '100%',
          maxWidth: 1180,
          mx: 'auto',
          px: { xs: 0, lg: 0.5 },
          pt: { xs: 1.2, md: 2.1 },
          pb: { xs: 2, md: 2.8 },
          color: ui.ink,
        }}
      >
        <Stack sx={{ mb: 2.15 }}>
          <Box>
            <Typography sx={{ fontSize: '1.32rem', fontWeight: 900, color: ui.ink, lineHeight: 1.1 }}>
              Rate Calculator
            </Typography>
            <Typography sx={{ mt: 0.45, fontSize: '0.95rem', color: ui.muted, fontWeight: 500 }}>
              Calculate shipping rates for your shipments
            </Typography>
          </Box>
        </Stack>

        <Grid container spacing={{ xs: 1.8, lg: 2.4 }}>
          <Grid size={{ xs: 12, lg: 6 }}>
            <Box sx={{ ...panelSx, p: { xs: 2, md: 2.6 }, minHeight: { lg: 655 } }}>
              <Stack spacing={1.95}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box sx={{ color: ui.accent, display: 'flex' }}>
                    <TbScale size={20} />
                  </Box>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 900, color: ui.ink }}>
                    Shipment Details
                  </Typography>
                </Stack>

                <Stack spacing={1}>
                  <Typography sx={{ fontSize: '0.79rem', fontWeight: 900, color: ui.ink }}>
                    Shipment Type
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Button
                      onClick={() => setValue('movementType', 'forward')}
                      sx={optionSx(watchedMovementType === 'forward')}
                    >
                      {renderRadioDot(watchedMovementType === 'forward')}
                      Forward
                    </Button>
                    <Button
                      onClick={() => setValue('movementType', 'return')}
                      sx={optionSx(watchedMovementType === 'return')}
                    >
                      {renderRadioDot(watchedMovementType === 'return')}
                      Return
                    </Button>
                  </Stack>
                </Stack>

                <Grid container spacing={1.1}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography sx={{ mb: 0.75, fontSize: '0.79rem', fontWeight: 900, color: ui.ink }}>
                      Pickup Pincode
                    </Typography>
                    <TextField
                      {...register('pickupPincode', {
                        required: 'Pickup pincode is required',
                        pattern: {
                          value: /^[1-9][0-9]{5}$/,
                          message: 'Enter a valid 6-digit pincode',
                        },
                      })}
                      fullWidth
                      error={!!errors.pickupPincode}
                      helperText={errors.pickupPincode?.message}
                      sx={highlightedInputSx}
                    />
                    {renderLocationChip(pickupLocationLabel)}
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography sx={{ mb: 0.75, fontSize: '0.79rem', fontWeight: 900, color: ui.ink }}>
                      Delivery Pincode
                    </Typography>
                    <TextField
                      {...register('deliveryPincode', {
                        required: 'Delivery pincode is required',
                        pattern: {
                          value: /^[1-9][0-9]{5}$/,
                          message: 'Enter a valid 6-digit pincode',
                        },
                      })}
                      fullWidth
                      error={!!errors.deliveryPincode}
                      helperText={errors.deliveryPincode?.message}
                      sx={inputSx}
                    />
                    {renderLocationChip(deliveryLocationLabel)}
                  </Grid>
                </Grid>

                <Stack spacing={0.7}>
                  <Typography sx={{ fontSize: '0.79rem', fontWeight: 900, color: ui.ink }}>
                    Actual Weight (KG)
                  </Typography>
                  <TextField
                    type="number"
                    {...register('weight', {
                      required: 'Actual weight is required',
                      min: { value: 0.1, message: 'Weight must be greater than 0' },
                    })}
                    fullWidth
                    error={!!errors.weight}
                    helperText={errors.weight?.message || 'Minimum chargeable weight is 0.5kg'}
                    sx={inputSx}
                  />
                </Stack>

                <Stack spacing={0.9}>
                  <Typography sx={{ fontSize: '0.79rem', fontWeight: 900, color: ui.ink }}>
                    Dimensions (cm)
                  </Typography>
                  <Grid container spacing={1.05}>
                    {[
                      { name: 'length' as const, label: 'Length is required' },
                      { name: 'breadth' as const, label: 'Breadth is required' },
                      { name: 'height' as const, label: 'Height is required' },
                    ].map((field) => (
                      <Grid key={field.name} size={{ xs: 12, sm: 4 }}>
                        <TextField
                          type="number"
                          {...register(field.name, {
                            required: field.label,
                            min: { value: 1, message: 'Must be greater than 0' },
                          })}
                          fullWidth
                          error={!!errors[field.name]}
                          helperText={String(errors[field.name]?.message || '')}
                          sx={inputSx}
                        />
                      </Grid>
                    ))}
                  </Grid>
                </Stack>

                <Grid
                  container
                  spacing={1}
                  sx={{
                    p: 1.35,
                    borderRadius: '8px',
                    border: `1px solid ${alpha(ui.accent, 0.16)}`,
                    bgcolor: ui.softAccent,
                  }}
                >
                  <Grid size={{ xs: 6 }}>
                    <Typography sx={{ fontSize: '0.68rem', fontWeight: 900, color: ui.muted }}>
                      Volumetric Weight
                    </Typography>
                    <Typography sx={{ mt: 0.45, fontSize: '0.98rem', fontWeight: 900, color: ui.ink }}>
                      {clientMetrics.volumetricWeightKg} KG
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Typography sx={{ fontSize: '0.68rem', fontWeight: 900, color: ui.muted }}>
                      Applicable Weight
                    </Typography>
                    <Typography sx={{ mt: 0.45, fontSize: '0.98rem', fontWeight: 900, color: ui.accentDark }}>
                      {clientMetrics.applicableWeightKg} KG
                    </Typography>
                  </Grid>
                </Grid>

                <Stack spacing={1}>
                  <Typography sx={{ fontSize: '0.79rem', fontWeight: 900, color: ui.ink }}>
                    Payment Type
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    {(!paymentOptions || paymentOptions.prepaidEnabled) && (
                      <Button
                        onClick={() => setValue('paymentType', 'prepaid')}
                        sx={optionSx(watchedPaymentType === 'prepaid')}
                      >
                        {renderRadioDot(watchedPaymentType === 'prepaid')}
                        Prepaid
                      </Button>
                    )}
                    {(!paymentOptions || paymentOptions.codEnabled) && (
                      <Button
                        onClick={() => setValue('paymentType', 'cod')}
                        sx={optionSx(watchedPaymentType === 'cod')}
                      >
                        {renderRadioDot(watchedPaymentType === 'cod')}
                        COD
                      </Button>
                    )}
                  </Stack>
                </Stack>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.05}>
                  <Button
                    variant="contained"
                    onClick={handleSubmit(onSubmit)}
                    disabled={isPending}
                    sx={{
                      flex: 1,
                      minHeight: 48,
                      borderRadius: '8px',
                      textTransform: 'none',
                      fontWeight: 900,
                      bgcolor: ui.accent,
                      boxShadow: `0 12px 20px ${alpha(ui.accent, 0.26)}`,
                      '&:hover': { bgcolor: ui.accentDark },
                    }}
                  >
                    {isPending ? 'Calculating...' : 'Calculate Rates'}
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={handleReset}
                    sx={{
                      width: { xs: '100%', sm: 88 },
                      minHeight: 48,
                      borderRadius: '8px',
                      textTransform: 'none',
                      fontWeight: 800,
                      color: ui.muted,
                      borderColor: ui.line,
                      bgcolor: '#FFFFFF',
                    }}
                  >
                    Reset
                  </Button>
                </Stack>
              </Stack>
            </Box>
          </Grid>

          <Grid size={{ xs: 12, lg: 6 }}>
            <Box sx={{ ...panelSx, p: { xs: 2, md: 2.6 }, minHeight: { lg: 655 } }}>
              <Stack spacing={2.15}>
                <Box
                  sx={{
                    p: 1.9,
                    borderRadius: '10px',
                    border: `1px solid ${alpha(ui.accent, 0.16)}`,
                    bgcolor: ui.softAccent,
                  }}
                >
                  <Stack>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={0.8}
                        alignItems={{ xs: 'flex-start', sm: 'center' }}
                        justifyContent="space-between"
                        sx={{ mb: 1.3 }}
                      >
                        <Typography sx={{ fontSize: '0.9rem', fontWeight: 900, color: ui.ink }}>
                          Route Information
                        </Typography>
                        <Box
                          title={`Pricing zone: ${routeZoneLabel}`}
                          sx={{
                            px: 0.9,
                            py: 0.45,
                            borderRadius: '999px',
                            bgcolor:
                              routeZoneLabel === 'Calculate first' || routeZoneLabel === 'Not returned'
                                ? alpha(ui.muted, 0.1)
                                : alpha(ui.accent, 0.16),
                            color:
                              routeZoneLabel === 'Calculate first' || routeZoneLabel === 'Not returned'
                                ? ui.muted
                                : ui.accentDark,
                            border: `1px solid ${
                              routeZoneLabel === 'Calculate first' || routeZoneLabel === 'Not returned'
                                ? alpha(ui.muted, 0.18)
                                : alpha(ui.accent, 0.22)
                            }`,
                            fontSize: '0.68rem',
                            fontWeight: 900,
                            lineHeight: 1.15,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Zone: {routeZoneLabel}
                        </Box>
                      </Stack>
                      <Grid container spacing={1}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: ui.muted }}>
                            Pickup
                          </Typography>
                          <Typography sx={{ mt: 0.2, fontSize: '0.82rem', fontWeight: 900, color: ui.ink, lineHeight: 1.25 }}>
                            {pickupLocationLabel}
                          </Typography>
                        </Grid>
                        <Grid
                          size={{ xs: 12, sm: 6 }}
                          sx={{
                            borderLeft: { sm: `1px solid ${alpha(ui.accent, 0.16)}` },
                            pl: { sm: 1.2 },
                          }}
                        >
                          <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: ui.muted }}>
                            Delivery
                          </Typography>
                          <Typography sx={{ mt: 0.2, fontSize: '0.82rem', fontWeight: 900, color: ui.ink, lineHeight: 1.25 }}>
                            {deliveryLocationLabel}
                          </Typography>
                        </Grid>
                      </Grid>
                    </Box>
                  </Stack>
                </Box>

                <Typography sx={{ fontSize: '1rem', fontWeight: 900, color: ui.ink }}>
                  Available Couriers
                </Typography>

                <Box sx={{ overflowX: 'auto' }}>
                  <Box sx={{ minWidth: 590 }}>
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns:
                          'minmax(138px, 1.45fr) 0.5fr 0.65fr 0.68fr 0.58fr 0.52fr',
                        px: 1,
                        pb: 1,
                        color: ui.muted,
                        fontSize: '0.64rem',
                        fontWeight: 900,
                        textTransform: 'uppercase',
                      }}
                    >
                      <Box>Courier</Box>
                      <Box>Mode</Box>
                      <Box>Weight</Box>
                      <Box>Zone</Box>
                      <Box>Rate</Box>
                      <Box>COD</Box>
                    </Box>

                    {isPending ? (
                      <Stack alignItems="center" justifyContent="center" sx={{ py: 5, color: ui.muted }}>
                        <CircularProgress size={22} />
                        <Typography sx={{ mt: 1, fontSize: '0.82rem', fontWeight: 700 }}>
                          Loading available couriers...
                        </Typography>
                      </Stack>
                    ) : availableCouriers.length ? (
                      <Stack spacing={1}>
                        {availableCouriers.map((courier, index) => {
                          const displayName = getCompactCourierName(courier)
                          const mode = getCompactCourierMode(courier)
                          const zoneLabel = getZoneChipLabel(courier)
                          const logo = getCourierLogo(courier, defaultLogo)
                          const isDelhivery =
                            displayName.toLowerCase().includes('delhivery') ||
                            displayName.toLowerCase().includes('delivery')
                          const freight = getCompactFreight(courier)
                          const cod = getCompactCod(courier)

                          return (
                            <Box
                              key={courier.id || `${displayName}-${index}`}
                              sx={{
                                display: 'grid',
                                gridTemplateColumns:
                                  'minmax(138px, 1.45fr) 0.5fr 0.65fr 0.68fr 0.58fr 0.52fr',
                                alignItems: 'center',
                                minHeight: 62,
                                px: 1,
                                bgcolor: '#F5F6F8',
                                borderBottom: `1px solid ${alpha(ui.ink, 0.04)}`,
                              }}
                            >
                              <Stack direction="row" alignItems="center" spacing={1.1} sx={{ minWidth: 0 }}>
                                <Box
                                  sx={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: '8px',
                                    bgcolor: isDelhivery ? '#5F6266' : '#FFFFFF',
                                    color: '#FFFFFF',
                                    display: 'grid',
                                    placeItems: 'center',
                                    fontSize: '0.62rem',
                                    fontWeight: 900,
                                    overflow: 'hidden',
                                    flexShrink: 0,
                                  }}
                                >
                                  {isDelhivery || !logo || logo === defaultLogo ? (
                                    'DEL'
                                  ) : (
                                    <Box
                                      component="img"
                                      src={logo}
                                      alt={displayName}
                                      sx={{ width: '100%', height: '100%', objectFit: 'contain', p: 0.35 }}
                                    />
                                  )}
                                </Box>
                                <Stack spacing={0.35} sx={{ minWidth: 0 }}>
                                  <Typography noWrap sx={{ fontSize: '0.82rem', fontWeight: 800, color: '#273044' }}>
                                    {displayName}
                                  </Typography>
                                </Stack>
                              </Stack>
                              <Box sx={{ color: mode === 'air' ? ui.accentDark : '#68707E', display: 'flex' }}>
                                {mode === 'air' ? <FaPlane size={18} /> : <FaTruck size={18} />}
                              </Box>
                              <Typography sx={{ fontSize: '0.82rem', fontWeight: 800, color: '#273044' }}>
                                {formatWeightKg(courier.chargeable_weight)}
                              </Typography>
                              <Box
                                title={`Pricing zone: ${zoneLabel}`}
                                sx={{
                                  justifySelf: 'start',
                                  maxWidth: 82,
                                  px: 0.7,
                                  py: 0.35,
                                  borderRadius: '999px',
                                  bgcolor:
                                    zoneLabel === 'Not returned'
                                      ? alpha(ui.muted, 0.1)
                                      : alpha(ui.accent, 0.14),
                                  color: zoneLabel === 'Not returned' ? ui.muted : ui.accentDark,
                                  border: `1px solid ${
                                    zoneLabel === 'Not returned'
                                      ? alpha(ui.muted, 0.18)
                                      : alpha(ui.accent, 0.2)
                                  }`,
                                  fontSize: '0.62rem',
                                  fontWeight: 900,
                                  lineHeight: 1.15,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {zoneLabel}
                              </Box>
                              {renderMoney(freight)}
                              {renderMoney(cod, '#606570', true)}
                            </Box>
                          )
                        })}
                      </Stack>
                    ) : (
                      <Box
                        sx={{
                          minHeight: 190,
                          borderRadius: '8px',
                          border: `1px dashed ${alpha(ui.accent, 0.24)}`,
                          display: 'grid',
                          placeItems: 'center',
                          textAlign: 'center',
                          color: ui.muted,
                          px: 2,
                        }}
                      >
                        <Typography sx={{ fontSize: '0.86rem', fontWeight: 700 }}>
                          Enter shipment details and calculate to see courier rates.
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Box>

                {isError ? (
                  <Typography sx={{ color: brand.danger, fontSize: '0.82rem', fontWeight: 700 }}>
                    Failed to fetch couriers: {error?.message ?? 'Unknown error'}
                  </Typography>
                ) : null}
              </Stack>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </FormProvider>
  )

  if (!isPublic) return calculatorPanel

  return (
    <Box>
      <PublicNavbar />
      <Container maxWidth={false} sx={{ px: { xs: 2, sm: 3 }, pb: 8 }}>
        {calculatorPanel}
      </Container>
      <PublicFooter />
    </Box>
  )
}

export default RateCalculator
