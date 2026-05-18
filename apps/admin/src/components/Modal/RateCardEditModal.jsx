import {
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  FormControl,
  FormLabel,
  Input,
  Select,
  SimpleGrid,
  Stack,
  Text,
} from '@chakra-ui/react'
import { useUpdateShippingRate } from 'hooks/useCouriers'
import { useEffect, useState } from 'react'
import { getCourierDisplayName, getProviderDisplayName } from 'utils/courierDisplay'
import CustomModal from './CustomModal'

const normalizeProvider = (value) => String(value || '').trim().toLowerCase()
const normalizeMode = (value) => {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return ''
  if (['air', 'a', 'express'].includes(raw)) return 'air'
  if (['surface', 's', 'ground'].includes(raw)) return 'surface'
  return raw
}
const makeCourierKey = (courierId, serviceProvider) =>
  `${courierId || ''}__${normalizeProvider(serviceProvider)}`

const providerNameMatchesCourierName = (serviceProvider, courierName) => {
  const provider = normalizeProvider(serviceProvider)
  const name = String(courierName || '').trim().toLowerCase()
  if (!provider || !name) return false
  if (provider === 'deliveryone') {
    return name.includes('delivery one') || name.includes('deliveryone')
  }
  return name.includes(provider)
}

const findCourierOption = (couriers, { courierId, serviceProvider, courierName, courierKey }) => {
  const normalizedId = String(courierId || '')
  const normalizedProvider = normalizeProvider(serviceProvider)
  const normalizedName = String(courierName || '').trim().toLowerCase()

  if (courierKey) {
    const byKey = couriers.find(
      (c) => makeCourierKey(c?.id?.toString(), c?.serviceProvider || c?.service_provider || '') === courierKey,
    )
    if (byKey) return byKey
  }

  const sameId = couriers.filter((c) => String(c?.id || '') === normalizedId)
  if (!sameId.length) return null

  if (normalizedProvider) {
    const byProvider = sameId.find(
      (c) => normalizeProvider(c?.serviceProvider || c?.service_provider || '') === normalizedProvider,
    )
    if (byProvider) return byProvider
  }

  return (
    sameId.find((c) => String(c?.name || '').trim().toLowerCase() === normalizedName) ||
    sameId.find((c) =>
      providerNameMatchesCourierName(c?.serviceProvider || c?.service_provider, courierName),
    ) ||
    (sameId.length === 1 ? sameId[0] : null)
  )
}

const getZoneKey = (zone) => String(zone?.id || zone?.code || zone?.name || '')
const getZoneLookupKeys = (zone) =>
  [
    zone?.id,
    zone?.code,
    zone?.name,
    zone?.code && zone?.name ? `${zone.code} - ${zone.name}` : '',
    zone?.code && zone?.name ? `${zone.name} (${zone.code})` : '',
  ].filter(Boolean)

const getZoneEntry = (collection, zone) => {
  if (!collection) return undefined
  for (const key of getZoneLookupKeys(zone)) {
    if (collection[key] !== undefined) return collection[key]
  }
  return undefined
}

const DEFAULT_COD_SLABS = [
  { amount_from: 0, amount_to: 2000, charge_type: 'flat', charge_value: 40 },
  { amount_from: 2000, amount_to: '', charge_type: 'percent', charge_value: 2 },
]

export const RateCardEditModal = ({
  isOpen,
  onClose,
  data,
  zones = [],
  onSave,
  businessType,
  planId,
  couriers = [], // 👈 pass from parent
  existingRates = [],
}) => {
  const { mutate: updateRate, isPending } = useUpdateShippingRate()
  const [form, setForm] = useState({})
  const resolvedBusinessType = String(
    businessType || data?.business_type || data?.businessType || '',
  )
    .trim()
    .toLowerCase()
  const isB2C = resolvedBusinessType === 'b2c'

  const buildLegacySlabs = (rate, minWeight) => {
    if (rate === undefined || rate === null || rate === '') return []
    const parsedMinWeight = Number(minWeight)
    const legacyWeight = Number.isFinite(parsedMinWeight) && parsedMinWeight > 0 ? parsedMinWeight : ''
    const slab = {
      weight_from: 0,
      weight_to: legacyWeight,
      rate,
    }
    if (legacyWeight) {
      slab.extra_rate = rate
      slab.extra_weight_unit = legacyWeight
    }
    return [slab]
  }

  // Initialize form (new vs edit)
  useEffect(() => {
    const initialForm = {
      courier_name: data?.courier_name ?? '',
      courier_id: data?.courier_id ?? '',
      courier_key: makeCourierKey(
        data?.courier_id ?? '',
        data?.service_provider ?? data?.serviceProvider ?? '',
      ),
      min_weight: data?.min_weight ?? '',
      cod_charges: data?.cod_charges ?? '',
      cod_percent: data?.cod_percent ?? '',
      cod_slabs:
        data?.cod_slabs?.length > 0
          ? data.cod_slabs
          : isB2C
            ? DEFAULT_COD_SLABS
            : [],
      other_charges: data?.other_charges ?? '',
      mode: data?.mode ?? '',
      zone_slabs: {},
    }

    zones.forEach((zone) => {
      const zoneKey = getZoneKey(zone)
      const zoneRates = getZoneEntry(data?.rates, zone) || {}
      const zoneSlabs = getZoneEntry(data?.zone_slabs, zone) || {}
      initialForm[zoneKey] = {
        forward: zoneRates.forward ?? '',
        rto: zoneRates.rto ?? '',
      }
      initialForm.zone_slabs[zoneKey] = {
        forward:
          zoneSlabs.forward?.length > 0
            ? zoneSlabs.forward
            : buildLegacySlabs(zoneRates.forward, data?.min_weight),
        rto:
          zoneSlabs.rto?.length > 0
            ? zoneSlabs.rto
            : buildLegacySlabs(zoneRates.rto, data?.min_weight),
      }
    })

    setForm(initialForm)
  }, [data, zones, isB2C])

  const handleChange = (field, value, type = null) => {
    if (type && form[field]) {
      setForm((prev) => ({
        ...prev,
        [field]: { ...prev[field], [type]: value },
      }))
    } else {
      setForm((prev) => ({ ...prev, [field]: value }))
    }
  }

  const handleSlabChange = (zoneName, type, index, field, value) => {
    setForm((prev) => {
      const next = { ...prev, zone_slabs: { ...(prev.zone_slabs || {}) } }
      const zoneEntry = { ...(next.zone_slabs?.[zoneName] || {}) }
      const slabList = [...(zoneEntry[type] || [])]
      slabList[index] = { ...(slabList[index] || {}), [field]: value }
      zoneEntry[type] = slabList
      next.zone_slabs[zoneName] = zoneEntry
      return next
    })
  }

  const addSlab = (zoneName, type) => {
    setForm((prev) => {
      const next = { ...prev, zone_slabs: { ...(prev.zone_slabs || {}) } }
      const zoneEntry = { ...(next.zone_slabs?.[zoneName] || {}) }
      const slabList = [...(zoneEntry[type] || [])]
      slabList.push({
        weight_from: '',
        weight_to: '',
        rate: '',
        extra_rate: '',
        extra_weight_unit: '',
      })
      zoneEntry[type] = slabList
      next.zone_slabs[zoneName] = zoneEntry
      return next
    })
  }

  const removeSlab = (zoneName, type, index) => {
    setForm((prev) => {
      const next = { ...prev, zone_slabs: { ...(prev.zone_slabs || {}) } }
      const zoneEntry = { ...(next.zone_slabs?.[zoneName] || {}) }
      zoneEntry[type] = (zoneEntry[type] || []).filter((_, slabIndex) => slabIndex !== index)
      next.zone_slabs[zoneName] = zoneEntry
      return next
    })
  }

  const handleCodSlabChange = (index, field, value) => {
    setForm((prev) => {
      const codSlabs = [...(prev.cod_slabs || [])]
      codSlabs[index] = { ...(codSlabs[index] || {}), [field]: value }
      return { ...prev, cod_slabs: codSlabs }
    })
  }

  const addCodSlab = () => {
    setForm((prev) => ({
      ...prev,
      cod_slabs: [
        ...(prev.cod_slabs || []),
        { amount_from: '', amount_to: '', charge_type: 'flat', charge_value: '' },
      ],
    }))
  }

  const removeCodSlab = (index) => {
    setForm((prev) => ({
      ...prev,
      cod_slabs: (prev.cod_slabs || []).filter((_, slabIndex) => slabIndex !== index),
    }))
  }

  const handleSave = () => {
    const resolvedCourierId = form.courier_id || data?.courier_id
    const resolvedMode = String(form.mode || data?.mode || '').trim()

    if (!['b2b', 'b2c'].includes(resolvedBusinessType)) {
      alert('Business type is missing. Please open this rate from the B2B or B2C rate card.')
      return
    }

    if (!resolvedCourierId) {
      alert('Please select a courier before saving rates.')
      return
    }

    if (!resolvedMode) {
      alert('Please select a shipping mode before saving rates.')
      return
    }

    // Build rates per zone
    const rates = {}
    zones.forEach((zone) => {
      const zoneKey = getZoneKey(zone)
      if (isB2C) {
        const forwardSlabs = form.zone_slabs?.[zoneKey]?.forward || []
        const rtoSlabs = form.zone_slabs?.[zoneKey]?.rto || []
        rates[zoneKey] = {
          forward: forwardSlabs[0]?.rate ?? '',
          rto: rtoSlabs[0]?.rate ?? '',
        }
      } else {
        rates[zoneKey] = { ...form[zoneKey] }
      }
    })

    const selectedCourier = findCourierOption(availableCouriers, {
      courierId: form.courier_id || data?.courier_id,
      serviceProvider: data?.service_provider || data?.serviceProvider,
      courierName: form.courier_name || data?.courier_name,
      courierKey: form.courier_key,
    })

    // Always get service_provider from selectedCourier if available, otherwise from data
    const serviceProviderValue =
      selectedCourier?.serviceProvider ||
      selectedCourier?.service_provider ||
      data?.service_provider ||
      data?.serviceProvider ||
      ''

    const payload = {
      min_weight: isB2C ? undefined : form.min_weight,
      cod_charges: form.cod_charges,
      cod_percent: form.cod_percent,
      other_charges: form.other_charges,
      mode: resolvedMode,
      previous_mode: data?.mode,
      courier_id: resolvedCourierId, // from form (create) or existing (edit)
      courier_name: form.courier_name || data?.courier_name,
      service_provider: serviceProviderValue, // Always send the service_provider
      previous_service_provider: data?.service_provider || data?.serviceProvider,
      rates,
      zone_slabs: isB2C ? form.zone_slabs : undefined,
      cod_slabs: isB2C ? form.cod_slabs || [] : undefined,
      businessType: resolvedBusinessType,
    }

    // Validate planId before making the request
    // Ensure planId is a valid string or number, not a boolean or empty string
    let validPlanId = null

    // Check if planId prop is valid (string or number, not boolean, not empty string)
    if (
      planId !== null &&
      planId !== undefined &&
      planId !== '' &&
      planId !== true &&
      planId !== false &&
      (typeof planId === 'string' || typeof planId === 'number')
    ) {
      validPlanId = planId
    } else if (
      data?.plan_id !== null &&
      data?.plan_id !== undefined &&
      data?.plan_id !== '' &&
      data?.plan_id !== true &&
      data?.plan_id !== false &&
      (typeof data.plan_id === 'string' || typeof data.plan_id === 'number')
    ) {
      validPlanId = data.plan_id
    }

    if (!validPlanId) {
      console.error('planId is required but not provided', {
        planId,
        planIdType: typeof planId,
        planIdValue: planId,
        dataPlanId: data?.plan_id,
        dataPlanIdType: typeof data?.plan_id,
        dataPlanIdValue: data?.plan_id,
        data,
      })
      alert('Plan ID is missing. Please select a plan first.')
      return
    }

    // Final safety check: ensure validPlanId is not a boolean
    if (validPlanId === true || validPlanId === false) {
      console.error('Invalid planId: boolean value detected', { validPlanId, planId, data })
      alert('Invalid Plan ID. Please select a plan first.')
      return
    }

    // Ensure planId is converted to string for the API
    const planIdString = String(validPlanId)

    // Final validation: ensure the string is not "true" or "false"
    if (planIdString === 'true' || planIdString === 'false') {
      console.error('Invalid planId: string "true" or "false" detected', {
        planIdString,
        planId,
        data,
      })
      alert('Invalid Plan ID. Please select a plan first.')
      return
    }

    if (onSave) onSave(payload)

    updateRate(
      {
        id: (data?.courier_id ?? payload?.courier_id) || undefined, // pass id only in edit mode
        updates: payload,
        planId: planIdString,
      },
      {
        onSuccess: onClose,
        onError: (error) => {
          console.error('Failed to update shipping rate:', error)
        },
      },
    )
  }

  const isEdit = !!data

  // Filter out couriers that already have rates (based on courier_id + service_provider combination)
  // Create a set of existing combinations for quick lookup
  const existingCombinations = new Set(
    existingRates.map((r) => {
      const courierId = r.courier_id?.toString()
      const serviceProvider = normalizeProvider(r.service_provider || r.serviceProvider || '')
      const mode = normalizeMode(r.mode || '')
      return `${courierId}_${serviceProvider}_${mode}`
    }),
  )

  const availableCouriers = isEdit
    ? couriers // show full list when editing
    : couriers.filter((c) => {
        if (isB2C) return true
        const courierId = c?.id?.toString()
        const serviceProvider = normalizeProvider(c?.serviceProvider || c?.service_provider || '')
        const combination = `${courierId}_${serviceProvider}_`
        return !existingCombinations.has(combination)
      })

  // Get selected courier info for display
  const selectedCourier = findCourierOption(availableCouriers, {
    courierId: form.courier_id || data?.courier_id,
    serviceProvider: data?.service_provider || data?.serviceProvider,
    courierName: form.courier_name || data?.courier_name,
    courierKey: form.courier_key,
  })
  const displayCourierName = form.courier_name || data?.courier_name || ''
  const displayServiceProvider =
    selectedCourier?.serviceProvider ||
    selectedCourier?.service_provider ||
    data?.service_provider ||
    data?.serviceProvider ||
    ''

  return (
    <CustomModal
      isOpen={isOpen}
      onClose={onClose}
      title={`${isEdit ? 'Edit' : 'Add'} Rates`}
      width="min(1400px, 96vw)"
      footer={
        <Stack direction="row" gap={5}>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button colorScheme="green" variant="solid" onClick={handleSave} isLoading={isPending}>
            {isEdit ? 'Save' : 'Add'}
          </Button>
        </Stack>
      }
    >
      {/* Display Selected Courier & Service Provider Info */}
      {(displayCourierName || isEdit) && (
        <Box
          mb={4}
          p={4}
          bg={isEdit ? 'purple.50' : 'blue.50'}
          borderRadius="md"
          border="1px solid"
          borderColor={isEdit ? 'purple.200' : 'blue.200'}
        >
          <Text fontWeight="bold" fontSize="md" mb={2} color={isEdit ? 'purple.700' : 'blue.700'}>
            {isEdit ? 'Current Rate Information' : 'Selected Courier Information'}
          </Text>
          <Stack spacing={2}>
            <Flex align="center" gap={2}>
              <Text fontWeight="semibold" fontSize="sm" color="gray.700">
                Courier Name:
              </Text>
              <Badge colorScheme="blue" fontSize="sm" px={2} py={1}>
                {getCourierDisplayName({
                  courier_name: displayCourierName,
                  service_provider: displayServiceProvider,
                })}
              </Badge>
            </Flex>
            <Flex align="center" gap={2}>
              <Text fontWeight="semibold" fontSize="sm" color="gray.700">
                Service Provider:
              </Text>
              <Badge colorScheme="green" fontSize="sm" px={2} py={1}>
                {getProviderDisplayName(displayServiceProvider)}
              </Badge>
            </Flex>
          </Stack>
        </Box>
      )}

      {/* Courier Selector (Add Mode) */}
      {!isEdit && (
        <Box mb={6}>
          <FormControl isRequired>
            <FormLabel>Select Courier</FormLabel>
            <Select
              placeholder="Select a courier..."
              value={form.courier_key}
              onChange={(e) => {
                const courierKey = e.target.value
                const selectedCourier = couriers.find(
                  (c) =>
                    makeCourierKey(c.id?.toString(), c.serviceProvider || c.service_provider || '') ===
                    courierKey,
                )
                const courierId = selectedCourier?.id?.toString() || ''
                const courierName = selectedCourier?.name || ''
                handleChange('courier_key', courierKey)
                handleChange('courier_id', courierId)
                handleChange('courier_name', courierName)
                // service_provider will be set from selectedCourier in handleSave
              }}
            >
              {availableCouriers.map((c) => (
                <option
                  key={makeCourierKey(c.id, c.serviceProvider || c.service_provider || '')}
                  value={makeCourierKey(c.id, c.serviceProvider || c.service_provider || '')}
                >
                  {getCourierDisplayName(c)}{' '}
                  {c.serviceProvider ? `(${getProviderDisplayName(c.serviceProvider)})` : ''}
                </option>
              ))}
            </Select>
            <Text fontSize="xs" color="gray.500" mt={1}>
              Select the courier for which you want to add rates. Service provider will be
              automatically assigned.
            </Text>
          </FormControl>
        </Box>
      )}

      {/* Global fields */}
      <Box mb={6}>
        <Text fontWeight="bold" mb={2}>
          Courier Info
        </Text>
        <SimpleGrid columns={2} spacing={4}>
          <FormControl isRequired>
            <FormLabel>Mode</FormLabel>
            <Select
              placeholder="Select mode..."
              value={form.mode}
              onChange={(e) => handleChange('mode', e.target.value)}
            >
              <option value="air">Air</option>
              <option value="surface">Surface</option>
            </Select>
          </FormControl>
          {!isB2C && (
            <FormControl>
              <FormLabel>Min Weight (kg)</FormLabel>
              <Input
                type="number"
                value={form.min_weight}
                onChange={(e) => handleChange('min_weight', e.target.value)}
              />
            </FormControl>
          )}
          <FormControl>
            <FormLabel>COD Charges</FormLabel>
            <Input
              type="number"
              value={form.cod_charges}
              onChange={(e) => handleChange('cod_charges', e.target.value)}
            />
          </FormControl>
          <FormControl>
            <FormLabel>COD Percent</FormLabel>
            <Input
              type="number"
              value={form.cod_percent}
              onChange={(e) => handleChange('cod_percent', e.target.value)}
            />
          </FormControl>
          <FormControl>
            <FormLabel>Other Charges</FormLabel>
            <Input
              type="number"
              value={form.other_charges}
              onChange={(e) => handleChange('other_charges', e.target.value)}
            />
          </FormControl>
        </SimpleGrid>
      </Box>

      <Divider mb={4} />

      {isB2C && (
        <Box
          mb={5}
          p={4}
          bg="blue.50"
          borderRadius="md"
          border="1px solid"
          borderColor="blue.200"
        >
          <Flex align="center" justify="space-between" mb={3}>
            <Box>
              <Text fontWeight="bold" color="blue.800">
                COD Price Slabs
              </Text>
              <Text fontSize="sm" color="blue.900">
                Applied to all B2C zone rows for this courier, mode, provider, and plan.
              </Text>
            </Box>
            <Button size="xs" colorScheme="blue" onClick={addCodSlab}>
              Add COD Slab
            </Button>
          </Flex>
          <Stack spacing={3}>
            {(form.cod_slabs || []).map((slab, index) => (
              <SimpleGrid
                key={`cod-slab-${index}`}
                columns={{ base: 1, md: 2, xl: 5 }}
                spacing={3}
              >
                <FormControl>
                  <FormLabel>Order Value From</FormLabel>
                  <Input
                    type="number"
                    value={slab.amount_from ?? ''}
                    onChange={(e) => handleCodSlabChange(index, 'amount_from', e.target.value)}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Order Value To</FormLabel>
                  <Input
                    type="number"
                    value={slab.amount_to ?? ''}
                    placeholder="Open ended"
                    onChange={(e) => handleCodSlabChange(index, 'amount_to', e.target.value)}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Charge Type</FormLabel>
                  <Select
                    value={slab.charge_type || 'flat'}
                    onChange={(e) => handleCodSlabChange(index, 'charge_type', e.target.value)}
                  >
                    <option value="flat">Flat Amount</option>
                    <option value="percent">Percent</option>
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel>Charge Value</FormLabel>
                  <Input
                    type="number"
                    value={slab.charge_value ?? ''}
                    onChange={(e) => handleCodSlabChange(index, 'charge_value', e.target.value)}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>&nbsp;</FormLabel>
                  <Button colorScheme="red" variant="outline" onClick={() => removeCodSlab(index)}>
                    Remove
                  </Button>
                </FormControl>
              </SimpleGrid>
            ))}
            {(!form.cod_slabs || form.cod_slabs.length === 0) && (
              <Text fontSize="sm" color="gray.500">
                No COD slabs added. Legacy COD Charges and COD Percent will be used as fallback.
              </Text>
            )}
          </Stack>
        </Box>
      )}

      <Divider mb={4} />

      {isB2C && (
        <Box
          mb={5}
          p={4}
          bg="orange.50"
          borderRadius="md"
          border="1px solid"
          borderColor="orange.200"
        >
          <Text fontWeight="bold" color="orange.800" mb={2}>
            How Slab Pricing Works
          </Text>
          <Stack spacing={1} fontSize="sm" color="orange.900">
            <Text>1. Add slabs in increasing order of weight.</Text>
            <Text>2. Slabs can have gaps, but overlapping slabs are not allowed.</Text>
            <Text>3. If order weight falls in a gap, this courier will not appear.</Text>
            <Text>
              4. If order weight goes above the last slab, extra charges are added using Extra Rate
              and Extra Unit of that last slab.
            </Text>
            <Text>5. Courier name shown to user will use that matched slab&apos;s max weight.</Text>
          </Stack>
        </Box>
      )}

      {/* Zone-wise grouped inputs */}
      <Stack spacing={4}>
        {zones.map((zone) => {
          const zoneKey = getZoneKey(zone)
          return (
          <Box key={zoneKey} p={3} border="1px solid" borderColor="gray.200" borderRadius="md">
            <Text fontWeight="bold" mb={2}>
              {zone.name}
            </Text>
            {isB2C ? (
              <Stack spacing={4}>
                {['forward', 'rto'].map((type) => (
                  <Box key={type} p={3} bg="gray.50" borderRadius="md">
                    <Flex align="center" justify="space-between" mb={3}>
                      <Box>
                        <Text fontWeight="semibold" textTransform="uppercase">
                          {type}
                        </Text>
                        <Text fontSize="xs" color="gray.500">
                          Example: `0-0.5`, `0.5-2`, `5-10`
                        </Text>
                      </Box>
                      <Button size="xs" onClick={() => addSlab(zoneKey, type)}>
                        Add Slab
                      </Button>
                    </Flex>
                    <Stack spacing={3}>
                      {(form.zone_slabs?.[zoneKey]?.[type] || []).map((slab, index, slabList) => {
                        const isLastSlab = index === slabList.length - 1
                        return (
                        <SimpleGrid
                          key={`${zone.name}-${type}-${index}`}
                          columns={{ base: 1, md: 2, xl: 6 }}
                          spacing={3}
                        >
                          <FormControl>
                            <FormLabel>From Weight (kg)</FormLabel>
                            <Input
                              type="number"
                              value={slab.weight_from ?? ''}
                              onChange={(e) =>
                                handleSlabChange(zoneKey, type, index, 'weight_from', e.target.value)
                              }
                            />
                          </FormControl>
                          <FormControl>
                            <FormLabel>To Weight (kg)</FormLabel>
                            <Input
                              type="number"
                              value={slab.weight_to ?? ''}
                              onChange={(e) =>
                                handleSlabChange(zoneKey, type, index, 'weight_to', e.target.value)
                              }
                            />
                          </FormControl>
                          <FormControl>
                            <FormLabel>Base Rate</FormLabel>
                            <Input
                              type="number"
                              value={slab.rate ?? ''}
                              onChange={(e) =>
                                handleSlabChange(zoneKey, type, index, 'rate', e.target.value)
                              }
                            />
                          </FormControl>
                          <FormControl>
                            <FormLabel>Above Last Slab Charge</FormLabel>
                            <Input
                              type="number"
                              value={slab.extra_rate ?? ''}
                              isDisabled={!isLastSlab}
                              onChange={(e) =>
                                handleSlabChange(zoneKey, type, index, 'extra_rate', e.target.value)
                              }
                            />
                            <Text fontSize="xs" color="gray.500" mt={1}>
                              {isLastSlab
                                ? 'Extra amount added after this final slab.'
                                : 'Available only on the final slab.'}
                            </Text>
                          </FormControl>
                          <FormControl>
                            <FormLabel>Per Extra Weight (kg)</FormLabel>
                            <Input
                              type="number"
                              value={slab.extra_weight_unit ?? ''}
                              isDisabled={!isLastSlab}
                              onChange={(e) =>
                                handleSlabChange(
                                  zoneKey,
                                  type,
                                  index,
                                  'extra_weight_unit',
                                  e.target.value,
                                )
                              }
                            />
                            <Text fontSize="xs" color="gray.500" mt={1}>
                              {isLastSlab
                                ? 'Example: `1` means add the above charge for every extra 1 kg.'
                                : 'Non-final slabs do not use extra weight pricing.'}
                            </Text>
                          </FormControl>
                          <FormControl>
                            <FormLabel>&nbsp;</FormLabel>
                            <Button
                              colorScheme="red"
                              variant="outline"
                              onClick={() => removeSlab(zoneKey, type, index)}
                            >
                              Remove
                            </Button>
                          </FormControl>
                        </SimpleGrid>
                      )})}
                      {(!form.zone_slabs?.[zoneKey]?.[type] ||
                        form.zone_slabs?.[zoneKey]?.[type]?.length === 0) && (
                        <Text fontSize="sm" color="gray.500">
                          No slabs added.
                        </Text>
                      )}
                    </Stack>
                  </Box>
                ))}
              </Stack>
            ) : (
              <SimpleGrid columns={2} spacing={4}>
                <FormControl>
                  <FormLabel>Forward</FormLabel>
                  <Input
                    type="number"
                    value={form[zoneKey]?.forward ?? ''}
                    onChange={(e) => handleChange(zoneKey, e.target.value, 'forward')}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>RTO</FormLabel>
                  <Input
                    type="number"
                    value={form[zoneKey]?.rto ?? ''}
                    onChange={(e) => handleChange(zoneKey, e.target.value, 'rto')}
                  />
                </FormControl>
              </SimpleGrid>
            )}
          </Box>
        )})}
      </Stack>
    </CustomModal>
  )
}
