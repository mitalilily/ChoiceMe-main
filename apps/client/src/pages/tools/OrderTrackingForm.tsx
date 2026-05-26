'use client'

import {
  alpha,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormHelperText,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material'
import { Fragment, useEffect, useMemo, useState } from 'react'
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
import { MdLocationOn, MdSchedule } from 'react-icons/md'
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

const trackingHeroSx = {
  position: 'relative',
  overflow: 'hidden',
  borderRadius: '12px',
  border: `1px solid ${alpha(brand.ink, 0.08)}`,
  background: `linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(248,250,254,0.98) 58%, rgba(235,241,249,0.96) 100%)`,
  boxShadow: '0 16px 34px rgba(68, 92, 138, 0.1)',
  p: { xs: 1.5, sm: 1.8, md: 2 },
}

const compactSurfaceSx = {
  borderRadius: '10px',
  border: `1px solid ${alpha(brand.ink, 0.08)}`,
  background: 'rgba(255,255,255,0.92)',
  boxShadow: '0 12px 26px rgba(68, 92, 138, 0.08)',
}

const modeButtonSx = (active: boolean) => ({
  minHeight: 36,
  px: 1.45,
  borderRadius: '8px',
  border: `1px solid ${active ? alpha(brand.accent, 0.38) : alpha(brand.ink, 0.08)}`,
  bgcolor: active ? alpha(brand.accent, 0.12) : '#FFFFFF',
  color: active ? brand.ink : brand.inkSoft,
  boxShadow: active ? '0 10px 20px rgba(255, 122, 21, 0.12)' : 'none',
  fontSize: '0.82rem',
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

  return (
    <Stack spacing={2.2} sx={{ py: { xs: 1.4, md: 2.2 } }}>
      <Box sx={trackingHeroSx}>
        <Grid container spacing={{ xs: 1.6, md: 2 }} alignItems="stretch">
          <Grid size={{ xs: 12, md: 5 }}>
            <Stack
              spacing={1.15}
              sx={{ height: '100%', justifyContent: 'center', pr: { md: 1.2 } }}
            >
              <Stack direction="row" spacing={1.2} alignItems="center">
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '10px',
                    background: brandGradients.button,
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 12px 22px rgba(255, 122, 21, 0.2)',
                  }}
                >
                  <FaBoxOpen size={18} />
                </Box>
                <Stack spacing={0.2}>
                  <Typography
                    sx={{
                      color: brand.inkSoft,
                      fontSize: '0.68rem',
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
                      fontSize: { xs: '1.55rem', md: '1.95rem' },
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
                  fontSize: { xs: '0.88rem', md: '0.94rem' },
                  lineHeight: 1.58,
                  maxWidth: 540,
                }}
              >
                Track by AWB or order details, review shipment timelines, and keep the utility view
                aligned with the rest of the panel.
              </Typography>
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, md: 7 }}>
            <Box
              component="form"
              onSubmit={handleSubmit(onSubmit)}
              sx={{ ...compactSurfaceSx, p: { xs: 1.5, sm: 1.75 } }}
            >
              <Stack spacing={1.35}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1.1}
                  justifyContent="space-between"
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                >
                  <Box>
                    <Typography sx={{ color: brand.ink, fontSize: '1.08rem', fontWeight: 800 }}>
                      Track Your <Box component="span" sx={{ color: brand.accent }}>Order</Box>
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                      Enter your AWB number or order details to track shipment.
                    </Typography>
                  </Box>
                  <Stack
                    direction="row"
                    spacing={0.7}
                    sx={{
                      p: 0.45,
                      borderRadius: '10px',
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
                  <FormControl fullWidth sx={{ mb: 0.2 }}>
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
                ) : (
                  <Grid container spacing={1.3}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormControl fullWidth sx={{ mb: 0.2 }}>
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

                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormControl fullWidth sx={{ mb: 0.2 }}>
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
                  </Grid>
                )}

                {error && (
                  <Typography color="error" variant="body2">
                    {error}
                  </Typography>
                )}

                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  alignItems={{ xs: 'stretch', sm: 'center' }}
                >
                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    startIcon={trackingLoading ? <CircularProgress size={18} /> : <FaSearch />}
                    disabled={!canSubmit || trackingLoading}
                    sx={{
                      minHeight: 42,
                      px: 2.2,
                      borderRadius: '8px',
                      fontWeight: 800,
                      textTransform: 'none',
                    }}
                  >
                    {trackingLoading ? 'Tracking…' : 'Track Order'}
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
                      minHeight: 42,
                      borderRadius: '8px',
                      fontWeight: 800,
                      textTransform: 'none',
                    }}
                  >
                    Reset
                  </Button>
                </Stack>
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
                <List>
                  {sortedHistory.map((event, idx) => (
                    <Fragment key={`${event.event_time}-${idx}`}>
                      <ListItem alignItems="flex-start" sx={{ px: 0 }}>
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          {idx === 0 ? (
                            <FaBoxOpen color="#333369" size={20} />
                          ) : (
                            <MdLocationOn color="#6B7280" size={20} />
                          )}
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography fontWeight={600}>
                                {event.message || event.status_code}
                              </Typography>
                              <Chip
                                size="small"
                                label={event.status_code}
                                color={idx === 0 ? 'primary' : 'default'}
                              />
                            </Stack>
                          }
                          secondary={
                            <Stack
                              direction={{ xs: 'column', sm: 'row' }}
                              spacing={1}
                              mt={0.5}
                              alignItems={{ sm: 'center' }}
                            >
                              <Stack direction="row" spacing={0.5} alignItems="center">
                                <MdSchedule size={16} />
                                <Typography variant="caption">
                                  {new Date(event.event_time).toLocaleString()}
                                </Typography>
                              </Stack>
                              {event.location && (
                                <Typography variant="caption" color="text.secondary">
                                  {event.location}
                                </Typography>
                              )}
                            </Stack>
                          }
                        />
                      </ListItem>
                      {idx !== sortedHistory.length - 1 && <Divider component="li" />}
                    </Fragment>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Stack>
      )}
    </Stack>
  )
}
