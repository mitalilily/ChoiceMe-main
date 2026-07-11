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
} from '@mui/material'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { MdCheckCircle, MdLocalShipping } from 'react-icons/md'
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

  const canSubmit = linkQuery.data?.data?.canSubmit
  const storeName = linkQuery.data?.data?.storeName || 'ChoiceMee Store'

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
        bgcolor: '#F5F6FA',
        px: { xs: 2, md: 3 },
        py: { xs: 3, md: 5 },
      }}
    >
      <Paper
        elevation={0}
        sx={{
          maxWidth: 820,
          mx: 'auto',
          overflow: 'hidden',
          borderRadius: 3,
          border: `1px solid ${alpha(brand.ink, 0.08)}`,
          boxShadow: '0 24px 60px rgba(15,44,67,0.10)',
        }}
      >
        <Box sx={{ p: { xs: 3, md: 4 }, bgcolor: '#111B4D', color: '#fff' }}>
          <Stack direction="row" gap={2} alignItems="center">
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: 2,
                display: 'grid',
                placeItems: 'center',
                bgcolor: alpha('#fff', 0.14),
              }}
            >
              <MdLocalShipping size={30} />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight={900}>
                {storeName}
              </Typography>
              <Typography sx={{ color: alpha('#fff', 0.78) }}>Shipment details</Typography>
            </Box>
          </Stack>
        </Box>

        <Stack
          component="form"
          gap={2}
          sx={{ p: { xs: 3, md: 4 } }}
          onSubmit={(event) => {
            event.preventDefault()
            submitMutation.mutate()
          }}
        >
          <Stack direction={{ xs: 'column', md: 'row' }} gap={2}>
            <TextField label="Full name" value={form.fullName} onChange={(e) => update('fullName', e.target.value)} required fullWidth />
            <TextField label="Phone number" value={form.phone} onChange={(e) => update('phone', e.target.value)} required fullWidth />
          </Stack>
          <TextField label="Email address" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} fullWidth />
          <TextField label="Address" value={form.address} onChange={(e) => update('address', e.target.value)} required fullWidth multiline minRows={2} />
          <Stack direction={{ xs: 'column', md: 'row' }} gap={2}>
            <TextField label="Landmark" value={form.landmark} onChange={(e) => update('landmark', e.target.value)} fullWidth />
            <TextField label="Pincode" value={form.pincode} onChange={(e) => update('pincode', e.target.value)} required fullWidth />
          </Stack>
          <Stack direction={{ xs: 'column', md: 'row' }} gap={2}>
            <TextField label="City" value={form.city} onChange={(e) => update('city', e.target.value)} required fullWidth />
            <TextField label="State" value={form.state} onChange={(e) => update('state', e.target.value)} required fullWidth />
            <TextField label="Country" value={form.country} onChange={(e) => update('country', e.target.value)} required fullWidth />
          </Stack>

          <FormControl>
            <Typography fontWeight={800} color={brand.ink} mb={0.5}>
              Payment mode
            </Typography>
            <RadioGroup
              row
              value={form.paymentMode}
              onChange={(event) => update('paymentMode', event.target.value)}
            >
              <FormControlLabel value="cod" control={<Radio />} label="COD" />
              <FormControlLabel value="prepaid" control={<Radio />} label="Prepaid" />
            </RadioGroup>
          </FormControl>

          {submitMutation.isError ? (
            <Alert severity="error">
              {(submitMutation.error as any)?.response?.data?.message || 'Failed to submit details.'}
            </Alert>
          ) : null}

          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={submitMutation.isPending}
            sx={{ alignSelf: { xs: 'stretch', sm: 'flex-end' }, px: 4, bgcolor: '#4C1D75' }}
          >
            {submitMutation.isPending ? 'Submitting...' : 'Submit Details'}
          </Button>
        </Stack>
      </Paper>
    </Box>
  )
}
