import { CircularProgress, Grid } from '@mui/material'
import { useEffect } from 'react'
import { Controller, type FieldErrors, useFormContext } from 'react-hook-form'
import type { PreviousCustomer } from '../../api/customerHistory'
import { useCustomerHistory } from '../../hooks/useCustomerHistory'
import { useLocations } from '../../hooks/useLocations'
import CustomInput from '../UI/inputs/CustomInput'
import type { B2BFormData } from './b2b/B2BOrderForm'
import type { B2CFormData } from './b2c/B2COrderForm'
import CustomerHistoryInput, { type CustomerHistoryField } from './CustomerHistoryInput'

type FormType = 'b2b' | 'b2c'

const DeliveryDetailsForm = ({ type = 'b2c' }: { type?: FormType }) => {
  const {
    control,
    setValue,
    watch,
    setError,
    clearErrors,
    formState: { errors },
  } = useFormContext<B2CFormData | B2BFormData>()

  const pincode = watch('pincode')
  const normalizedPincode = String(pincode ?? '').trim()
  const { data: customerHistory, isLoading: customerHistoryLoading } = useCustomerHistory()

  const {
    data: locationData,
    isFetching: pinFetching,
    isError,
  } = useLocations(
    { pincode: normalizedPincode, limit: 1 },
    Boolean(/^[1-9][0-9]{5}$/.test(normalizedPincode)),
    ['locationLookup', normalizedPincode],
  )

  useEffect(() => {
    if (!/^[1-9][0-9]{5}$/.test(normalizedPincode)) return

    if (isError) {
      setError('pincode', { type: 'manual', message: 'PIN lookup failed' })
      return
    }

    if (locationData) {
      const city = locationData?.data?.[0]?.city
      const state = locationData?.data?.[0]?.state

      if (!city || !state) {
        setError('pincode', { type: 'manual', message: 'Invalid pincode' })
      } else {
        clearErrors('pincode')
        setValue('city', city, { shouldValidate: true })
        setValue('state', state, { shouldValidate: true })
      }
    }
  }, [locationData, isError, normalizedPincode, setError, clearErrors, setValue])

  const fields = [
    { name: 'buyerName', label: 'Name' },
    { name: 'buyerPhone', label: 'Phone' },
    { name: 'buyerEmail', label: 'Email' },
    { name: 'pincode', label: 'Pincode' },
    { name: 'city', label: 'City' },
    { name: 'state', label: 'State' },
    { name: 'address', label: 'Address' },
    ...(type === 'b2b'
      ? [
          { name: 'companyName', label: 'Company Name' },
          { name: 'gstin', label: 'GSTIN (Optional)' },
        ]
      : []),
  ] as const

  const customerFieldMap: Record<string, CustomerHistoryField | undefined> = {
    buyerName: 'name',
    buyerPhone: 'phone',
    pincode: 'pincode',
    city: 'city',
    address: 'address',
  }

  const getFieldError = (fieldName: string) =>
    (errors as FieldErrors<B2CFormData & B2BFormData>)[
      fieldName as keyof (B2CFormData & B2BFormData)
    ]?.message

  const applyPreviousCustomer = (customer: PreviousCustomer) => {
    const values: Record<string, string> = {
      buyerName: customer.name,
      buyerPhone: customer.phone,
      buyerEmail: customer.email,
      pincode: customer.pincode,
      city: customer.city,
      state: customer.state,
      address: customer.address,
      country: customer.country || 'India',
      companyName: customer.companyName,
      gstin: customer.gstin,
    }

    Object.entries(values).forEach(([fieldName, value]) => {
      setValue(fieldName as keyof (B2CFormData & B2BFormData), value, {
        shouldDirty: true,
        shouldValidate: true,
      })
    })
  }

  return (
    <Grid container spacing={2}>
      {fields.map((fieldItem) => {
        const isNonEditable = fieldItem.name === 'state'
        const showLoader = fieldItem.name === 'pincode' ? pinFetching : false
        const customerField = customerFieldMap[fieldItem.name]

        return (
          <Grid key={fieldItem.name} size={{ xs: 12, md: fieldItem.name === 'address' ? 12 : 4 }}>
            <Controller
              name={fieldItem.name as keyof (B2CFormData & B2BFormData)}
              control={control}
              rules={{
                ...(fieldItem.name !== 'gstin' && fieldItem.name !== 'buyerEmail'
                  ? { required: `${fieldItem.label} is required` }
                  : {}),
                ...(fieldItem.name === 'buyerPhone' && {
                  pattern: { value: /^[0-9]{10}$/, message: 'Enter valid 10-digit phone' },
                }),
                ...(fieldItem.name === 'pincode' && {
                  pattern: { value: /^\d{6}$/, message: 'Enter 6-digit pincode' },
                }),
              }}
              render={({ field }) =>
                customerField ? (
                  <CustomerHistoryInput
                    fieldName={customerField}
                    label={fieldItem.label}
                    value={String(field.value ?? '')}
                    customers={customerHistory?.customers ?? []}
                    required
                    loading={customerHistoryLoading || showLoader}
                    error={!!getFieldError(fieldItem.name)}
                    helperText={getFieldError(fieldItem.name) as string | undefined}
                    multiline={fieldItem.name === 'address'}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    onCustomerSelect={applyPreviousCustomer}
                  />
                ) : (
                  <CustomInput
                    label={fieldItem.label}
                    required={fieldItem.name !== 'buyerEmail' && fieldItem.name !== 'gstin'}
                    {...field}
                    disabled={isNonEditable}
                    error={!!getFieldError(fieldItem.name)}
                    helperText={getFieldError(fieldItem.name)}
                    postfix={showLoader ? <CircularProgress size={16} /> : null}
                  />
                )
              }
            />
          </Grid>
        )
      })}
    </Grid>
  )
}

export default DeliveryDetailsForm
