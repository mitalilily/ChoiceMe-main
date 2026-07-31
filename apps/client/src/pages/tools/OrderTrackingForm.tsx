'use client'

import {
  alpha,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  FormHelperText,
  Grid,
  Stack,
  Typography,
} from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { useSearchParams } from 'react-router-dom'
import {
  FaBoxOpen,
  FaEnvelopeOpenText,
  FaHashtag,
  FaPhoneAlt,
  FaReceipt,
  FaSearch,
} from 'react-icons/fa'
import type { TrackingHistory } from '../../api/tracking.service'
import CustomInput from '../../components/UI/inputs/CustomInput'
import { useTracking } from '../../hooks/Orders/useTracking'
import { brand, brandGradients } from '../../theme/brand'
import { getCourierDisplayName } from '../../utils/courierDisplay'

type FormValues = {
  awb: string
  orderNumber: string
  contact: string
}

const trackingStatusLabelMap: Record<string, string> = {
  pending: 'Pending',
  booked: 'Booked',
  manifest_generated: 'Manifest Generated',
  shipment_created: 'Shipment Created',
  pickup_initiated: 'Scheduled for Pickup',
  in_transit: 'In Transit',
  out_for_delivery: 'Out For Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  canceled: 'Cancelled',
  ndr: 'NDR',
  rto: 'RTO Initiated',
  rto_in_transit: 'RTO In Transit',
  rto_delivered: 'RTO Delivered',
  cancellation_requested: 'Cancellation Requested',
  rto_initiated: 'RTO Initiated',
}

const normalizeTrackingStatus = (status?: string | null) =>
  String(status || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')

const formatTrackingStatus = (status?: string | null) => {
  const normalized = normalizeTrackingStatus(status)
  return trackingStatusLabelMap[normalized] || status || 'Unknown'
}

const formatTrackingDate = (value?: string | null) => {
  if (!value) return 'N/A'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'N/A'

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(date)
}

const formatTrackingTime = (value?: string | null) => {
  if (!value) return 'N/A'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'N/A'

  return new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  }).format(date)
}

const getTrackingTone = (status?: string | null) => {
  const normalized = normalizeTrackingStatus(status)
  if (normalized.includes('deliver')) return { bg: alpha('#16a34a', 0.12), fg: '#166534' }
  if (normalized.includes('transit')) return { bg: alpha('#0284c7', 0.12), fg: '#075985' }
  if (normalized.includes('cancel') || normalized.includes('failed'))
    return { bg: alpha('#dc2626', 0.12), fg: '#991B1B' }
  if (normalized.includes('rto') || normalized.includes('ndr'))
    return { bg: alpha('#d97706', 0.12), fg: '#92400E' }

  return { bg: alpha(brand.ink, 0.08), fg: brand.ink }
}

const trackingHeroSx = {
  position: 'relative',
  overflow: 'hidden',
  borderRadius: '10px',
  border: `1px solid ${alpha(brand.ink, 0.08)}`,
  background: `
    radial-gradient(circle at 100% 0%, ${alpha(brand.accent, 0.08)} 0%, transparent 28%),
    linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(248,250,254,0.98) 100%)
  `,
  boxShadow: '0 12px 28px rgba(68, 92, 138, 0.09)',
  p: { xs: 1.25, sm: 1.45, md: 1.6 },
}

const compactSurfaceSx = {
  borderRadius: '8px',
  border: `1px solid ${alpha(brand.ink, 0.08)}`,
  background: 'rgba(255,255,255,0.92)',
  boxShadow: '0 10px 22px rgba(68, 92, 138, 0.07)',
}

const modeButtonSx = (active: boolean) => ({
  minHeight: 32,
  px: 1.25,
  borderRadius: '8px',
  border: `1px solid ${active ? alpha(brand.accent, 0.38) : alpha(brand.ink, 0.08)}`,
  bgcolor: active ? alpha(brand.accent, 0.12) : '#FFFFFF',
  color: active ? brand.ink : brand.inkSoft,
  boxShadow: active ? '0 10px 20px rgba(255, 122, 21, 0.12)' : 'none',
  fontSize: '0.8rem',
  fontWeight: 800,
  whiteSpace: 'nowrap',
  textTransform: 'none',
  '&:hover': {
    bgcolor: active ? alpha(brand.accent, 0.16) : alpha(brand.ink, 0.04),
    borderColor: active ? alpha(brand.accent, 0.45) : alpha(brand.ink, 0.12),
  },
})

export default function OrderTrackingForm() {
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const trackingQuery = searchParams.toString()
  const [mode, setMode] = useState<'awb' | 'order'>('awb')
  const [error, setError] = useState<string>('')
  const [queryParams, setQueryParams] = useState<{
    awb?: string
    orderNumber?: string
    contact?: string
  } | null>(null)

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      awb: '',
      orderNumber: '',
      contact: '',
    },
  })

  const formValues = watch()

  useEffect(() => {
    if (!trackingQuery) {
      reset({ awb: '', orderNumber: '', contact: '' })
      setQueryParams(null)
      return
    }

    const routeParams = new URLSearchParams(trackingQuery)
    const awb = routeParams.get('awb')?.trim()
    const orderNumber =
      routeParams.get('orderNumber')?.trim() || routeParams.get('order')?.trim()
    const contact = routeParams.get('contact')?.trim()

    if (awb) {
      setMode('awb')
      reset({ awb, orderNumber: '', contact: '' })
      setQueryParams({ awb })
      return
    }

    if (orderNumber && contact) {
      setMode('order')
      reset({ awb: '', orderNumber, contact })
      setQueryParams({ orderNumber, contact })
    }
  }, [reset, trackingQuery])

  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formValues.contact)
  const isPhone = /^[0-9+\-\s()]{7,}$/.test(formValues.contact)
  const isContactValid = !formValues.contact || isEmail || isPhone

  const {
    data: tracking,
    isFetching: trackingLoading,
    isError: trackingError,
    error: trackingErrorObj,
    isSuccess,
  } = useTracking(
    queryParams?.awb ?? null,
    queryParams?.orderNumber ?? null,
    queryParams?.contact ?? null,
  )

  useEffect(() => {
    if (trackingError) {
      setError(
        trackingErrorObj instanceof Error ? trackingErrorObj.message : 'Failed to fetch tracking',
      )
    } else if (isSuccess) {
      setError('')
      queryClient.invalidateQueries({ queryKey: ['b2cOrdersByUser'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    }
  }, [trackingError, trackingErrorObj, isSuccess, queryClient])

  const canSubmit =
    mode === 'awb'
      ? formValues.awb.trim().length > 3
      : formValues.orderNumber.trim().length > 2 &&
        formValues.contact.trim().length > 3 &&
        isContactValid

  const onSubmit = (data: FormValues) => {
    if (!canSubmit) return
    setError('')

    if (mode === 'awb') {
      setQueryParams({ awb: data.awb.trim() })
    } else {
      setQueryParams({
        orderNumber: data.orderNumber.trim(),
        contact: data.contact.trim(),
      })
    }
  }

  const sortedHistory = useMemo<TrackingHistory[]>(() => {
    if (!tracking?.history) return []
    return [...tracking.history].sort(
      (a, b) => new Date(b.event_time).getTime() - new Date(a.event_time).getTime(),
    )
  }, [tracking])

  const resetResults = () => {
    setQueryParams(null)
    setError('')
  }

  const selectMode = (nextMode: 'awb' | 'order') => {
    if (nextMode === mode) return
    setMode(nextMode)
    reset()
    setError('')
    resetResults()
  }

  const actionButtons = (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1}
      alignItems={{ xs: 'stretch', sm: 'center' }}
      sx={{ width: '100%' }}
    >
      <Button
        type="submit"
        variant="contained"
        color="primary"
        startIcon={trackingLoading ? <CircularProgress size={18} /> : <FaSearch />}
        disabled={!canSubmit || trackingLoading}
        sx={{
          minHeight: 40,
          px: 2,
          borderRadius: '8px',
          fontWeight: 800,
          textTransform: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        {trackingLoading ? 'Tracking...' : 'Track Order'}
      </Button>
      <Button
        type="button"
        variant="text"
        color="inherit"
        onClick={() => {
          reset()
          resetResults()
        }}
        sx={{
          minHeight: 40,
          borderRadius: '8px',
          fontWeight: 800,
          textTransform: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        Reset
      </Button>
    </Stack>
  )

  return (
    <Stack spacing={1.4} sx={{ py: { xs: 0.9, md: 1.2 } }}>
      <Box sx={trackingHeroSx}>
        <Grid container spacing={{ xs: 1.2, md: 1.45 }} alignItems="stretch">
          <Grid size={{ xs: 12, md: 4 }}>
            <Stack
              spacing={0.85}
              sx={{ height: '100%', justifyContent: 'center', pr: { md: 0.8 } }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <Box
                  sx={{
                    width: 34,
                    height: 34,
                    borderRadius: '9px',
                    background: brandGradients.button,
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 10px 18px rgba(255, 122, 21, 0.18)',
                  }}
                >
                  <FaBoxOpen size={15} />
                </Box>
                <Stack spacing={0.2}>
                  <Typography
                    sx={{
                      color: brand.inkSoft,
                      fontSize: '0.64rem',
                      fontWeight: 800,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Tools Panel
                  </Typography>
                  <Typography
                    sx={{
                      color: brand.ink,
                      fontSize: { xs: '1.35rem', md: '1.55rem' },
                      fontWeight: 900,
                      lineHeight: 1.04,
                    }}
                  >
                    Track Order
                  </Typography>
                </Stack>
              </Stack>
              <Typography
                sx={{
                  color: brand.inkSoft,
                  fontSize: { xs: '0.84rem', md: '0.87rem' },
                  lineHeight: 1.48,
                  maxWidth: 430,
                }}
              >
                Track by AWB or order details, review shipment timelines, and keep the utility view
                aligned with the rest of the panel.
              </Typography>
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, md: 8 }}>
            <Box
              component="form"
              onSubmit={handleSubmit(onSubmit)}
              sx={{ ...compactSurfaceSx, p: { xs: 1.2, sm: 1.35 } }}
            >
              <Stack spacing={1.05}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={0.9}
                  justifyContent="space-between"
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                >
                  <Box>
                    <Typography sx={{ color: brand.ink, fontSize: '1rem', fontWeight: 800 }}>
                      Track Your <Box component="span" sx={{ color: brand.accent }}>Order</Box>
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 0.15, fontSize: '0.84rem', lineHeight: 1.45 }}
                    >
                      Enter your AWB number or order details to track shipment.
                    </Typography>
                  </Box>
                  <Stack
                    direction="row"
                    spacing={0.55}
                    sx={{
                      p: 0.35,
                      borderRadius: '9px',
                      width: { xs: '100%', sm: 'auto' },
                      flexWrap: 'wrap',
                      bgcolor: alpha(brand.ink, 0.035),
                      border: `1px solid ${alpha(brand.ink, 0.06)}`,
                      '& .MuiButton-root': {
                        flex: { xs: '1 1 120px', sm: '0 0 auto' },
                      },
                    }}
                  >
                    <Button
                      type="button"
                      onClick={() => selectMode('awb')}
                      sx={modeButtonSx(mode === 'awb')}
                    >
                      Track By AWB
                    </Button>
                    <Button
                      type="button"
                      onClick={() => selectMode('order')}
                      sx={modeButtonSx(mode === 'order')}
                    >
                      Track By Order ID
                    </Button>
                  </Stack>
                </Stack>

                {mode === 'awb' ? (
                  <Grid container spacing={1.05} alignItems="flex-end">
                    <Grid size={{ xs: 12, md: 8.4 }}>
                      <FormControl fullWidth sx={{ mb: 0 }}>
                        <Controller
                          name="awb"
                          control={control}
                          render={({ field }) => (
                            <CustomInput
                              {...field}
                              id="awb"
                              placeholder="e.g. 1234567890"
                              prefix={<FaHashtag />}
                              error={!!errors.awb}
                              label="AWB Number"
                              topMargin={false}
                            />
                          )}
                          rules={{ required: 'AWB number is required' }}
                        />
                        {errors.awb && <FormHelperText error>{errors.awb.message}</FormHelperText>}
                      </FormControl>
                    </Grid>
                    <Grid size={{ xs: 12, md: 3.6 }}>
                      {actionButtons}
                    </Grid>
                  </Grid>
                ) : (
                  <Grid container spacing={1.05} alignItems="flex-end">
                    <Grid size={{ xs: 12, md: 4.5 }}>
                      <FormControl fullWidth sx={{ mb: 0 }}>
                        <Controller
                          name="orderNumber"
                          control={control}
                          render={({ field }) => (
                            <CustomInput
                              {...field}
                              id="orderNumber"
                              placeholder="e.g. ORD-2025-0001"
                              prefix={<FaReceipt />}
                              error={!!errors.orderNumber}
                              label="Order ID"
                              topMargin={false}
                            />
                          )}
                          rules={{ required: 'Order ID is required' }}
                        />
                        {errors.orderNumber && (
                          <FormHelperText error>{errors.orderNumber.message}</FormHelperText>
                        )}
                      </FormControl>
                    </Grid>

                    <Grid size={{ xs: 12, md: 4.5 }}>
                      <FormControl fullWidth sx={{ mb: 0 }}>
                        <Controller
                          name="contact"
                          control={control}
                          render={({ field }) => (
                            <CustomInput
                              {...field}
                              id="contact"
                              placeholder="you@example.com or +91 98765 43210"
                              prefix={isEmail ? <FaEnvelopeOpenText /> : <FaPhoneAlt />}
                              error={!isContactValid}
                              label="Email or Phone"
                              topMargin={false}
                            />
                          )}
                          rules={{ required: 'Email or Phone is required' }}
                        />
                        {!isContactValid && (
                          <FormHelperText error>Enter a valid email or phone number</FormHelperText>
                        )}
                      </FormControl>
                    </Grid>
                    <Grid size={{ xs: 12, md: 3 }}>
                      {actionButtons}
                    </Grid>
                  </Grid>
                )}

                {error && (
                  <Typography color="error" variant="body2">
                    {error}
                  </Typography>
                )}

              </Stack>
            </Box>
          </Grid>
        </Grid>
      </Box>

      {isSuccess && tracking && queryParams && (
        <Stack spacing={2.2}>
          <Card sx={compactSurfaceSx}>
            <CardContent sx={{ p: { xs: 1.8, md: 2.2 }, '&:last-child': { pb: { xs: 1.8, md: 2.2 } } }}>
              <Typography variant="h6" fontWeight={700} gutterBottom>
                Shipment Overview
              </Typography>
              <Grid container spacing={1.6}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    AWB Number
                  </Typography>
                  <Typography fontWeight={600}>{tracking.awb_number || '—'}</Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Order Number
                  </Typography>
                  <Typography fontWeight={600}>{tracking.order_number || '—'}</Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Courier
                  </Typography>
                  <Typography fontWeight={600}>
                    {getCourierDisplayName(tracking.courier_name, '—')}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Status
                  </Typography>
                  <Chip
                    label={formatTrackingStatus(tracking.status)}
                    color={(() => {
                      const normalized = normalizeTrackingStatus(tracking.status)
                      if (normalized.includes('deliver')) return 'success'
                      if (normalized.includes('transit')) return 'info'
                      if (normalized.includes('cancel')) return 'error'
                      if (normalized.includes('rto')) return 'warning'
                      return 'default'
                    })()}
                    size="small"
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Payment Type
                  </Typography>
                  <Typography fontWeight={600} textTransform="uppercase">
                    {tracking.payment_type || '—'}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Estimated Delivery
                  </Typography>
                  <Typography fontWeight={600}>
                    {tracking.edd ? new Date(tracking.edd).toLocaleDateString() : '—'}
                  </Typography>
                </Grid>
              </Grid>
              {tracking.shipment_info && (
                <Box mt={2}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Shipment Info
                  </Typography>
                  <Typography fontSize={14}>{tracking.shipment_info}</Typography>
                </Box>
              )}
            </CardContent>
          </Card>

          <Card sx={compactSurfaceSx}>
            <CardContent sx={{ p: { xs: 1.8, md: 2.2 }, '&:last-child': { pb: { xs: 1.8, md: 2.2 } } }}>
              <Typography variant="h6" fontWeight={700} gutterBottom>
                Tracking Timeline
              </Typography>
              {sortedHistory.length === 0 ? (
                <Typography color="text.secondary">No tracking events available yet.</Typography>
              ) : (
                <Stack spacing={1.4}>
                  {sortedHistory.map((event, idx) => {
                    const exactStatus = formatTrackingStatus(event.status_code)
                    const tone = getTrackingTone(event.status_code)
                    const isLatest = idx === 0

                    return (
                      <Box
                        key={`${event.event_time}-${idx}`}
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', sm: '150px 24px 1fr' },
                          gap: { xs: 1.1, sm: 1.4 },
                          p: { xs: 1.6, md: 2 },
                          borderRadius: '18px',
                          border: `1px solid ${alpha(brand.ink, 0.08)}`,
                          bgcolor: isLatest ? alpha(brand.accent, 0.04) : '#FFFFFF',
                        }}
                      >
                        <Box
                          sx={{
                            minWidth: 0,
                            display: 'flex',
                            flexDirection: { xs: 'row', sm: 'column' },
                            alignItems: { xs: 'center', sm: 'flex-end' },
                            justifyContent: { xs: 'space-between', sm: 'center' },
                            gap: 0.5,
                          }}
                        >
                          <Typography sx={{ fontWeight: 800, color: brand.ink, fontSize: '0.92rem' }}>
                            {formatTrackingDate(event.event_time)}
                          </Typography>
                          <Typography sx={{ fontWeight: 700, color: brand.inkSoft, fontSize: '0.78rem' }}>
                            {formatTrackingTime(event.event_time)}
                          </Typography>
                        </Box>

                        <Box
                          sx={{
                            display: { xs: 'none', sm: 'flex' },
                            justifyContent: 'center',
                            pt: 0.75,
                          }}
                        >
                          <Box
                            sx={{
                              width: 12,
                              height: 12,
                              borderRadius: 999,
                              bgcolor: isLatest ? brand.accent : alpha(brand.ink, 0.18),
                              boxShadow: isLatest ? '0 0 0 6px rgba(255,122,21,0.12)' : 'none',
                              position: 'relative',
                            }}
                          >
                            {idx !== sortedHistory.length - 1 && (
                              <Box
                                sx={{
                                  position: 'absolute',
                                  left: 5,
                                  top: 12,
                                  bottom: -28,
                                  width: 2,
                                  bgcolor: alpha(brand.ink, 0.08),
                                }}
                              />
                            )}
                          </Box>
                        </Box>

                        <Box>
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                            <Chip
                              size="small"
                              label={exactStatus}
                              sx={{
                                bgcolor: tone.bg,
                                color: tone.fg,
                                fontWeight: 800,
                              }}
                            />
                            <Typography fontSize="0.78rem" color="text.secondary" fontWeight={700}>
                              Exact Status
                            </Typography>
                          </Stack>
                          <Typography fontWeight={700} sx={{ mt: 0.8, color: brand.ink }}>
                            {event.message || exactStatus}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.7 }}>
                            <strong>Location:</strong> {event.location || 'N/A'}
                          </Typography>
                        </Box>
                      </Box>
                    )
                  })}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Stack>
      )}
    </Stack>
  )
}
