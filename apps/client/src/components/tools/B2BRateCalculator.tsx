import { Box, Grid, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { useFormContext } from 'react-hook-form'
import { brand } from '../../theme/brand'
import CustomInput from '../UI/inputs/CustomInput'

export default function B2BRateCalculator() {
  const { register } = useFormContext()

  return (
    <Grid container spacing={1.6}>
      <Grid size={{ xs: 12, md: 6 }}>
        <CustomInput label="Total Weight (kg)" {...register('totalWeight')} fullWidth topMargin={false} />
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <CustomInput label="Number of Boxes" {...register('numberOfBoxes')} fullWidth topMargin={false} />
      </Grid>

      <Grid size={{ xs: 12 }}>
        <Box
          sx={{
            p: 2,
            borderRadius: '22px',
            border: `1px solid ${alpha(brand.ink, 0.08)}`,
            bgcolor: alpha('#FFFFFF', 0.84),
          }}
        >
          <Typography sx={{ color: brand.ink, fontWeight: 700 }}>B2B shipment note</Typography>
          <Typography sx={{ mt: 0.7, color: brand.inkSoft, lineHeight: 1.72 }}>
            Enter the combined shipment weight and total box count. The existing backend courier logic and rate lookup remain unchanged.
          </Typography>
        </Box>
      </Grid>
    </Grid>
  )
}
