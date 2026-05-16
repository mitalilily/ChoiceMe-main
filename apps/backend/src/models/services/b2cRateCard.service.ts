import { and, asc, eq, inArray } from 'drizzle-orm'
import { db } from '../client'
import { shippingRates, shippingRateCodSlabs, shippingRateSlabs } from '../schema/shippingRates'
import { calculateFreight } from './pricing/chargeableFreight'
import { normalizeServiceProviderKey } from '../../utils/courierProviders'

export interface RateCardSlabInput {
  weight_from: number
  weight_to?: number | null
  rate: number
  extra_rate?: number | null
  extra_weight_unit?: number | null
}

export interface CodSlabInput {
  amount_from?: number | string
  amount_to?: number | string | null
  charge_type?: 'flat' | 'percent' | string
  charge_value?: number | string
  from?: number | string
  to?: number | string | null
  type?: 'flat' | 'percent' | string
  value?: number | string
}

export interface ResolvedRateCardSlab {
  id?: string
  weight_from: number
  weight_to: number | null
  rate: number
  extra_rate: number | null
  extra_weight_unit: number | null
}

export interface ResolvedCodSlab {
  id?: string
  amount_from: number
  amount_to: number | null
  charge_type: 'flat' | 'percent'
  charge_value: number
}

export interface ResolvedB2CRateCard {
  shippingRateId: string
  courier_id: number
  service_provider: string | null
  zone_id: string
  type: string
  mode: string
  cod_charges: number
  cod_percent: number
  other_charges: number
  min_weight: number
  base_rate: number
  slabs: ResolvedRateCardSlab[]
  cod_slabs: ResolvedCodSlab[]
}

export interface ComputedCodCharge {
  cod_charges: number
  cod_charge_basis: number
  cod_charge_source: 'slab' | 'legacy' | 'prepaid'
  selected_cod_slab: ResolvedCodSlab | null
}

export interface ComputedB2CRateCardCharge {
  actual_weight: number
  volumetric_weight: number
  chargeable_weight: number
  slabs: number | null
  freight: number
  slab_weight: number | null
  base_price: number
  selected_slab: ResolvedRateCardSlab | null
  max_slab_weight: number | null
  matched_by: 'slab' | 'last_slab_extra' | 'legacy'
}

export function normalizeB2CShippingMode(value: unknown): string {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase()

  if (!raw) return ''
  if (['air', 'a', 'express'].includes(raw)) return 'air'
  if (['surface', 's', 'ground'].includes(raw)) return 'surface'
  return raw
}

export function normalizeB2CServiceProvider(value: unknown): string {
  return normalizeServiceProviderKey(value)
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normaliseSlabInput(slab: RateCardSlabInput): ResolvedRateCardSlab {
  const weightFrom = Math.max(0, toNumber(slab.weight_from))
  const rawWeightTo = slab.weight_to === undefined || slab.weight_to === null ? null : toNumber(slab.weight_to)
  const weightTo = rawWeightTo !== null && rawWeightTo < weightFrom ? weightFrom : rawWeightTo
  const extraWeightUnitRaw =
    slab.extra_weight_unit === undefined || slab.extra_weight_unit === null
      ? null
      : toNumber(slab.extra_weight_unit)
  const extraWeightUnit =
    extraWeightUnitRaw !== null && extraWeightUnitRaw > 0 ? extraWeightUnitRaw : null
  const extraRateRaw =
    slab.extra_rate === undefined || slab.extra_rate === null ? null : toNumber(slab.extra_rate)
  const extraRate = extraRateRaw !== null && extraRateRaw >= 0 ? extraRateRaw : null

  return {
    weight_from: weightFrom,
    weight_to: weightTo,
    rate: toNumber(slab.rate),
    extra_rate: extraRate,
    extra_weight_unit: extraWeightUnit,
  }
}

export function normaliseRateCardSlabs(slabs: RateCardSlabInput[] = []): ResolvedRateCardSlab[] {
  return slabs
    .map(normaliseSlabInput)
    .filter((slab) => slab.rate > 0)
    .sort((a, b) => a.weight_from - b.weight_from || (a.weight_to ?? Infinity) - (b.weight_to ?? Infinity))
}

export function validateRateCardSlabs(slabs: ResolvedRateCardSlab[]) {
  for (let index = 0; index < slabs.length; index += 1) {
    const slab = slabs[index]
    if (slab.weight_to !== null && slab.weight_to < slab.weight_from) {
      throw new Error(`Invalid slab range at row ${index + 1}: weight_to cannot be less than weight_from`)
    }
    if (slab.extra_rate !== null && slab.extra_weight_unit === null) {
      throw new Error(`Invalid slab at row ${index + 1}: extra_weight_unit is required when extra_rate is set`)
    }
    if (slab.extra_weight_unit !== null && slab.extra_rate === null) {
      throw new Error(`Invalid slab at row ${index + 1}: extra_rate is required when extra_weight_unit is set`)
    }
  }

  for (let index = 1; index < slabs.length; index += 1) {
    const previous = slabs[index - 1]
    const current = slabs[index]
    if (previous.weight_to === null) {
      throw new Error(`Invalid slab configuration: open-ended slab at row ${index} must be the last slab`)
    }
    if (current.weight_from < previous.weight_to) {
      throw new Error(
        `Overlapping slab ranges are not allowed: ${previous.weight_from}-${previous.weight_to} overlaps ${current.weight_from}-${current.weight_to ?? 'open'}`,
      )
    }
  }
}

export const DEFAULT_B2C_COD_SLABS: ResolvedCodSlab[] = [
  { amount_from: 0, amount_to: 2000, charge_type: 'flat', charge_value: 40 },
  { amount_from: 2000, amount_to: null, charge_type: 'percent', charge_value: 2 },
]

function normalizeCodChargeType(value: unknown): 'flat' | 'percent' {
  const normalized = String(value || '').trim().toLowerCase()
  return normalized === 'percent' || normalized === 'percentage' ? 'percent' : 'flat'
}

function normaliseCodSlabInput(slab: CodSlabInput): ResolvedCodSlab {
  const rawAmountFrom = slab.amount_from ?? slab.from ?? 0
  const rawAmountTo = slab.amount_to ?? slab.to ?? null
  const amountFrom = Math.max(0, toNumber(rawAmountFrom))
  const amountTo =
    rawAmountTo === undefined || rawAmountTo === null || rawAmountTo === ''
      ? null
      : Math.max(amountFrom, toNumber(rawAmountTo))
  const chargeValue = Math.max(0, toNumber(slab.charge_value ?? slab.value))

  return {
    amount_from: amountFrom,
    amount_to: amountTo,
    charge_type: normalizeCodChargeType(slab.charge_type ?? slab.type),
    charge_value: chargeValue,
  }
}

export function normaliseCodSlabs(slabs: CodSlabInput[] = []): ResolvedCodSlab[] {
  return slabs
    .filter((slab) =>
      [slab.amount_from ?? slab.from, slab.amount_to ?? slab.to, slab.charge_value ?? slab.value].some(
        (value) => value !== undefined && value !== null && value !== '',
      ),
    )
    .map(normaliseCodSlabInput)
    .filter((slab) => slab.charge_value > 0)
    .sort((a, b) => a.amount_from - b.amount_from || (a.amount_to ?? Infinity) - (b.amount_to ?? Infinity))
}

export function validateCodSlabs(slabs: ResolvedCodSlab[]) {
  for (let index = 0; index < slabs.length; index += 1) {
    const slab = slabs[index]
    if (slab.amount_to !== null && slab.amount_to < slab.amount_from) {
      throw new Error(`Invalid COD slab range at row ${index + 1}: amount_to cannot be less than amount_from`)
    }
    if (slab.charge_type !== 'flat' && slab.charge_type !== 'percent') {
      throw new Error(`Invalid COD slab at row ${index + 1}: charge_type must be flat or percent`)
    }
    if (!Number.isFinite(slab.charge_value) || slab.charge_value < 0) {
      throw new Error(`Invalid COD slab at row ${index + 1}: charge_value must be zero or greater`)
    }
  }

  for (let index = 1; index < slabs.length; index += 1) {
    const previous = slabs[index - 1]
    const current = slabs[index]
    if (previous.amount_to === null) {
      throw new Error(`Invalid COD slab configuration: open-ended slab at row ${index} must be the last slab`)
    }
    if (current.amount_from < previous.amount_to) {
      throw new Error(
        `Overlapping COD slab ranges are not allowed: ${previous.amount_from}-${previous.amount_to} overlaps ${current.amount_from}-${current.amount_to ?? 'open'}`,
      )
    }
  }
}

export async function fetchShippingRateSlabs(rateIds: string[]) {
  if (!rateIds.length) return []

  return db
    .select()
    .from(shippingRateSlabs)
    .where(inArray(shippingRateSlabs.shipping_rate_id, rateIds))
    .orderBy(
      asc(shippingRateSlabs.shipping_rate_id),
      asc(shippingRateSlabs.weight_from),
      asc(shippingRateSlabs.weight_to),
    )
}

export async function fetchShippingRateCodSlabs(rateIds: string[]) {
  if (!rateIds.length) return []

  return db
    .select()
    .from(shippingRateCodSlabs)
    .where(inArray(shippingRateCodSlabs.shipping_rate_id, rateIds))
    .orderBy(
      asc(shippingRateCodSlabs.shipping_rate_id),
      asc(shippingRateCodSlabs.amount_from),
      asc(shippingRateCodSlabs.amount_to),
    )
}

export async function fetchResolvedB2CRateCards(filters: {
  planId: string
  zoneId: string
  courierId?: number
  serviceProvider?: string | null
  mode?: string | null
  type?: 'forward' | 'rto'
}) {
  const conditions = [
    eq(shippingRates.plan_id, filters.planId),
    eq(shippingRates.business_type, 'b2c'),
    eq(shippingRates.zone_id, filters.zoneId),
  ]

  if (filters.courierId !== undefined) {
    conditions.push(eq(shippingRates.courier_id, filters.courierId))
  }

  if (filters.type) {
    conditions.push(eq(shippingRates.type, filters.type))
  }

  const requestedServiceProvider = normalizeB2CServiceProvider(filters.serviceProvider)
  const requestedMode = normalizeB2CShippingMode(filters.mode)
  const allRateRows = await db.select().from(shippingRates).where(and(...conditions))
  const providerFilteredRows = requestedServiceProvider
    ? (() => {
        const exactProviderRows = allRateRows.filter(
          (row) => normalizeB2CServiceProvider(row.service_provider) === requestedServiceProvider,
        )
        if (exactProviderRows.length) return exactProviderRows
        return allRateRows.filter((row) => !normalizeB2CServiceProvider(row.service_provider))
      })()
    : allRateRows
  const rateRows = requestedMode
    ? (() => {
        const exactModeRows = providerFilteredRows.filter(
          (row) => normalizeB2CShippingMode(row.mode) === requestedMode,
        )
        if (exactModeRows.length) return exactModeRows
        return providerFilteredRows.filter((row) => !normalizeB2CShippingMode(row.mode))
      })()
    : providerFilteredRows
  const rateIds = rateRows.map((row) => row.id)
  const [slabs, codSlabs] = await Promise.all([
    fetchShippingRateSlabs(rateIds),
    fetchShippingRateCodSlabs(rateIds),
  ])
  const slabMap = new Map<string, ResolvedRateCardSlab[]>()
  const codSlabMap = new Map<string, ResolvedCodSlab[]>()

  for (const slab of slabs) {
    const list = slabMap.get(slab.shipping_rate_id) || []
    list.push({
      id: slab.id,
      weight_from: toNumber(slab.weight_from),
      weight_to: slab.weight_to === null ? null : toNumber(slab.weight_to),
      rate: toNumber(slab.rate),
      extra_rate: slab.extra_rate === null ? null : toNumber(slab.extra_rate),
      extra_weight_unit:
        slab.extra_weight_unit === null ? null : toNumber(slab.extra_weight_unit),
    })
    slabMap.set(slab.shipping_rate_id, list)
  }

  for (const slab of codSlabs) {
    const list = codSlabMap.get(slab.shipping_rate_id) || []
    list.push({
      id: slab.id,
      amount_from: toNumber(slab.amount_from),
      amount_to: slab.amount_to === null ? null : toNumber(slab.amount_to),
      charge_type: normalizeCodChargeType(slab.charge_type),
      charge_value: toNumber(slab.charge_value),
    })
    codSlabMap.set(slab.shipping_rate_id, list)
  }

  return rateRows.map(
    (row): ResolvedB2CRateCard => ({
      shippingRateId: row.id,
      courier_id: row.courier_id,
      service_provider: row.service_provider ?? null,
      zone_id: row.zone_id,
      type: row.type,
      mode: row.mode,
      cod_charges: toNumber(row.cod_charges),
      cod_percent: toNumber(row.cod_percent),
      other_charges: toNumber(row.other_charges),
      min_weight: toNumber(row.min_weight),
      base_rate: toNumber(row.rate),
      slabs: slabMap.get(row.id) || [],
      cod_slabs: codSlabMap.get(row.id) || [],
    }),
  )
}

export function slabContainsWeight(
  chargeableWeightKg: number,
  slab: ResolvedRateCardSlab,
  slabIndex: number,
) {
  const start = slab.weight_from
  const end = slab.weight_to ?? Infinity
  const lowerBoundMatches = slabIndex === 0 ? chargeableWeightKg >= start : chargeableWeightKg > start
  return lowerBoundMatches && chargeableWeightKg <= end
}

export function findMatchingSlabIndex(chargeableWeightG: number, slabs: ResolvedRateCardSlab[]) {
  const chargeableWeightKg = chargeableWeightG / 1000
  return slabs.findIndex((slab, index) => slabContainsWeight(chargeableWeightKg, slab, index))
}

function findMatchingSlab(chargeableWeightG: number, slabs: ResolvedRateCardSlab[]) {
  const matchingIndex = findMatchingSlabIndex(chargeableWeightG, slabs)
  return matchingIndex >= 0 ? slabs[matchingIndex] : null
}

function calculateChargeableWeight(params: {
  actual_weight_g: number
  length_cm: number
  width_cm: number
  height_cm: number
}) {
  return calculateFreight({
    actual_weight_g: params.actual_weight_g,
    length_cm: params.length_cm,
    width_cm: params.width_cm,
    height_cm: params.height_cm,
    slab_weight_g: 1,
    base_price: 0,
  })
}

function getLastFiniteSlab(slabs: ResolvedRateCardSlab[]) {
  for (let index = slabs.length - 1; index >= 0; index -= 1) {
    if (slabs[index].weight_to !== null) return slabs[index]
  }
  return null
}

export function formatCourierSlabDisplayName(courierName: string, slabWeightTo: number | null) {
  if (slabWeightTo === null || slabWeightTo === undefined || !Number.isFinite(Number(slabWeightTo))) {
    return courierName
  }
  return `${courierName} - (${Number(slabWeightTo)}) kg`
}

export function computeB2CRateCardCharge(params: {
  actual_weight_g: number
  length_cm: number
  width_cm: number
  height_cm: number
  rateCard: ResolvedB2CRateCard
  selected_max_slab_weight?: number | null
}): ComputedB2CRateCardCharge {
  const preview = calculateChargeableWeight({
    actual_weight_g: params.actual_weight_g,
    length_cm: params.length_cm,
    width_cm: params.width_cm,
    height_cm: params.height_cm,
  })

  if (!params.rateCard.slabs.length) {
    const legacy = calculateFreight({
      actual_weight_g: params.actual_weight_g,
      length_cm: params.length_cm,
      width_cm: params.width_cm,
      height_cm: params.height_cm,
      slab_weight_g: Math.max(1, params.rateCard.min_weight * 1000 || 1),
      base_price: params.rateCard.base_rate,
    })
    return {
      ...legacy,
      slab_weight: params.rateCard.min_weight ? params.rateCard.min_weight * 1000 : null,
      base_price: params.rateCard.base_rate,
      selected_slab: null,
      max_slab_weight: params.rateCard.min_weight || null,
      matched_by: 'legacy',
    }
  }

  const chargeableWeightKg = preview.chargeable_weight / 1000
  const selectedMaxSlabWeight =
    params.selected_max_slab_weight === undefined || params.selected_max_slab_weight === null
      ? null
      : toNumber(params.selected_max_slab_weight)
  const lastFiniteSlab = getLastFiniteSlab(params.rateCard.slabs)

  if (selectedMaxSlabWeight !== null) {
    const explicitlySelectedSlab =
      params.rateCard.slabs.find(
        (slab) =>
          slab.weight_to !== null &&
          Math.abs(Number(slab.weight_to) - Number(selectedMaxSlabWeight)) < 0.0001,
      ) || null

    if (explicitlySelectedSlab) {
      if (
        explicitlySelectedSlab.weight_to !== null &&
        chargeableWeightKg <= explicitlySelectedSlab.weight_to
      ) {
        return {
          actual_weight: preview.actual_weight,
          volumetric_weight: preview.volumetric_weight,
          chargeable_weight: preview.chargeable_weight,
          slabs: null,
          freight: explicitlySelectedSlab.rate,
          slab_weight: null,
          base_price: explicitlySelectedSlab.rate,
          selected_slab: explicitlySelectedSlab,
          max_slab_weight: explicitlySelectedSlab.weight_to,
          matched_by: 'slab',
        }
      }

      if (
        lastFiniteSlab &&
        explicitlySelectedSlab.weight_to !== null &&
        lastFiniteSlab.weight_to !== null &&
        Math.abs(Number(lastFiniteSlab.weight_to) - Number(explicitlySelectedSlab.weight_to)) <
          0.0001 &&
        chargeableWeightKg > explicitlySelectedSlab.weight_to &&
        explicitlySelectedSlab.extra_rate !== null &&
        explicitlySelectedSlab.extra_weight_unit !== null
      ) {
        const extraUnits = Math.ceil(
          (chargeableWeightKg - explicitlySelectedSlab.weight_to) /
            explicitlySelectedSlab.extra_weight_unit,
        )
        return {
          actual_weight: preview.actual_weight,
          volumetric_weight: preview.volumetric_weight,
          chargeable_weight: preview.chargeable_weight,
          slabs: null,
          freight: explicitlySelectedSlab.rate + extraUnits * explicitlySelectedSlab.extra_rate,
          slab_weight: explicitlySelectedSlab.extra_weight_unit * 1000,
          base_price: explicitlySelectedSlab.rate,
          selected_slab: explicitlySelectedSlab,
          max_slab_weight: explicitlySelectedSlab.weight_to,
          matched_by: 'last_slab_extra',
        }
      }
    }
  }

  const selectedSlab = findMatchingSlab(preview.chargeable_weight, params.rateCard.slabs)
  if (selectedSlab) {
    return {
      actual_weight: preview.actual_weight,
      volumetric_weight: preview.volumetric_weight,
      chargeable_weight: preview.chargeable_weight,
      slabs: null,
      freight: selectedSlab.rate,
      slab_weight: null,
      base_price: selectedSlab.rate,
      selected_slab: selectedSlab,
      max_slab_weight: selectedSlab.weight_to,
      matched_by: 'slab',
    }
  }

  if (
    lastFiniteSlab &&
    lastFiniteSlab.weight_to !== null &&
    chargeableWeightKg > lastFiniteSlab.weight_to &&
    lastFiniteSlab.extra_rate !== null &&
    lastFiniteSlab.extra_weight_unit !== null
  ) {
    const extraUnits = Math.ceil(
      (chargeableWeightKg - lastFiniteSlab.weight_to) / lastFiniteSlab.extra_weight_unit,
    )
    const extraFreight = lastFiniteSlab.rate + extraUnits * lastFiniteSlab.extra_rate
    return {
      actual_weight: preview.actual_weight,
      volumetric_weight: preview.volumetric_weight,
      chargeable_weight: preview.chargeable_weight,
      slabs: null,
      freight: extraFreight,
      slab_weight: lastFiniteSlab.extra_weight_unit * 1000,
      base_price: lastFiniteSlab.rate,
      selected_slab: lastFiniteSlab,
      max_slab_weight: lastFiniteSlab.weight_to,
      matched_by: 'last_slab_extra',
    }
  }

  return {
    actual_weight: preview.actual_weight,
    volumetric_weight: preview.volumetric_weight,
    chargeable_weight: preview.chargeable_weight,
    slabs: null,
    freight: 0,
    slab_weight: null,
    base_price: 0,
    selected_slab: null,
    max_slab_weight: null,
    matched_by: 'slab',
  }
}

function codSlabContainsAmount(amount: number, slab: ResolvedCodSlab, slabIndex: number) {
  const start = slab.amount_from
  const end = slab.amount_to ?? Infinity
  const lowerBoundMatches = slabIndex === 0 ? amount >= start : amount > start
  return lowerBoundMatches && amount <= end
}

function calculateCodValueFromSlab(amount: number, slab: ResolvedCodSlab) {
  if (slab.charge_type === 'percent') {
    return (amount * slab.charge_value) / 100
  }
  return slab.charge_value
}

function roundMoney(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100
}

export function computeB2CCodCharge(params: {
  payment_type?: string | null
  cod_charge_basis?: number | string | null
  rateCard?: Pick<ResolvedB2CRateCard, 'cod_charges' | 'cod_percent' | 'cod_slabs'> | null
}): ComputedCodCharge {
  const isCod = String(params.payment_type || '').trim().toLowerCase() === 'cod'
  const codChargeBasis = Math.max(0, toNumber(params.cod_charge_basis))

  if (!isCod) {
    return {
      cod_charges: 0,
      cod_charge_basis: codChargeBasis,
      cod_charge_source: 'prepaid',
      selected_cod_slab: null,
    }
  }

  const codSlabs = params.rateCard?.cod_slabs || []
  const selectedSlab =
    codSlabs.find((slab, index) => codSlabContainsAmount(codChargeBasis, slab, index)) || null

  if (selectedSlab) {
    return {
      cod_charges: roundMoney(calculateCodValueFromSlab(codChargeBasis, selectedSlab)),
      cod_charge_basis: codChargeBasis,
      cod_charge_source: 'slab',
      selected_cod_slab: selectedSlab,
    }
  }

  const legacyFlatCharge = Math.max(0, toNumber(params.rateCard?.cod_charges))
  const legacyPercentCharge = (codChargeBasis * Math.max(0, toNumber(params.rateCard?.cod_percent))) / 100

  return {
    cod_charges: roundMoney(Math.max(legacyFlatCharge, legacyPercentCharge)),
    cod_charge_basis: codChargeBasis,
    cod_charge_source: 'legacy',
    selected_cod_slab: null,
  }
}

export async function replaceShippingRateSlabs(shippingRateId: string, slabs: RateCardSlabInput[]) {
  const normalised = normaliseRateCardSlabs(slabs)
  validateRateCardSlabs(normalised)

  await db.delete(shippingRateSlabs).where(eq(shippingRateSlabs.shipping_rate_id, shippingRateId))
  if (!normalised.length) return

  await db.insert(shippingRateSlabs).values(
    normalised.map((slab) => ({
      shipping_rate_id: shippingRateId,
      weight_from: slab.weight_from.toFixed(3),
      weight_to: slab.weight_to === null ? null : slab.weight_to.toFixed(3),
      rate: slab.rate.toFixed(2),
      extra_rate: slab.extra_rate === null ? null : slab.extra_rate.toFixed(2),
      extra_weight_unit:
        slab.extra_weight_unit === null ? null : slab.extra_weight_unit.toFixed(3),
      updated_at: new Date(),
    })),
  )
}

export async function replaceShippingRateCodSlabs(shippingRateId: string, slabs: CodSlabInput[]) {
  const normalised = normaliseCodSlabs(slabs)
  validateCodSlabs(normalised)

  await db.delete(shippingRateCodSlabs).where(eq(shippingRateCodSlabs.shipping_rate_id, shippingRateId))
  if (!normalised.length) return

  await db.insert(shippingRateCodSlabs).values(
    normalised.map((slab) => ({
      shipping_rate_id: shippingRateId,
      amount_from: slab.amount_from.toFixed(2),
      amount_to: slab.amount_to === null ? null : slab.amount_to.toFixed(2),
      charge_type: slab.charge_type,
      charge_value: slab.charge_value.toFixed(2),
      updated_at: new Date(),
    })),
  )
}
