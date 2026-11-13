import { Grid, Stack, TextField } from '@mui/material'
import { useEffect } from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import type { B2CFormData } from './b2c/B2COrderForm'
import WarehouseSelector from './WarehouseSelector'

export default function PickupLocationForm() {
  const { control, getValues, setValue } = useFormContext<B2CFormData>()
  useEffect(() => {
    const today = new Date()
    if (!getValues('pickupDate'))
      setValue(
        'pickupDate',
        `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
      )
    if (!getValues('pickupTime')) setValue('pickupTime', '10:00')
  }, [getValues, setValue])
  return (
    <Stack spacing={2.5}>
      <WarehouseSelector />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Controller
            name="pickupDate"
            control={control}
            rules={{ required: 'Pickup date is required' }}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                fullWidth
                type="date"
                label="Preferred pickup date"
                slotProps={{ inputLabel: { shrink: true } }}
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Controller
            name="pickupTime"
            control={control}
            rules={{ required: 'Pickup time is required' }}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                fullWidth
                type="time"
                label="Preferred pickup time"
                slotProps={{ inputLabel: { shrink: true } }}
                error={!!fieldState.error}
                helperText={fieldState.error?.message ?? 'Local warehouse time'}
              />
            )}
          />
        </Grid>
      </Grid>
    </Stack>
  )
}
