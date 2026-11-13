import { Box, Button, Collapse, Grid, IconButton, Paper, Stack, Typography } from '@mui/material'
import { useState } from 'react'
import {
  Controller,
  useFormContext,
  useWatch,
  type Control,
  type UseFieldArrayAppend,
  type UseFieldArrayRemove,
} from 'react-hook-form'
import { FaPlus, FaTrash } from 'react-icons/fa'
import CustomInput from '../../UI/inputs/CustomInput'
import ProductHistoryInput from '../ProductHistoryInput'
import { useCustomerHistory } from '../../../hooks/useCustomerHistory'
import type { B2CFormData } from './B2COrderForm'

interface PackageDetailsFormProps {
  control: Control<B2CFormData>
  fields: { id: string }[]
  remove: UseFieldArrayRemove
  append: UseFieldArrayAppend<B2CFormData, 'products'>
}

export default function PackageDetailsForm({
  control,
  fields,
  remove,
  append,
}: PackageDetailsFormProps) {
  const { setValue } = useFormContext<B2CFormData>()
  const products = useWatch({ control, name: 'products' }) ?? []
  const { data: history, isLoading } = useCustomerHistory()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  return (
    <Paper
      variant="outlined"
      sx={{ borderRadius: 2.5, overflow: 'hidden', borderColor: '#E4E9F1', boxShadow: 'none' }}
    >
      <Box
        sx={{
          display: { xs: 'none', md: 'grid' },
          gridTemplateColumns: 'minmax(0, 1fr) 120px 140px 90px 36px',
          gap: 1.5,
          px: 2,
          py: 1.25,
          bgcolor: '#F4F6FA',
        }}
      >
        {['Product name', 'Unit price (₹)', 'Quantity', 'Total', ''].map((label, i) => (
          <Typography
            key={i}
            fontSize={10}
            fontWeight={750}
            color="text.secondary"
            textTransform="uppercase"
          >
            {label}
          </Typography>
        ))}
      </Box>
      {fields.map((item, index) => {
        const product = products[index]
        const total =
          Number(product?.price || 0) * Number(product?.quantity || 0) -
          Number(product?.discount || 0)
        return (
          <Box key={item.id} sx={{ p: 2, borderBottom: '1px solid #E9EDF3' }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr 1fr', md: 'minmax(0, 1fr) 120px 140px 90px 36px' },
                alignItems: 'start',
                gap: 1.5,
              }}
            >
              <Box sx={{ gridColumn: { xs: '1 / -1', md: 'auto' }, minWidth: 0 }}>
                <Controller
                  name={`products.${index}.productName`}
                  control={control}
                  rules={{ required: 'Product name is required' }}
                  render={({ field, fieldState }) => (
                    <ProductHistoryInput
                      value={field.value ?? ''}
                      products={history?.products ?? []}
                      loading={isLoading}
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      onProductSelect={(selected) => {
                        for (const key of [
                          'productName',
                          'price',
                          'quantity',
                          'discount',
                          'taxRate',
                          'hsnCode',
                          'sku',
                        ] as const) {
                          setValue(
                            `products.${index}.${key}`,
                            selected[key] ??
                              (['productName', 'hsnCode', 'sku'].includes(key) ? '' : 0),
                            { shouldDirty: true, shouldValidate: true },
                          )
                        }
                      }}
                    />
                  )}
                />
              </Box>
              <Controller
                name={`products.${index}.price`}
                control={control}
                rules={{ required: 'Price is required', min: { value: 1, message: 'Minimum ₹1' } }}
                render={({ field, fieldState }) => (
                  <CustomInput
                    {...field}
                    label="Unit price (₹)"
                    type="number"
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                    onChange={(event) => field.onChange(Number(event.target.value))}
                  />
                )}
              />
              <Controller
                name={`products.${index}.quantity`}
                control={control}
                rules={{
                  required: 'Quantity is required',
                  min: { value: 1, message: 'Minimum 1' },
                  validate: (value) => Number.isInteger(Number(value)) || 'Use a whole number',
                }}
                render={({ field, fieldState }) => (
                  <Stack spacing={0.5}>
                    <Typography fontSize={12} color="text.secondary">
                      Quantity
                    </Typography>
                    <Stack
                      direction="row"
                      alignItems="center"
                      sx={{ border: '1px solid #DCE3ED', borderRadius: 2, minHeight: 42 }}
                    >
                      <IconButton
                        size="small"
                        aria-label={`Decrease product ${index + 1} quantity`}
                        disabled={Number(field.value) <= 1}
                        onClick={() => field.onChange(Math.max(1, Number(field.value) - 1))}
                      >
                        −
                      </IconButton>
                      <Box
                        component="input"
                        aria-label={`Product ${index + 1} quantity`}
                        type="number"
                        min={1}
                        value={field.value ?? 1}
                        onChange={(event) => field.onChange(Number(event.target.value))}
                        onBlur={field.onBlur}
                        sx={{
                          border: 0,
                          bgcolor: 'transparent',
                          width: '100%',
                          minWidth: 0,
                          textAlign: 'center',
                          fontWeight: 750,
                          MozAppearance: 'textfield',
                          '&::-webkit-inner-spin-button': { WebkitAppearance: 'none' },
                        }}
                      />
                      <IconButton
                        size="small"
                        aria-label={`Increase product ${index + 1} quantity`}
                        onClick={() => field.onChange(Number(field.value || 0) + 1)}
                      >
                        +
                      </IconButton>
                    </Stack>
                    {fieldState.error && (
                      <Typography color="error" variant="caption">
                        {fieldState.error.message}
                      </Typography>
                    )}
                  </Stack>
                )}
              />
              <Typography fontWeight={800} sx={{ alignSelf: 'center', pt: { md: 2 } }}>
                ₹{Math.max(0, total).toFixed(2)}
              </Typography>
              <IconButton
                size="small"
                aria-label={`Remove product ${index + 1}`}
                disabled={fields.length === 1}
                onClick={() => remove(index)}
                sx={{ alignSelf: 'center', justifySelf: 'end', color: '#C94343' }}
              >
                <FaTrash size={12} />
              </IconButton>
            </Box>
            <Button
              size="small"
              onClick={() => setExpanded((state) => ({ ...state, [item.id]: !state[item.id] }))}
              sx={{ textTransform: 'none', mt: 0.5, px: 0 }}
            >
              {expanded[item.id] ? 'Hide additional details' : 'SKU, HSN, tax and discount'}
            </Button>
            <Collapse in={expanded[item.id]}>
              <Grid container spacing={1.5} sx={{ pt: 1 }}>
                {(['sku', 'hsnCode', 'taxRate', 'discount'] as const).map((key) => (
                  <Grid key={key} size={{ xs: 6, md: 3 }}>
                    <Controller
                      name={`products.${index}.${key}`}
                      control={control}
                      render={({ field }) => (
                        <CustomInput
                          {...field}
                          value={field.value ?? ''}
                          type={key === 'discount' || key === 'taxRate' ? 'number' : 'text'}
                          label={
                            {
                              sku: 'SKU',
                              hsnCode: 'HSN code',
                              taxRate: 'Tax (%)',
                              discount: 'Discount (₹)',
                            }[key]
                          }
                        />
                      )}
                    />
                  </Grid>
                ))}
              </Grid>
            </Collapse>
          </Box>
        )
      })}
      <Button
        startIcon={<FaPlus size={11} />}
        onClick={() => append({ productName: '', price: 0, quantity: 1 })}
        sx={{ m: 1, textTransform: 'none' }}
      >
        Add another product
      </Button>
    </Paper>
  )
}
