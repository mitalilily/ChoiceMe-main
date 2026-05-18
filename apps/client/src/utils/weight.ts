export const GRAMS_PER_KG = 1000
export const MIN_B2C_CHARGEABLE_WEIGHT_GRAMS = 500

const toPositiveNumber = (value: unknown) => {
  const numericValue = Number(value ?? 0)
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 0
}

export const kgToGrams = (value: unknown) => Math.round(toPositiveNumber(value) * GRAMS_PER_KG)

export const gramsToKg = (value: unknown) => toPositiveNumber(value) / GRAMS_PER_KG

export const normalizeParcelWeightInputToGrams = (value: unknown) => {
  const numericValue = toPositiveNumber(value)
  if (!numericValue) return 0

  // Booking now captures B2C parcel weight in kg. Values above 50 are treated as
  // legacy gram values so older drafts or browser state do not become oversized.
  return numericValue > 50 ? Math.round(numericValue) : kgToGrams(numericValue)
}
