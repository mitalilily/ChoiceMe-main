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
import { getCourierDisplayName, getCourierLogo } from '../utils/courierDisplay'

type ForwardRate = {
  mode?: string | null
  rate?: number | null
  cod_charges?: number | null
  cod_percent?: number | null
  cod_charge_basis?: number | null
  cod_charge_source?: string | null
  is_prepaid?: boolean
  is_cod?: boolean
}

type LocalRates = {
  forward?: ForwardRate | null
}

type ProviderRate = {
  provider?: string | null
  total?: number | string | null
  freight?: number | string | null
  cod?: number | string | null
  chargeable_weight?: number | string | null
}

export type Courier = {
  id: string
  name?: string | null
  displayName?: string | null
  chargeable_weight?: number | null
  volumetric_weight?: number | null
  slabs?: number | null
  rate?: number | null
  rateEstimate?: number | null
  courier_cost_estimate?: number | null
  platform_rate?: number | null
  provider_quote?: number | null
  seller_freight_charge?: number | null
  final_freight_charge?: number | null
  final_courier_charge?: number | null
  quote_required?: boolean | null
  quote_available?: boolean | null
  is_bookable?: boolean | null
  unavailable_reason?: string | null
  provider_rate?: ProviderRate | null
  serviceProvider?: string | null
  service_provider?: string | null
  integration_type?: string | null
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

const toChargeNumber = (value: unknown) => {
  const numeric = Number(value ?? 0)
  return Number.isFinite(numeric) ? numeric : 0
}

const formatAmount = (value: number) =>
  value > 0 ? value.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : 'N/A'

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
          const displayName = getCourierDisplayName(courier)
          const logo = getCourierLogo(courier, defaultLogo)

          const forward: ForwardRate = courier?.localRates?.forward ?? {}
          const freight =
            courier?.rate !== undefined && courier?.rate !== null
              ? toChargeNumber(courier.rate)
              : forward?.rate
                ? toChargeNumber(forward.rate)
                : 0
          const codCharges = toChargeNumber(forward?.cod_charges)
          const isCOD = shipmentType === 'cod'
          const codIncluded = isCOD ? codCharges : 0
          const rateCardTotal = freight + codIncluded
          const eddText = courier?.edd ?? '-'
          const isClickable = Boolean(onSelect)
          const zoneLabel = courier?.approxZone?.code || courier?.approxZone?.name || null

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
                      alt={displayName}
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
                        {displayName}
                      </Typography>
                      {zoneLabel ? (
                        <Chip
                          label={`Zone ${zoneLabel}`}
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
                    <Grid container spacing={1.4}>
                      <Grid size={{ xs: 12 }}>
                        <Stack spacing={0.8}>
                          <Typography
                            variant="caption"
                            sx={{ color: brand.inkSoft, fontWeight: 800, display: 'block' }}
                          >
                            Rate card total
                          </Typography>
                          <Stack direction="row" alignItems="baseline" spacing={0.5}>
                            <BiRupee size={18} color={brand.accent} />
                            <Typography
                              sx={{
                                fontWeight: 900,
                                color: brand.ink,
                                fontSize: '1.65rem',
                                lineHeight: 1,
                              }}
                            >
                              {formatAmount(rateCardTotal)}
                            </Typography>
                          </Stack>
                          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            <Chip
                              label={
                                codIncluded > 0
                                  ? `COD included Rs ${formatAmount(codIncluded)}`
                                  : 'No COD included'
                              }
                              size="small"
                              sx={{
                                height: 24,
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                background:
                                  codIncluded > 0 ? alpha('#16A34A', 0.12) : alpha(brand.ink, 0.08),
                                color: codIncluded > 0 ? '#15803D' : brand.inkSoft,
                                border: `1px solid ${
                                  codIncluded > 0 ? alpha('#16A34A', 0.18) : alpha(brand.ink, 0.08)
                                }`,
                              }}
                            />
                            {zoneLabel ? (
                              <Chip
                                label={`Zone ${zoneLabel}`}
                                size="small"
                                sx={{
                                  height: 24,
                                  fontSize: '0.7rem',
                                  fontWeight: 800,
                                  background: alpha(brand.accent, 0.12),
                                  color: brand.accent,
                                  border: `1px solid ${alpha(brand.accent, 0.18)}`,
                                }}
                              />
                            ) : null}
                          </Stack>
                        </Stack>
                      </Grid>
                    </Grid>
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
