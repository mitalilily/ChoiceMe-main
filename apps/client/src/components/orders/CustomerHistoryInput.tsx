import {
  alpha,
  Autocomplete,
  Box,
  CircularProgress,
  createFilterOptions,
  ListItemText,
  TextField,
  Typography,
} from '@mui/material'
import type { PreviousCustomer } from '../../api/customerHistory'
import { brand } from '../../theme/brand'
import { useState } from 'react'

export type CustomerHistoryField = 'name' | 'phone' | 'pincode' | 'city' | 'address'

type CustomerHistoryInputProps = {
  fieldName: CustomerHistoryField
  label: string
  value: string
  customers: PreviousCustomer[]
  required?: boolean
  loading?: boolean
  error?: boolean
  helperText?: string
  multiline?: boolean
  onChange: (value: string) => void
  onBlur: () => void
  onCustomerSelect: (customer: PreviousCustomer) => void
}

export default function CustomerHistoryInput({
  fieldName,
  label,
  value,
  customers,
  required,
  loading,
  error,
  helperText,
  multiline,
  onChange,
  onBlur,
  onCustomerSelect,
}: CustomerHistoryInputProps) {
  const [focused, setFocused] = useState(false)
  const options = customers.filter((customer) => Boolean(customer[fieldName]))
  const hasSearch = value.trim().length >= 2
  const filter = createFilterOptions<PreviousCustomer>({
    matchFrom: 'any',
    limit: 8,
    stringify: (customer) => customer[fieldName],
  })

  return (
    <Box sx={{ mt: 2, width: '100%' }}>
      <Typography
        sx={{
          mb: 0.9,
          fontSize: '0.74rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          color: brand.inkSoft,
        }}
      >
        {label}
        {required && <Box component="span" sx={{ ml: 0.5, color: brand.warning }}>*</Box>}
      </Typography>

      <Autocomplete<PreviousCustomer, false, false, true>
        freeSolo
        open={focused && hasSearch}
        options={options}
        filterOptions={filter}
        inputValue={value ?? ''}
        value={null}
        getOptionLabel={(option) => (typeof option === 'string' ? option : option[fieldName])}
        isOptionEqualToValue={(option, selected) =>
          typeof selected !== 'string' && option.id === selected.id
        }
        onInputChange={(_, nextValue, reason) => {
          if (reason !== 'reset') onChange(nextValue)
        }}
        onChange={(_, selected) => {
          if (selected && typeof selected !== 'string') onCustomerSelect(selected)
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false)
          onBlur()
        }}
        noOptionsText="No matching previous customer"
        renderOption={(props, customer) => (
          <Box component="li" {...props} key={`${customer.id}-${fieldName}`}>
            <ListItemText
              primary={customer[fieldName]}
              secondary={`${customer.name} · ${customer.phone} · ${customer.city}, ${customer.pincode}`}
            />
          </Box>
        )}
        renderInput={(params) => (
          <TextField
            {...params}
            required={required}
            error={error}
            helperText={helperText}
            multiline={multiline}
            rows={multiline ? 2 : undefined}
            placeholder="Type"
            slotProps={{
              input: {
                ...params.InputProps,
                endAdornment: (
                  <>
                    {loading ? <CircularProgress size={16} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              },
              htmlInput: {
                ...params.inputProps,
                maxLength: multiline ? 200 : 100,
              },
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '24px',
                bgcolor: '#FFFFFF',
                backgroundImage:
                  'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,251,255,0.98) 100%)',
                boxShadow: '0 10px 24px rgba(15,44,67,0.045)',
                '& fieldset': { borderColor: alpha(brand.ink, 0.1) },
                '&:hover fieldset': { borderColor: alpha(brand.ink, 0.24) },
              },
              '& .MuiInputBase-input': {
                color: brand.ink,
                fontWeight: 600,
                fontSize: '0.94rem',
              },
              '& .MuiFormHelperText-root': {
                ml: 0.3,
                mt: 0.75,
                fontWeight: 600,
                fontSize: '0.76rem',
              },
            }}
          />
        )}
      />
    </Box>
  )
}
