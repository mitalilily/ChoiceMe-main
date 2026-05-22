import assert from 'node:assert/strict'
import {
  computeB2CRateCardCharge,
  type ResolvedB2CRateCard,
} from '../models/services/b2cRateCard.service'

const rateCard: ResolvedB2CRateCard = {
  shippingRateId: 'test-rate-card',
  courier_id: 99,
  service_provider: 'deliveryone',
  zone_id: 'test-zone',
  type: 'forward',
  mode: 'surface',
  cod_charges: 40,
  cod_percent: 2,
  other_charges: 0,
  min_weight: 0.5,
  base_rate: 80,
  cod_slabs: [],
  slabs: [
    { weight_from: 0.1, weight_to: 0.5, rate: 80, extra_rate: null, extra_weight_unit: null },
    { weight_from: 0.5, weight_to: 1, rate: 100, extra_rate: null, extra_weight_unit: null },
    { weight_from: 1, weight_to: 2, rate: 150, extra_rate: null, extra_weight_unit: null },
    { weight_from: 2, weight_to: 3, rate: 200, extra_rate: null, extra_weight_unit: null },
    { weight_from: 3, weight_to: 4, rate: 230, extra_rate: null, extra_weight_unit: null },
    { weight_from: 4, weight_to: 5, rate: 260, extra_rate: 20, extra_weight_unit: 1 },
  ],
}

const cases = [
  {
    label: '300g is raised to the 500g minimum slab',
    actualWeightG: 300,
    selectedMaxSlabWeight: 1,
    expectedChargeableWeightG: 500,
    expectedFreight: 80,
    expectedMaxSlabWeight: 0.5,
  },
  {
    label: '500g exact weight stays in the 500g slab',
    actualWeightG: 500,
    selectedMaxSlabWeight: 1,
    expectedChargeableWeightG: 500,
    expectedFreight: 80,
    expectedMaxSlabWeight: 0.5,
  },
  {
    label: '600g decimal weight uses the 0.5kg-1kg slab, not a stale 5kg selection',
    actualWeightG: 600,
    selectedMaxSlabWeight: 5,
    expectedChargeableWeightG: 600,
    expectedFreight: 100,
    expectedMaxSlabWeight: 1,
  },
  {
    label: '1.3kg decimal weight uses the 1kg-2kg slab',
    actualWeightG: 1300,
    selectedMaxSlabWeight: 5,
    expectedChargeableWeightG: 1300,
    expectedFreight: 150,
    expectedMaxSlabWeight: 2,
  },
  {
    label: '5.6kg uses last slab extra charge by actual chargeable weight',
    actualWeightG: 5600,
    selectedMaxSlabWeight: 1,
    expectedChargeableWeightG: 5600,
    expectedFreight: 280,
    expectedMaxSlabWeight: 5,
  },
]

for (const testCase of cases) {
  const result = computeB2CRateCardCharge({
    actual_weight_g: testCase.actualWeightG,
    length_cm: 0,
    width_cm: 0,
    height_cm: 0,
    rateCard,
    selected_max_slab_weight: testCase.selectedMaxSlabWeight,
  })

  assert.equal(result.chargeable_weight, testCase.expectedChargeableWeightG, testCase.label)
  assert.equal(result.freight, testCase.expectedFreight, testCase.label)
  assert.equal(result.max_slab_weight, testCase.expectedMaxSlabWeight, testCase.label)
}

const gapRateCard: ResolvedB2CRateCard = {
  ...rateCard,
  shippingRateId: 'test-rate-card-gap',
  courier_id: 121,
  base_rate: 20,
  min_weight: 1,
  slabs: [
    { weight_from: 1, weight_to: 2, rate: 20, extra_rate: 10, extra_weight_unit: 1 },
    { weight_from: 2, weight_to: 3, rate: 50, extra_rate: 20, extra_weight_unit: 1 },
  ],
}

const gapResult = computeB2CRateCardCharge({
  actual_weight_g: 500,
  length_cm: 10,
  width_cm: 10,
  height_cm: 10,
  rateCard: gapRateCard,
})

assert.equal(gapResult.chargeable_weight, 500, '500g still uses the B2C minimum')
assert.equal(gapResult.freight, 20, '500g below first configured slab uses the first slab rate')

console.log('B2C rate-card slab selection checks passed')
