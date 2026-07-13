import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  FormControlLabel,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
  alpha,
  InputAdornment,
} from '@mui/material'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import {
  MdApartment,
  MdCheckCircle,
  MdEmail,
  MdFlag,
  MdLocationCity,
  MdLocationOn,
  MdLocalShipping,
  MdMap,
  MdOutlinePerson,
  MdPhone,
  MdPinDrop,
  MdSend,
  MdVerified,
} from 'react-icons/md'
import { useParams } from 'react-router-dom'
import {
  fetchPublicQuickDetail,
  submitPublicQuickDetail,
  type QuickDetailCustomerDetails,
} from '../../api/quickDetails.api'
import { brand } from '../../theme/brand'

const emptyForm: QuickDetailCustomerDetails = {
  fullName: '',
  phone: '',
  email: '',
  address: '',
  landmark: '',
  pincode: '',
  city: '',
  state: '',
  country: 'India',
  paymentMode: 'cod',
}

export default function PublicQuickDetailsForm() {
  const { storeSlug = '', token = '' } = useParams()
  const [form, setForm] = useState<QuickDetailCustomerDetails>(emptyForm)

  const linkQuery = useQuery({
    queryKey: ['publicQuickDetail', storeSlug, token],
    queryFn: () => fetchPublicQuickDetail(storeSlug, token),
    enabled: Boolean(storeSlug && token),
  })

  const submitMutation = useMutation({
    mutationFn: () => submitPublicQuickDetail(storeSlug, token, form),
  })

  const update = (key: keyof QuickDetailCustomerDetails, value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const submitError = submitMutation.error as
    | { response?: { data?: { message?: string } } }
    | null

  const canSubmit = linkQuery.data?.data?.canSubmit
  const storeName = linkQuery.data?.data?.storeName || 'ChoiceMee Store'
  const sellerPhone = linkQuery.data?.data?.sellerPhone || ''
  const fieldSx = {
    '& .MuiOutlinedInput-root': {
      minHeight: 58,
      borderRadius: '15px',
      bgcolor: '#fff',
      transition: 'box-shadow 180ms ease, transform 180ms ease',
      '& fieldset': { borderColor: 'rgba(92, 45, 145, 0.16)' },
      '&:hover fieldset': { borderColor: 'rgba(104, 45, 180, 0.38)' },
      '&.Mui-focused': {
        boxShadow: '0 0 0 4px rgba(117, 53, 188, 0.09)',
        '& fieldset': { borderColor: '#7535BC' },
      },
    },
    '& .MuiInputLabel-root.Mui-focused': { color: '#6B2FB1' },
    '& .MuiInputAdornment-root': { color: '#7133B6' },
  }

  const icon = (node: ReactNode) => (
    <InputAdornment position="start">{node}</InputAdornment>
  )

  if (linkQuery.isLoading) {
    return (
      <Stack minHeight="100dvh" alignItems="center" justifyContent="center">
        <CircularProgress />
      </Stack>
    )
  }

  if (linkQuery.isError || !linkQuery.data?.data) {
    return (
      <Stack minHeight="100dvh" alignItems="center" justifyContent="center" sx={{ bgcolor: '#F5F6FA', p: 2 }}>
        <Alert severity="error">This quick details link could not be found.</Alert>
      </Stack>
    )
  }

  if (submitMutation.isSuccess || !canSubmit) {
    return (
      <Stack minHeight="100dvh" alignItems="center" justifyContent="center" sx={{ bgcolor: '#F5F6FA', p: 2 }}>
        <Paper elevation={0} sx={{ maxWidth: 520, p: 4, borderRadius: 3, textAlign: 'center' }}>
          <MdCheckCircle size={56} color={brand.success} />
          <Typography variant="h5" fontWeight={900} color={brand.ink} mt={2}>
            Details submitted
          </Typography>
          <Typography color={brand.inkSoft} mt={1}>
            This one-time link has already been used. The seller can now review your shipment details.
          </Typography>
        </Paper>
      </Stack>
    )
  }

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        background:
          'radial-gradient(circle at 12% 8%, rgba(229, 210, 255, .9), transparent 28%), radial-gradient(circle at 90% 88%, rgba(255, 206, 235, .68), transparent 28%), #fbf9ff',
        px: { xs: 1.5, sm: 2.5, md: 3 },
        py: { xs: 2, sm: 3, md: 5 },
      }}
    >
      <Paper
        elevation={0}
        sx={{
          maxWidth: 920,
          mx: 'auto',
          overflow: 'hidden',
          borderRadius: { xs: '22px', md: '32px' },
          border: '1px solid rgba(112, 48, 181, 0.10)',
          boxShadow: '0 28px 80px rgba(75, 33, 125, 0.16)',
          bgcolor: 'rgba(255,255,255,.96)',
        }}
      >
        <Box
          sx={{
            position: 'relative',
            overflow: 'hidden',
            p: { xs: 3, md: 4 },
            pb: { xs: 5, md: 6 },
            color: '#fff',
            background: 'linear-gradient(125deg, #3E128F 0%, #671BBB 54%, #C126A1 100%)',
            '&::before': {
              content: '""',
              position: 'absolute',
              inset: 0,
              opacity: 0.28,
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,.55) 1px, transparent 1.5px)',
              backgroundSize: '13px 13px',
              maskImage: 'linear-gradient(90deg, transparent 30%, #000)',
            },
            '&::after': {
              content: '""',
              position: 'absolute',
              left: '-5%',
              right: '-5%',
              bottom: -30,
              height: 58,
              bgcolor: '#fff',
              borderRadius: '50% 50% 0 0 / 70% 70% 0 0',
              transform: 'rotate(-2deg)',
              borderTop: '5px solid rgba(244, 54, 166, .7)',
            },
          }}
        >
          <Stack direction="row" gap={2} alignItems="center">
            <Box
              sx={{
                position: 'relative',
                zIndex: 1,
                width: { xs: 54, md: 64 },
                height: { xs: 54, md: 64 },
                borderRadius: '19px',
                display: 'grid',
                placeItems: 'center',
                bgcolor: alpha('#fff', 0.16),
                border: '1px solid rgba(255,255,255,.2)',
                boxShadow: '0 12px 28px rgba(31, 8, 73, .26)',
              }}
            >
              <MdLocalShipping size={34} />
            </Box>
            <Box sx={{ position: 'relative', zIndex: 1 }}>
              <Typography variant="h4" sx={{ fontSize: { xs: '1.45rem', md: '2rem' }, fontWeight: 900, letterSpacing: '-.025em' }}>
                Shipment Details
              </Typography>
              <Typography sx={{ mt: 0.4, color: alpha('#fff', 0.82), fontSize: { xs: '.86rem', md: '1rem' } }}>
                Please provide accurate details for fast &amp; safe delivery
              </Typography>
            </Box>
          </Stack>
        </Box>

        <Stack
          component="form"
          gap={2.2}
          sx={{ p: { xs: 2.3, sm: 3, md: 4.5 }, pt: { xs: 2, md: 3 } }}
          onSubmit={(event) => {
            event.preventDefault()
            submitMutation.mutate()
          }}
        >
          <Stack direction={{ xs: 'column', md: 'row' }} gap={2}>
            <TextField sx={fieldSx} slotProps={{ input: { startAdornment: icon(<MdOutlinePerson size={21} />) } }} label="Full name" value={form.fullName} onChange={(e) => update('fullName', e.target.value)} required fullWidth />
            <TextField sx={fieldSx} slotProps={{ input: { startAdornment: icon(<MdPhone size={20} />) } }} label="Phone number" value={form.phone} onChange={(e) => update('phone', e.target.value)} required fullWidth />
          </Stack>
          <TextField sx={fieldSx} slotProps={{ input: { startAdornment: icon(<MdEmail size={20} />) } }} label="Email address" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} fullWidth />
          <TextField sx={fieldSx} slotProps={{ input: { startAdornment: icon(<MdLocationOn size={22} />) } }} label="Delivery address" value={form.address} onChange={(e) => update('address', e.target.value)} required fullWidth />
          <Stack direction={{ xs: 'column', md: 'row' }} gap={2}>
            <TextField sx={fieldSx} slotProps={{ input: { startAdornment: icon(<MdFlag size={20} />) } }} label="Landmark" value={form.landmark} onChange={(e) => update('landmark', e.target.value)} fullWidth />
            <TextField sx={fieldSx} slotProps={{ input: { startAdornment: icon(<MdPinDrop size={20} />) } }} label="Pincode" value={form.pincode} onChange={(e) => update('pincode', e.target.value)} required fullWidth />
          </Stack>
          <Stack direction={{ xs: 'column', md: 'row' }} gap={2}>
            <TextField sx={fieldSx} slotProps={{ input: { startAdornment: icon(<MdApartment size={19} />) } }} label="City" value={form.city} onChange={(e) => update('city', e.target.value)} required fullWidth />
            <TextField sx={fieldSx} slotProps={{ input: { startAdornment: icon(<MdMap size={20} />) } }} label="State" value={form.state} onChange={(e) => update('state', e.target.value)} required fullWidth />
            <TextField sx={fieldSx} slotProps={{ input: { startAdornment: icon(<MdLocationCity size={20} />) } }} label="Country" value={form.country} onChange={(e) => update('country', e.target.value)} required fullWidth />
          </Stack>

          <FormControl>
            <Typography fontWeight={900} color="#251137" mb={0.5}>
              Payment mode
            </Typography>
            <RadioGroup
              row
              value={form.paymentMode}
              onChange={(event) => update('paymentMode', event.target.value)}
              sx={{ '& .MuiRadio-root.Mui-checked': { color: '#7133B6' }, gap: { xs: 1, sm: 3 } }}
            >
              <FormControlLabel value="cod" control={<Radio />} label="COD" />
              <FormControlLabel value="prepaid" control={<Radio />} label="Prepaid" />
            </RadioGroup>
          </FormControl>

          {submitMutation.isError ? (
            <Alert severity="error">
              {submitError?.response?.data?.message || 'Failed to submit details.'}
            </Alert>
          ) : null}

          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={submitMutation.isPending}
            endIcon={<MdSend />}
            sx={{
              alignSelf: { xs: 'stretch', sm: 'flex-end' },
              minWidth: { sm: 230 },
              minHeight: 54,
              px: 4,
              borderRadius: '14px',
              textTransform: 'none',
              fontSize: '1rem',
              fontWeight: 900,
              background: 'linear-gradient(100deg, #5B20C5 0%, #A523C2 52%, #F13A9A 100%)',
              boxShadow: '0 13px 28px rgba(139, 35, 182, .28)',
              '&:hover': { boxShadow: '0 16px 34px rgba(139, 35, 182, .38)', transform: 'translateY(-1px)' },
            }}
          >
            {submitMutation.isPending ? 'Submitting...' : 'Submit Details'}
          </Button>

          <Box
            sx={{
              mt: { xs: 1, md: 2 },
              mx: { xs: -0.5, sm: 0 },
              p: { xs: 2.4, sm: 3 },
              borderRadius: '24px',
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
              background: 'linear-gradient(135deg, #FBF7FF 0%, #FFF5FB 100%)',
              border: '1px solid rgba(119, 47, 179, .12)',
            }}
          >
            <Typography sx={{ color: '#6F28A9', fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: { xs: '1.5rem', sm: '1.85rem' }, lineHeight: 1.1 }}>
              Thank you
            </Typography>
            <Typography sx={{ mt: 0.8, color: '#30203D', fontWeight: 700 }}>for choosing</Typography>
            <Typography
              sx={{
                mt: 0.5,
                background: 'linear-gradient(90deg, #5B20C5, #E9359B)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontFamily: 'Georgia, serif',
                fontSize: { xs: '1.65rem', sm: '2.2rem' },
                fontWeight: 900,
                lineHeight: 1.15,
                overflowWrap: 'anywhere',
              }}
            >
              {storeName}
            </Typography>
            <Stack direction="row" justifyContent="center" alignItems="center" gap={0.8} mt={1.5}>
              {sellerPhone ? (
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 2.2,
                    py: 1,
                    borderRadius: '999px',
                    bgcolor: '#fff',
                    border: '1px solid rgba(117, 53, 188, .16)',
                    boxShadow: '0 8px 22px rgba(75, 33, 125, .08)',
                  }}
                >
                  <MdPhone color="#7535BC" size={20} />
                  <Typography sx={{ color: '#4A225F', fontSize: '.95rem', fontWeight: 900 }}>
                    {sellerPhone}
                  </Typography>
                </Box>
              ) : (
                <>
                  <MdVerified color="#7535BC" size={20} />
                  <Typography sx={{ color: '#6B5A76', fontSize: '.82rem', fontWeight: 700 }}>
                    Shared securely by the seller
                  </Typography>
                </>
              )}
            </Stack>
          </Box>
        </Stack>
      </Paper>
    </Box>
  )
}
