import { Box, FormControlLabel, Radio, RadioGroup, Stack, Typography } from '@mui/material'
import { Controller, useFormContext } from 'react-hook-form'
import { usePaymentOptions } from '../../hooks/usePaymentOptions'
import type { B2CFormData } from './b2c/B2COrderForm'

export default function PaymentModeSelector() {
  const { control } = useFormContext<B2CFormData>()
  const { data: options } = usePaymentOptions()
  const modes = [
    {
      value: 'prepaid',
      label: 'Prepaid',
      caption: 'Paid online',
      enabled: options?.prepaidEnabled !== false,
    },
    {
      value: 'cod',
      label: 'Cash on Delivery',
      caption: 'Pay on delivery',
      enabled: options?.codEnabled !== false,
    },
  ].filter((mode) => mode.enabled)
  return (
    <Box>
      <Typography variant="body2" fontWeight={750} mb={1}>
        Payment mode{' '}
        <Typography component="span" variant="caption" color="text.secondary">
          · select the method chosen by your buyer
        </Typography>
      </Typography>
      <Controller
        name="orderType"
        control={control}
        rules={{ required: 'Select a payment mode' }}
        render={({ field, fieldState }) => (
          <>
            <RadioGroup
              {...field}
              aria-label="Payment mode"
              sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}
            >
              {modes.map((mode) => (
                <FormControlLabel
                  key={mode.value}
                  value={mode.value}
                  control={<Radio size="small" />}
                  sx={{
                    m: 0,
                    p: 1.25,
                    border:
                      field.value === mode.value ? '1.5px solid #0D3B8E' : '1px solid #DFE6EF',
                    borderRadius: 2,
                    bgcolor: field.value === mode.value ? '#F1F6FF' : '#fff',
                    alignItems: 'center',
                  }}
                  label={
                    <Stack>
                      <Typography variant="body2" fontWeight={750}>
                        {mode.label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {mode.caption}
                      </Typography>
                    </Stack>
                  }
                />
              ))}
            </RadioGroup>
            {fieldState.error && (
              <Typography color="error" variant="caption">
                {fieldState.error.message}
              </Typography>
            )}
          </>
        )}
      />
    </Box>
  )
}
