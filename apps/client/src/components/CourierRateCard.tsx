import type { JSX } from '@emotion/react/jsx-runtime'
import {
  alpha,
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import { BiPackage, BiRupee, BiTimeFive } from 'react-icons/bi'
import { FaShippingFast, FaWeight } from 'react-icons/fa'
import { brand, brandGradients } from '../theme/brand'
import { courierLogos } from '../utils/constants'

type ForwardRate = {
  mode?: string | null
  rate?: number | null
  cod_charges?: number | null
  cod_percent?: number | null
  is_prepaid?: boolean
  is_cod?: boolean
}

type LocalRates = {
  forward?: ForwardRate | null
}

export type Courier = {
  id: string
  name?: string | null
  chargeable_weight?: number | null
  volumetric_weight?: number | null
  slabs?: number | null
  rate?: number | null
  edd?: string | null
  localRates?: LocalRates | null
  special_zone?: boolean | null
  notes?: string | null
  approxZone: any
}

type Props = {
  availableCouriers?: Courier[]
  defaultLogo?: string
  onSelect?: (courier: Courier) => void
  shipmentType?: string
}

export default function CourierRateList({
  availableCouriers = [],
  defaultLogo = '',
  onSelect,
  shipmentType,
}: Props): JSX.Element {
  if (!availableCouriers.length) {
    return (
      <Box
        py={8}
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        sx={{
          background: brandGradients.surface,
          borderRadius: 4,
          border: `1px dashed ${alpha(brand.accent, 0.34)}`,
        }}
      >
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: alpha(brand.accent, 0.1),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 2,
            color: brand.accent,
          }}
        >
          <FaShippingFast size={30} />
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 700, color: brand.ink, mb: 1 }}>
          No courier rates available
        </Typography>
        <Typography sx={{ color: brand.inkSoft, textAlign: 'center', maxWidth: 400 }}>
          Please check the shipment inputs and try again.
        </Typography>
      </Box>
    )
  }

  return (
    <Box mt={4}>
      <Typography
        variant="h5"
        sx={{
          fontWeight: 800,
          color: brand.ink,
          mb: 3,
          fontSize: { xs: '1.25rem', sm: '1.5rem' },
        }}
      >
        Available Couriers ({availableCouriers.length})
      </Typography>

      <Grid container spacing={2}>
        {availableCouriers.map((courier) => {
          const logo =
            Object.entries(courierLogos || {}).find(([key]) =>
              courier?.name?.toLowerCase().includes(key.toLowerCase()),
            )?.[1] ?? defaultLogo

          const forward: ForwardRate = courier?.localRates?.forward ?? {}
          const freight =
            courier?.rate !== undefined && courier?.rate !== null
              ? Number(courier.rate)
              : forward?.rate
                ? Number(forward.rate)
                : 0
          const codCharges = forward?.cod_charges ? Number(forward.cod_charges) : 0
          const isCOD = shipmentType === 'cod'
          const totalCharges = isCOD ? freight + codCharges : freight
          const eddText = courier?.edd ?? '-'
          const isClickable = Boolean(onSelect)

          return (
            <Grid size={{ xs: 12, sm: 6, xl: 4 }} key={courier.id}>
              <Card
                onClick={isClickable ? () => onSelect?.(courier) : undefined}
                sx={{
                  height: '100%',
                  overflow: 'hidden',
                  borderRadius: '28px',
                  border: `1px solid ${alpha(brand.ink, 0.08)}`,
                  boxShadow: '0 18px 36px rgba(68, 92, 138, 0.1)',
                  transition: 'all 0.24s ease',
                  background: brandGradients.surface,
                  cursor: isClickable ? 'pointer' : 'default',
                  '&:hover': {
                    boxShadow: '0 24px 42px rgba(68, 92, 138, 0.16)',
                    borderColor: alpha(brand.accent, 0.28),
                    transform: isClickable ? 'translateY(-2px)' : 'none',
                  },
                }}
              >
                <Box sx={{ height: 4, background: brandGradients.button }} />

                <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                  <Stack direction="row" spacing={2} alignItems="center" mb={2.5}>
                    <Avatar
                      src={logo}
                      alt={courier?.name ?? 'logo'}
                      variant="rounded"
                      sx={{
                        width: 56,
                        height: 56,
                        borderRadius: '18px',
                        border: `1px solid ${alpha(brand.ink, 0.08)}`,
                        bgcolor: alpha('#FFFFFF', 0.88),
                      }}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        variant="subtitle1"
                        sx={{
                          fontWeight: 800,
                          color: brand.ink,
                          lineHeight: 1.3,
                          mb: 0.5,
                        }}
                        noWrap
                      >
                        {courier?.name ?? 'Unknown Courier'}
                      </Typography>
                      {courier?.approxZone?.name ? (
                        <Chip
                          label={courier.approxZone.name}
                          size="small"
                          sx={{
                            height: 22,
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            background: alpha(brand.accent, 0.12),
                            color: brand.accent,
                            border: `1px solid ${alpha(brand.accent, 0.16)}`,
                          }}
                        />
                      ) : null}
                    </Box>
                  </Stack>

                  <Box
                    sx={{
                      background: alpha(brand.accent, 0.07),
                      borderRadius: '24px',
                      p: 2,
                      mb: 2.5,
                      border: `1px solid ${alpha(brand.accent, 0.16)}`,
                    }}
                  >
                    <Stack direction="row" alignItems="baseline" spacing={1}>
                      <BiRupee size={20} color={brand.accent} />
                      <Typography
                        variant="h4"
                        sx={{
                          fontWeight: 900,
                          color: brand.ink,
                          fontSize: '2rem',
                          lineHeight: 1,
                        }}
                      >
                        {totalCharges > 0 ? totalCharges.toLocaleString('en-IN') : 'N/A'}
                      </Typography>
                    </Stack>
                    <Typography
                      variant="caption"
                      sx={{
                        color: brand.inkSoft,
                        fontWeight: 600,
                        mt: 0.5,
                        display: 'block',
                      }}
                    >
                      {isCOD ? 'Including COD charges' : 'Prepaid rate'}
                    </Typography>
                  </Box>

                  <Grid container spacing={1.4} mb={2}>
                    <Grid size={{ xs: 6 }}>
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        sx={{
                          p: 1.5,
                          borderRadius: '18px',
                          background: alpha(brand.sky, 0.2),
                          border: `1px solid ${alpha(brand.ink, 0.06)}`,
                        }}
                      >
                        <BiTimeFive size={18} color={brand.accent} />
                        <Box>
                          <Typography sx={{ color: brand.inkSoft, fontSize: '0.7rem', fontWeight: 700 }}>
                            EDD
                          </Typography>
                          <Typography sx={{ fontWeight: 800, color: brand.ink, fontSize: '0.85rem' }}>
                            {eddText}
                          </Typography>
                        </Box>
                      </Stack>
                    </Grid>

                    <Grid size={{ xs: 6 }}>
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        sx={{
                          p: 1.5,
                          borderRadius: '18px',
                          background: alpha(brand.sky, 0.2),
                          border: `1px solid ${alpha(brand.ink, 0.06)}`,
                        }}
                      >
                        <FaWeight size={16} color={brand.accent} />
                        <Box>
                          <Typography sx={{ color: brand.inkSoft, fontSize: '0.7rem', fontWeight: 700 }}>
                            Weight
                          </Typography>
                          <Typography sx={{ fontWeight: 800, color: brand.ink, fontSize: '0.85rem' }}>
                            {courier?.chargeable_weight
                              ? `${courier.chargeable_weight.toLocaleString('en-IN')} g`
                              : '-'}
                          </Typography>
                        </Box>
                      </Stack>
                    </Grid>
                  </Grid>

                  <Stack spacing={1}>
                    {forward?.mode ? (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <BiPackage size={14} color={brand.inkSoft} />
                        <Typography sx={{ color: brand.inkSoft, fontSize: '0.75rem' }}>
                          Mode: <strong>{forward.mode}</strong>
                        </Typography>
                      </Stack>
                    ) : null}
                    {isCOD && codCharges > 0 ? (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <BiRupee size={14} color={brand.inkSoft} />
                        <Typography sx={{ color: brand.inkSoft, fontSize: '0.75rem' }}>
                          COD Charges: <strong>INR {codCharges.toLocaleString('en-IN')}</strong>
                        </Typography>
                      </Stack>
                    ) : null}
                    {courier?.notes ? (
                      <Tooltip title={courier.notes} arrow>
                        <Chip
                          label="Special Notes"
                          size="small"
                          sx={{
                            alignSelf: 'flex-start',
                            height: 24,
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            background: alpha(brand.accent, 0.1),
                            color: brand.accent,
                            border: `1px solid ${alpha(brand.accent, 0.18)}`,
                            cursor: 'help',
                          }}
                        />
                      </Tooltip>
                    ) : null}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          )
        })}
      </Grid>
    </Box>
  )
}
