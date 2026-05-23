import { useEffect, useState } from 'react'
import type { UseFormClearErrors, UseFormSetError, UseFormSetValue } from 'react-hook-form'
import { fetchLocations } from '../../api/locations'

export function usePincodeLookup(
  pincode: string,
  type: 'pickup' | 'delivery',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setValue: UseFormSetValue<any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setError: UseFormSetError<any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clearErrors: UseFormClearErrors<any>,
) {
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let isCurrentLookup = true

    async function fetchLocation() {
      const normalizedPincode = String(pincode ?? '').trim()

      if (!/^[1-9][0-9]{5}$/.test(normalizedPincode)) {
        clearErrors(`${type}Pincode`)
        setValue(`${type}City`, '')
        setValue(`${type}State`, '')
        return
      }

      setLoading(true)
      try {
        const data = await fetchLocations({ pincode: normalizedPincode, limit: 1 })
        if (!isCurrentLookup) return

        const loc = data?.data?.[0]

        if (!loc?.city || !loc?.state) {
          setError(`${type}Pincode`, {
            type: 'manual',
            message: `Invalid ${type} pincode`,
          })
          setValue(`${type}City`, '')
          setValue(`${type}State`, '')
        } else {
          clearErrors(`${type}Pincode`)
          setValue(`${type}City`, loc.city || '', { shouldValidate: true })
          setValue(`${type}State`, loc.state || '', { shouldValidate: true })
        }
      } catch {
        if (!isCurrentLookup) return
        setError(`${type}Pincode`, {
          type: 'manual',
          message: `Failed to fetch ${type} location`,
        })
        setValue(`${type}City`, '')
        setValue(`${type}State`, '')
      } finally {
        if (isCurrentLookup) setLoading(false)
      }
    }

    fetchLocation()

    return () => {
      isCurrentLookup = false
    }
  }, [pincode, type, setValue, setError, clearErrors])

  return loading
}
