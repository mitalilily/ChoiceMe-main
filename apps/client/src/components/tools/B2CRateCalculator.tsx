import { Alert, Box, Grid, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { useMemo } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { FiInfo } from 'react-icons/fi'
import { TbRulerMeasure, TbScale } from 'react-icons/tb'
import { brand } from '../../theme/brand'
import { kgToGrams, MIN_B2C_CHARGEABLE_WEIGHT_GRAMS } from '../../utils/weight'
import CustomInput from '../UI/inputs/CustomInput'

export default function B2CRateCalculator() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext()

  const length = useWatch({ control, name: 'length' }) || 0
  const breadth = useWatch({ control, name: 'breadth' }) || 0
  const height = useWatch({ control, name: 'height' }) || 0
  const actualWeightKg = useWatch({ control, name: 'weight' }) || 0

  const volumetricWeightGrams = useMemo(() => {
    const volKg = (Number(length) * Number(breadth) * Number(height)) / 5000
    const volGrams = volKg * 1000
    return isNaN(volGrams) ? 0 : Math.round(volGrams)
  }, [length, breadth, height])

  const applicableWeightGrams = useMemo(() => {
    const actualWeightGrams = kgToGrams(actualWeightKg)
    return Math.max(actualWeightGrams, volumetricWeightGrams, MIN_B2C_CHARGEABLE_WEIGHT_GRAMS)
  }, [actualWeightKg, volumetricWeightGrams])

  const volumetricWeightKg = (volumetricWeightGrams / 1000).toFixed(2)
  const applicableWeightKg = (applicableWeightGrams / 1000).toFixed(2)

  const metricCardSx = {
    p: 2,
    borderRadius: '24px',
    border: `1px solid ${alpha(brand.ink, 0.08)}`,
    backgroundColor: alpha('#FFFFFF', 0.88),
    display: 'flex',
    alignItems: 'center',
    gap: 1.2,
  }

  return (
    <Grid container spacing={1.6}>
      <Grid size={{ xs: 12, md: 6 }}>
        <CustomInput
          label="Actual Weight"
          type="number"
          {...register('weight', {
            required: 'Actual weight is required',
            min: { value: 0.1, message: 'Weight must be greater than 0' },
          })}
          postfix="Kg"
          fullWidth
          error={!!errors.weight}
          helperText={errors.weight?.message as string}
          topMargin={false}
        />
      </Grid>

      <Grid size={{ xs: 12, md: 6 }} display="flex" alignItems="center">
        <Alert
          icon={<FiInfo size={18} />}
          severity="info"
          sx={{
            width: '100%',
            borderRadius: '20px',
            color: brand.ink,
            border: `1px solid ${alpha(brand.accent, 0.22)}`,
            backgroundColor: alpha(brand.accent, 0.08),
          }}
        >
          Minimum chargeable weight is <b>500 g (0.5 Kg)</b>.
        </Alert>
      </Grid>

      <Grid size={{ xs: 12, md: 4 }}>
        <CustomInput
          label="Length (cm)"
          type="number"
          {...register('length', {
            required: 'Length is required',
            min: { value: 1, message: 'Must be greater than 0' },
          })}
          error={!!errors.length}
          helperText={errors.length?.message as string}
          fullWidth
        />
      </Grid>
      <Grid size={{ xs: 12, md: 4 }}>
        <CustomInput
          label="Breadth (cm)"
          type="number"
          {...register('breadth', {
            required: 'Breadth is required',
            min: { value: 1, message: 'Must be greater than 0' },
          })}
          error={!!errors.breadth}
          helperText={errors.breadth?.message as string}
          fullWidth
        />
      </Grid>
      <Grid size={{ xs: 12, md: 4 }}>
        <CustomInput
          label="Height (cm)"
          type="number"
          {...register('height', {
            required: 'Height is required',
            min: { value: 1, message: 'Must be greater than 0' },
          })}
          error={!!errors.height}
          helperText={errors.height?.message as string}
          fullWidth
        />
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <Box sx={metricCardSx}>
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: '16px',
              display: 'grid',
              placeItems: 'center',
              bgcolor: alpha(brand.accent, 0.14),
              color: brand.accent,
              flexShrink: 0,
            }}
          >
            <TbRulerMeasure size={22} />
          </Box>
          <Box>
            <Typography sx={{ color: brand.inkSoft, fontSize: '0.8rem', fontWeight: 700 }}>
              Volumetric Weight
            </Typography>
            <Typography sx={{ color: brand.ink, fontWeight: 800, fontSize: '1.08rem' }}>
              {volumetricWeightGrams} g ({volumetricWeightKg} Kg)
            </Typography>
          </Box>
        </Box>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <Box sx={metricCardSx}>
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: '16px',
              display: 'grid',
              placeItems: 'center',
              bgcolor: alpha(brand.success, 0.16),
              color: brand.success,
              flexShrink: 0,
            }}
          >
            <TbScale size={22} />
          </Box>
          <Box>
            <Typography sx={{ color: brand.inkSoft, fontSize: '0.8rem', fontWeight: 700 }}>
              Applicable Weight
            </Typography>
            <Typography
              sx={{
                color:
                  applicableWeightGrams === MIN_B2C_CHARGEABLE_WEIGHT_GRAMS
                    ? brand.accent
                    : brand.ink,
                fontWeight: 800,
                fontSize: '1.08rem',
              }}
            >
              {applicableWeightGrams} g ({applicableWeightKg} Kg)
            </Typography>
          </Box>
        </Box>
      </Grid>
    </Grid>
  )
}
