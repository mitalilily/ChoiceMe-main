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
import type { PreviousProduct } from '../../api/customerHistory'
import { brand } from '../../theme/brand'
import { useState } from 'react'

type ProductHistoryInputProps = {
  value: string
  products: PreviousProduct[]
  loading?: boolean
  error?: boolean
  helperText?: string
  onChange: (value: string) => void
  onBlur: () => void
  onProductSelect: (product: PreviousProduct) => void
}

const filter = createFilterOptions<PreviousProduct>({
  matchFrom: 'any',
  limit: 8,
  stringify: (product) => `${product.productName} ${product.sku} ${product.hsnCode}`,
})

export default function ProductHistoryInput({
  value,
  products,
  loading,
  error,
  helperText,
  onChange,
  onBlur,
  onProductSelect,
}: ProductHistoryInputProps) {
  const [focused, setFocused] = useState(false)

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
        Name<Box component="span" sx={{ ml: 0.5, color: brand.warning }}>*</Box>
      </Typography>

      <Autocomplete<PreviousProduct, false, false, true>
        freeSolo
        open={focused && value.trim().length >= 2}
        options={products}
        filterOptions={filter}
        inputValue={value ?? ''}
        value={null}
        getOptionLabel={(option) => (typeof option === 'string' ? option : option.productName)}
        onInputChange={(_, nextValue, reason) => {
          if (reason !== 'reset') onChange(nextValue)
        }}
        onChange={(_, selected) => {
          if (selected && typeof selected !== 'string') onProductSelect(selected)
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false)
          onBlur()
        }}
        noOptionsText="No matching previous product"
        renderOption={(props, product) => (
          <Box component="li" {...props} key={product.id}>
            <ListItemText
              primary={product.productName}
              secondary={`${product.sku || 'No SKU'} · ₹${product.price} · used in ${product.orderCount} order${product.orderCount === 1 ? '' : 's'}`}
            />
          </Box>
        )}
        renderInput={(params) => (
          <TextField
            {...params}
            required
            error={error}
            helperText={helperText}
            placeholder="Type to match a previous product"
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
              htmlInput: { ...params.inputProps, maxLength: 100 },
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
            }}
          />
        )}
      />
    </Box>
  )
}
