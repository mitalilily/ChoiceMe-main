import {
  Alert,
  Autocomplete,
  Box,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useEffect, useRef } from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import { usePickupAddresses } from '../../hooks/Pickup/usePickupAddresses'
import type { HydratedPickup } from '../../types/generic.types'
import type { B2CFormData } from './b2c/B2COrderForm'

export const warehouseSearchText = (location: HydratedPickup) =>
  [
    location.pickup?.addressNickname,
    location.pickup?.addressLine1,
    location.pickup?.addressLine2,
    location.pickup?.city,
    location.pickup?.state,
    location.pickup?.pincode,
    location.pickup?.contactName,
    location.pickup?.contactPhone,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

export default function WarehouseSelector({
  compact = false,
  disabled = false,
}: {
  compact?: boolean
  disabled?: boolean
}) {
  const { control, getValues, setValue } = useFormContext<B2CFormData>()
  const { data, isLoading, isError } = usePickupAddresses({
    page: 1,
    limit: 500,
    isPickupEnabled: 'active' as unknown as boolean,
  })
  const locations = data?.pickupAddresses ?? []
  const initialized = useRef(false)

  const selectLocation = (location: HydratedPickup, invalidateQuote: boolean) => {
    const pickup = location.pickup
    const rto = location.isRTOSame ? pickup : location.rto
    const values = {
      pickupLocationId: location.pickupId,
      pickupLocationPincode: pickup.pincode,
      pickupLocationName: pickup.addressNickname,
      pickupLocationPOCName: pickup.contactName,
      pickupLocationPOCPhone: pickup.contactPhone,
      pickupAddress: [pickup.addressLine1, pickup.addressLine2].filter(Boolean).join(', '),
      pickupCity: pickup.city,
      pickupState: pickup.state,
      isRtoSame: location.isRTOSame,
      rtoLocationPincode: rto?.pincode ?? '',
      rtoLocationName: rto?.addressNickname ?? '',
      rtoLocationPOCName: rto?.contactName ?? '',
      rtoLocationPOCPhone: rto?.contactPhone ?? '',
      rtoAddress: [rto?.addressLine1, rto?.addressLine2].filter(Boolean).join(', '),
      rtoCity: rto?.city ?? '',
      rtoState: rto?.state ?? '',
    }
    for (const [key, value] of Object.entries(values)) {
      setValue(key as keyof B2CFormData, value ?? '', {
        shouldDirty: invalidateQuote,
        shouldValidate: true,
      })
    }
    if (invalidateQuote) {
      setValue('courierPartnerId', '')
      setValue('courierPartner', '')
      setValue('courierOptionKey', '')
      setValue('selectedMaxSlabWeight', null)
      setValue('courierCost', null)
      setValue('forwardCharges', 0)
      setValue('courierCod', 0)
      setValue('otherCharges', 0)
      setValue('chargeableWeight', null)
      setValue('volumetricWeight', null)
    }
  }

  useEffect(() => {
    if (initialized.current || !locations.length) return
    initialized.current = true
    if (getValues('pickupLocationId')) return
    selectLocation(locations.find((location) => location.isPrimary) ?? locations[0], false)
    // Keep the edited order's choice and never reset it after a refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locations, getValues])

  if (isError) return <Alert severity="error">Unable to load warehouses. Please retry.</Alert>

  return (
    <Controller
      name="pickupLocationId"
      control={control}
      rules={{
        required: 'Please select a pickup warehouse',
        validate: (value) =>
          (!isLoading && locations.some((location) => location.pickupId === value)) ||
          'Select an available active warehouse',
      }}
      render={({ field, fieldState }) => {
        const selected = locations.find((location) => location.pickupId === field.value) ?? null
        return (
          <Stack spacing={1.5} sx={{ minWidth: 0, width: '100%' }}>
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
              <Typography fontWeight={750} color="#102A54">
                Pickup warehouse
              </Typography>
              <Chip size="small" variant="outlined" label={`${data?.totalCount ?? 0} available`} />
            </Stack>
            <Autocomplete<HydratedPickup, false, true, false>
              options={locations}
              value={selected ?? undefined}
              loading={isLoading}
              disabled={disabled}
              fullWidth
              disableClearable
              isOptionEqualToValue={(option, value) => option.pickupId === value.pickupId}
              getOptionLabel={(location) =>
                [
                  location.pickup.addressNickname || location.pickup.contactName,
                  location.pickup.city,
                  location.pickup.pincode,
                ]
                  .filter(Boolean)
                  .join(' · ')
              }
              filterOptions={(options, state) => {
                const terms = state.inputValue.toLowerCase().trim().split(/\s+/).filter(Boolean)
                return options.filter((option) =>
                  terms.every((term) => warehouseSearchText(option).includes(term)),
                )
              }}
              onChange={(_, location) => {
                if (location) selectLocation(location, true)
              }}
              noOptionsText="No matching active warehouse"
              renderOption={(props, location) => {
                const { key: _key, ...optionProps } = props
                return (
                  <Box
                    component="li"
                    {...optionProps}
                    key={location.pickupId}
                    sx={{ py: '10px !important', display: 'block !important' }}
                  >
                    <Typography fontWeight={700} variant="body2">
                      {location.pickup.addressNickname || location.pickup.contactName}
                      {location.isPrimary ? ' · Primary' : ''}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {location.pickup.city}, {location.pickup.state} · {location.pickup.pincode}
                    </Typography>
                  </Box>
                )
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Search and select warehouse"
                  placeholder="Name, city, pincode or phone"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  slotProps={{
                    input: {
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {isLoading && <CircularProgress size={18} />}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    },
                  }}
                />
              )}
            />
            {field.value && !selected && !isLoading && (
              <Alert severity="warning">
                The order's warehouse is unavailable. Select an active warehouse before booking.
              </Alert>
            )}
            {selected && (
              <Paper
                variant="outlined"
                sx={{
                  p: compact ? 1.5 : 2,
                  borderRadius: 2.5,
                  bgcolor: '#F6F8FC',
                  borderColor: '#DFE6F0',
                }}
              >
                <Stack spacing={0.5}>
                  <Typography variant="body2" fontWeight={700}>
                    {selected.pickup.addressNickname || selected.pickup.contactName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {[
                      selected.pickup.addressLine1,
                      selected.pickup.addressLine2,
                      selected.pickup.city,
                      selected.pickup.state,
                      selected.pickup.pincode,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {selected.pickup.contactName} · {selected.pickup.contactPhone}
                  </Typography>
                  {!compact && (
                    <Typography variant="caption" color="text.secondary">
                      {selected.isRTOSame
                        ? 'Returns use this pickup address.'
                        : `Return address: ${[selected.rto?.addressLine1, selected.rto?.city, selected.rto?.pincode].filter(Boolean).join(', ')}`}
                    </Typography>
                  )}
                </Stack>
              </Paper>
            )}
          </Stack>
        )
      }}
    />
  )
}
