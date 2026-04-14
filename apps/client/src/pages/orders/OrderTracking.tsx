import {
  alpha,
  Box,
  Chip,
  Container,
  Grid,
  Stack,
  Step,
  StepConnector,
  StepLabel,
  Stepper,
  Typography,
  styled,
} from '@mui/material'
import { FaBoxOpen, FaBuilding, FaExclamationTriangle, FaShippingFast, FaStore, FaTruck } from 'react-icons/fa'
import BrandSurface from '../../components/brand/BrandSurface'
import PublicFooter from '../../components/public/PublicFooter'
import PublicNavbar from '../../components/public/PublicNavbar'
import { useTracking } from '../../hooks/Orders/useTracking'
import { brand, brandGradients } from '../../theme/brand'

const stages = [
  { label: 'Booked', icon: <FaStore /> },
  { label: 'Pending Pickup', icon: <FaBuilding /> },
  { label: 'In Transit', icon: <FaTruck /> },
  { label: 'Out for Delivery', icon: <FaShippingFast /> },
  { label: 'Delivered', icon: <FaBoxOpen /> },
]

const statusLabels: Record<string, string> = {
  PP: 'Pending Pickup',
  IT: 'In Transit',
  OFD: 'Out for Delivery',
  DL: 'Delivered',
  CAN: 'Cancelled',
  RT: 'RTO',
  'RT-IT': 'RTO In Transit',
  'RT-DL': 'RTO Delivered',
  EX: 'Exception',
}

const TrackingConnector = styled(StepConnector)(() => ({
  '&.MuiStepConnector-alternativeLabel': { top: 22 },
  '& .MuiStepConnector-line': {
    height: 4,
    border: 0,
    background: alpha(brand.ink, 0.12),
    borderRadius: 999,
  },
  '&.Mui-active .MuiStepConnector-line': {
    background: brandGradients.button,
  },
  '&.Mui-completed .MuiStepConnector-line': {
    background: brandGradients.button,
  },
}))

export default function TrackingPage() {
  const searchParams = new URLSearchParams(window.location.search)
  const awb = searchParams.get('awb')
  const order = searchParams.get('orderNumber')
  const contact = searchParams.get('contact')
  const { data: trackingData, isLoading, error } = useTracking(awb, order, contact)
  const trackingMeta = trackingData as typeof trackingData & {
    consignee?: { name?: string; city?: string; pincode?: string }
    weight?: string | number
    dimensions?: string
  }

  const currentStage =
    trackingData?.history?.findIndex(
      (h) => statusLabels[h.status_code]?.toLowerCase() === trackingData.status?.toLowerCase(),
    ) ?? 0

  if (isLoading) {
    return (
      <Box sx={{ minHeight: '100vh' }}>
        <PublicNavbar />
        <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 }, py: 6 }}>
          <BrandSurface variant="hero" sx={{ minHeight: 420, alignItems: 'center', justifyContent: 'center' }}>
            <Stack spacing={2} alignItems="center">
              <Box
                sx={{
                  width: 82,
                  height: 82,
                  borderRadius: 999,
                  border: `6px solid ${alpha(brand.accent, 0.14)}`,
                  borderTopColor: brand.accent,
                  animation: 'spin 1s linear infinite',
                }}
              />
              <Typography sx={{ color: brand.ink, fontWeight: 800, fontSize: '1.3rem' }}>
                Fetching tracking details...
              </Typography>
              <style>{'@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }'}</style>
            </Stack>
          </BrandSurface>
        </Container>
        <PublicFooter />
      </Box>
    )
  }

  if (error || !trackingData) {
    return (
      <Box sx={{ minHeight: '100vh' }}>
        <PublicNavbar />
        <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 }, py: 6 }}>
          <BrandSurface variant="card" sx={{ p: { xs: 2.8, md: 4 }, textAlign: 'center', alignItems: 'center' }}>
            <FaExclamationTriangle size={60} color={brand.accent} />
            <Typography sx={{ mt: 2, color: brand.ink, fontWeight: 800, fontSize: { xs: '1.7rem', md: '2.4rem' } }}>
              No Shipment Data Found
            </Typography>
            <Typography sx={{ mt: 1.2, color: brand.inkSoft, lineHeight: 1.8, maxWidth: 520 }}>
              We could not locate any shipment with AWB <strong>{awb}</strong>. Please check the tracking number and try again.
            </Typography>
            <Chip
              label="Back to previous page"
              onClick={() => window.history.back()}
              sx={{
                mt: 2.2,
                px: 1.8,
                py: 2.1,
                borderRadius: 999,
                background: brandGradients.button,
                color: '#FFFFFF',
                fontWeight: 800,
              }}
            />
          </BrandSurface>
        </Container>
        <PublicFooter />
      </Box>
    )
  }

  const isCancelled = trackingData.status === 'Cancelled'
  const isRTO = trackingData.status?.includes('RTO')

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <PublicNavbar />

      <Container maxWidth="xl" sx={{ px: { xs: 2, sm: 3 }, pb: 8 }}>
        <Stack spacing={3.2} sx={{ pt: { xs: 1.5, md: 3 } }}>
          <BrandSurface
            variant="hero"
            sx={{
              p: { xs: 2.5, md: 3.4 },
              background: `
                radial-gradient(circle at 100% 0%, rgba(255, 156, 75, 0.18), transparent 24%),
                ${brandGradients.analytics}
              `,
            }}
          >
            <Grid container spacing={{ xs: 2.2, md: 3 }} alignItems="center">
              <Grid size={{ xs: 12, lg: 8 }}>
                <Typography sx={{ color: brand.accent, fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.16em' }}>
                  Shipment status
                </Typography>
                <Typography sx={{ mt: 1, color: brand.ink, fontWeight: 900, fontSize: { xs: '2.2rem', md: '3.4rem' }, lineHeight: 0.98, letterSpacing: '-0.05em' }}>
                  {trackingData.status || 'Order Placed'}
                </Typography>
                <Typography sx={{ mt: 1.1, color: brand.inkSoft, lineHeight: 1.8 }}>
                  Track every parcel with a clearer public timeline while reusing the current tracking API and history data.
                </Typography>
              </Grid>

              <Grid size={{ xs: 12, lg: 4 }}>
                <Stack spacing={1.2}>
                  <BrandSurface variant="glass" sx={{ p: 1.8, borderRadius: '24px' }}>
                    <Typography sx={{ color: brand.inkSoft, fontSize: '0.8rem', fontWeight: 700 }}>AWB</Typography>
                    <Typography sx={{ mt: 0.5, color: brand.ink, fontWeight: 800 }}>{awb || 'N/A'}</Typography>
                  </BrandSurface>
                  <BrandSurface variant="glass" sx={{ p: 1.8, borderRadius: '24px' }}>
                    <Typography sx={{ color: brand.inkSoft, fontSize: '0.8rem', fontWeight: 700 }}>Order Number</Typography>
                    <Typography sx={{ mt: 0.5, color: brand.ink, fontWeight: 800 }}>{order || 'N/A'}</Typography>
                  </BrandSurface>
                  <BrandSurface variant="glass" sx={{ p: 1.8, borderRadius: '24px' }}>
                    <Typography sx={{ color: brand.inkSoft, fontSize: '0.8rem', fontWeight: 700 }}>Estimated Delivery</Typography>
                    <Typography sx={{ mt: 0.5, color: brand.ink, fontWeight: 800 }}>{trackingData.edd || 'To be updated'}</Typography>
                  </BrandSurface>
                </Stack>
              </Grid>
            </Grid>
          </BrandSurface>

          <Grid container spacing={2.2}>
            <Grid size={{ xs: 12, lg: 8 }}>
              <BrandSurface variant="card" sx={{ p: { xs: 2.2, md: 3 }, borderRadius: '32px' }}>
                <Typography sx={{ color: brand.ink, fontWeight: 800, fontSize: '1.25rem', mb: 3 }}>
                  Tracking Timeline
                </Typography>

                {!isCancelled && !isRTO ? (
                  <Stepper alternativeLabel activeStep={currentStage} connector={<TrackingConnector />} sx={{ mb: 5 }}>
                    {stages.map((stage, index) => (
                      <Step key={stage.label}>
                        <StepLabel
                          StepIconComponent={() => (
                            <Box
                              sx={{
                                width: 44,
                                height: 44,
                                borderRadius: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                bgcolor: index <= currentStage ? brand.accent : alpha(brand.ink, 0.12),
                                color: index <= currentStage ? '#FFFFFF' : brand.inkSoft,
                                boxShadow: index <= currentStage ? '0 16px 28px rgba(255,122,21,0.22)' : 'none',
                              }}
                            >
                              {stage.icon}
                            </Box>
                          )}
                        >
                          <Typography
                            sx={{
                              fontWeight: 800,
                              mt: 1.5,
                              color: index <= currentStage ? brand.ink : brand.inkSoft,
                              fontSize: '0.82rem',
                            }}
                          >
                            {stage.label}
                          </Typography>
                        </StepLabel>
                      </Step>
                    ))}
                  </Stepper>
                ) : (
                  <BrandSurface
                    variant="soft"
                    sx={{
                      p: 2.4,
                      borderRadius: '24px',
                      mb: 4,
                      background: alpha(brand.accent, 0.08),
                      border: `1px solid ${alpha(brand.accent, 0.22)}`,
                    }}
                  >
                    <Typography sx={{ color: brand.ink, fontWeight: 800, fontSize: '1.05rem' }}>
                      {isCancelled ? 'Order Cancelled' : 'RTO Initiated'}
                    </Typography>
                  </BrandSurface>
                )}

                <Stack spacing={2.2}>
                  {trackingData.history?.map((event, index) => (
                    <Stack key={`${event.event_time}-${index}`} direction="row" spacing={2}>
                      <Box sx={{ minWidth: 100, pt: 0.25 }}>
                        <Typography sx={{ color: brand.ink, fontWeight: 800, fontSize: '0.92rem' }}>
                          {event.event_time ? new Date(event.event_time).toLocaleDateString('en-GB') : 'N/A'}
                        </Typography>
                        <Typography sx={{ color: brand.inkSoft, fontSize: '0.78rem' }}>
                          {event.event_time
                            ? new Date(event.event_time).toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'N/A'}
                        </Typography>
                      </Box>
                      <Box sx={{ position: 'relative', pt: 0.55 }}>
                        <Box sx={{ width: 12, height: 12, borderRadius: 999, bgcolor: index === 0 ? brand.accent : alpha(brand.ink, 0.16) }} />
                        {index < (trackingData.history?.length ?? 0) - 1 ? (
                          <Box
                            sx={{
                              position: 'absolute',
                              left: 5,
                              top: 18,
                              bottom: -28,
                              width: 2,
                              bgcolor: alpha(brand.ink, 0.08),
                            }}
                          />
                        ) : null}
                      </Box>
                      <Box sx={{ pb: 2.5 }}>
                        <Typography sx={{ color: brand.ink, fontWeight: 800 }}>{event.message}</Typography>
                        <Typography sx={{ color: brand.inkSoft, mt: 0.4 }}>
                          Location: {event.location}
                        </Typography>
                      </Box>
                    </Stack>
                  ))}
                </Stack>
              </BrandSurface>
            </Grid>

            <Grid size={{ xs: 12, lg: 4 }}>
              <Stack spacing={2.2}>
                <BrandSurface variant="card" sx={{ p: 2.4, borderRadius: '30px' }}>
                  <Typography sx={{ color: brand.ink, fontWeight: 800, fontSize: '1.05rem', mb: 2 }}>
                    Consignee Info
                  </Typography>
                  <Stack spacing={1.4}>
                    <Box>
                      <Typography sx={{ color: brand.inkSoft, fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.14em' }}>
                        Recipient
                      </Typography>
                      <Typography sx={{ color: brand.ink, fontWeight: 700, mt: 0.45 }}>
                        {trackingMeta?.consignee?.name || 'Customer'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ color: brand.inkSoft, fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.14em' }}>
                        Destination
                      </Typography>
                      <Typography sx={{ color: brand.ink, mt: 0.45 }}>
                        {trackingMeta?.consignee?.city || 'N/A'}, {trackingMeta?.consignee?.pincode || 'N/A'}
                      </Typography>
                    </Box>
                  </Stack>
                </BrandSurface>

                <BrandSurface variant="card" sx={{ p: 2.4, borderRadius: '30px' }}>
                  <Typography sx={{ color: brand.ink, fontWeight: 800, fontSize: '1.05rem', mb: 2 }}>
                    Shipment Content
                  </Typography>
                  <Stack spacing={1.4}>
                    <Box>
                      <Typography sx={{ color: brand.inkSoft, fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.14em' }}>
                        Weight
                      </Typography>
                      <Typography sx={{ color: brand.ink, fontWeight: 700, mt: 0.45 }}>
                        {trackingMeta?.weight || '0.5'} kg
                      </Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ color: brand.inkSoft, fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.14em' }}>
                        Dimensions
                      </Typography>
                      <Typography sx={{ color: brand.ink, mt: 0.45 }}>
                        {trackingMeta?.dimensions || trackingData.shipment_info || 'N/A'}
                      </Typography>
                    </Box>
                  </Stack>
                </BrandSurface>
              </Stack>
            </Grid>
          </Grid>
        </Stack>
      </Container>

      <PublicFooter />
    </Box>
  )
}
