import { randomUUID } from 'crypto'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { db, pool } from '../models/client'
import { couriers } from '../models/schema/couriers'
import { plans } from '../models/schema/plans'
import {
  shippingRateCodSlabs,
  shippingRates,
  shippingRateSlabs,
} from '../models/schema/shippingRates'
import { zones } from '../models/schema/zones'

const TARGET_PROVIDER = String(process.env.B2C_RATECARD_PROVIDER || 'delhivery')
  .trim()
  .toLowerCase()
const TARGET_COURIER_ID = Number(process.env.B2C_RATECARD_COURIER_ID || 99)
const MODE = String(process.env.B2C_RATECARD_MODE || 'Surface').trim() || 'Surface'
const TARGET_MODE_FILTER = MODE.toLowerCase()
const IS_EXPRESS_MODE = ['air', 'express'].includes(TARGET_MODE_FILTER)
const TARGET_COURIER_NAME =
  process.env.B2C_RATECARD_COURIER_NAME ||
  (TARGET_PROVIDER === 'deliveryone' ? `Delivery One ${MODE}` : `Delhivery ${MODE}`)
const TARGET_LEGACY_COURIER_NAME_PATTERN =
  TARGET_PROVIDER === 'deliveryone' ? '%delivery%one%' : '%delhivery%'
const BUSINESS_TYPE = 'B2C'
const forceReseed =
  process.argv.includes('--force') ||
  ['1', 'true', 'yes'].includes(
    String(
      process.env.FORCE_CHOICE_MEE_B2C_RESEED ||
        process.env.FORCE_DELHIVERY_B2C_RESEED ||
        process.env.FORCE_DELIVERY_ONE_B2C_RESEED ||
        '',
    ).toLowerCase(),
  )

type RateSlab = {
  weight_from: number
  weight_to: number
  rate: number
  extra_rate?: number
  extra_weight_unit?: number
}

type ZoneSeed = {
  code: string
  name: string
  description: string
  region: string
  states?: string[]
  metadata?: Record<string, unknown>
}

type PlanRateCard = {
  planName: string
  kashmir: RateSlab[]
  outsideKashmir: RateSlab[]
  expressOutsideKashmir?: RateSlab[]
}

const zoneSeeds: ZoneSeed[] = [
  {
    code: 'KASHMIR',
    name: 'Kashmir',
    description: 'Dedicated Kashmir and Ladakh B2C pricing zone.',
    region: 'Kashmir',
    states: ['Jammu and Kashmir', 'Jammu & Kashmir', 'Ladakh'],
    metadata: { source: 'choice-mee-image-rate-card' },
  },
  {
    code: 'METRO_TO_METRO',
    name: 'Metro to Metro',
    description: 'Shipments between major metros across the network.',
    region: 'Metro to Metro',
  },
  {
    code: 'ROI',
    name: 'Rest of India',
    description: 'Default outside-Kashmir B2C pricing zone.',
    region: 'Rest of India',
  },
  {
    code: 'SPECIAL_ZONE',
    name: 'Special Zone',
    description: 'Special zones that need extra handling, excluding Kashmir/Ladakh.',
    region: 'Special Zones',
  },
  {
    code: 'WITHIN_CITY',
    name: 'Within City',
    description: 'Shipments that stay within a single city boundary.',
    region: 'Within City',
  },
  {
    code: 'WITHIN_REGION',
    name: 'Within Region',
    description: 'Shipments moving within neighbouring regions.',
    region: 'Within Region',
  },
  {
    code: 'WITHIN_STATE',
    name: 'Within State',
    description: 'Shipments moving within the same state.',
    region: 'Within State',
  },
]

const planRateCards: PlanRateCard[] = [
  {
    planName: 'Basic',
    kashmir: [
      { weight_from: 0.1, weight_to: 0.5, rate: 80 },
      { weight_from: 0.5, weight_to: 1, rate: 100 },
      { weight_from: 1, weight_to: 2, rate: 150 },
      { weight_from: 2, weight_to: 3, rate: 200 },
      { weight_from: 3, weight_to: 4, rate: 230 },
      { weight_from: 4, weight_to: 5, rate: 260, extra_rate: 20, extra_weight_unit: 1 },
    ],
    outsideKashmir: [
      { weight_from: 0.1, weight_to: 0.5, rate: 95 },
      { weight_from: 0.5, weight_to: 1, rate: 140 },
      { weight_from: 1, weight_to: 2, rate: 195 },
      { weight_from: 2, weight_to: 3, rate: 260 },
      { weight_from: 3, weight_to: 4, rate: 320 },
      { weight_from: 4, weight_to: 5, rate: 380, extra_rate: 50, extra_weight_unit: 1 },
    ],
    expressOutsideKashmir: [
      { weight_from: 0.1, weight_to: 0.5, rate: 110 },
      { weight_from: 0.5, weight_to: 1, rate: 160 },
      { weight_from: 1, weight_to: 2, rate: 230 },
      { weight_from: 2, weight_to: 3, rate: 300 },
      { weight_from: 3, weight_to: 4, rate: 400 },
      { weight_from: 4, weight_to: 5, rate: 500, extra_rate: 100, extra_weight_unit: 1 },
    ],
  },
  {
    planName: 'Premium',
    kashmir: [
      { weight_from: 0.1, weight_to: 0.5, rate: 70 },
      { weight_from: 0.5, weight_to: 1, rate: 85 },
      { weight_from: 1, weight_to: 2, rate: 115 },
      { weight_from: 2, weight_to: 3, rate: 165 },
      { weight_from: 3, weight_to: 4, rate: 200 },
      { weight_from: 4, weight_to: 5, rate: 225, extra_rate: 25, extra_weight_unit: 2 },
    ],
    outsideKashmir: [
      { weight_from: 0.1, weight_to: 0.5, rate: 85 },
      { weight_from: 0.5, weight_to: 1, rate: 115 },
      { weight_from: 1, weight_to: 2, rate: 180 },
      { weight_from: 2, weight_to: 3, rate: 250 },
      { weight_from: 3, weight_to: 4, rate: 300 },
      { weight_from: 4, weight_to: 5, rate: 360, extra_rate: 40, extra_weight_unit: 1 },
    ],
    expressOutsideKashmir: [
      { weight_from: 0.1, weight_to: 0.5, rate: 110 },
      { weight_from: 0.5, weight_to: 1, rate: 160 },
      { weight_from: 1, weight_to: 2, rate: 230 },
      { weight_from: 2, weight_to: 3, rate: 300 },
      { weight_from: 3, weight_to: 4, rate: 400 },
      { weight_from: 4, weight_to: 5, rate: 500, extra_rate: 100, extra_weight_unit: 1 },
    ],
  },
  {
    planName: 'Aims Cart Special',
    kashmir: [
      { weight_from: 0, weight_to: 0.5, rate: 60 },
      { weight_from: 0.5, weight_to: 1, rate: 70 },
      { weight_from: 1, weight_to: 2, rate: 115 },
      { weight_from: 2, weight_to: 3, rate: 150 },
      { weight_from: 3, weight_to: 4, rate: 190 },
      { weight_from: 4, weight_to: 5, rate: 215, extra_rate: 30, extra_weight_unit: 1 },
    ],
    outsideKashmir: [
      { weight_from: 0, weight_to: 0.5, rate: 70 },
      { weight_from: 0.5, weight_to: 1, rate: 95 },
      { weight_from: 1, weight_to: 2, rate: 120 },
      { weight_from: 2, weight_to: 3, rate: 170 },
      { weight_from: 3, weight_to: 4, rate: 190 },
      { weight_from: 4, weight_to: 5, rate: 230, extra_rate: 20, extra_weight_unit: 1 },
    ],
  },
]

const codSlabs = [
  { amount_from: 0, amount_to: 2000, charge_type: 'flat', charge_value: 40 },
  { amount_from: 2000, amount_to: null, charge_type: 'percent', charge_value: 2 },
] as const

const money = (value: number) => value.toFixed(2)
const kg = (value: number) => value.toFixed(3)

async function ensurePlans() {
  const planMap = new Map<string, { id: string; name: string }>()

  const planNames = Array.from(new Set(planRateCards.map((card) => card.planName)))
  for (const name of planNames) {
    const [existing] = await db
      .select({ id: plans.id, name: plans.name })
      .from(plans)
      .where(sql`lower(trim(${plans.name})) = ${name.toLowerCase()}`)
      .limit(1)

    if (existing) {
      planMap.set(name, existing)
      continue
    }

    const [created] = await db
      .insert(plans)
      .values({
        id: randomUUID(),
        name,
        description: `${name} B2C plan`,
        is_active: true,
      } as any)
      .returning({ id: plans.id, name: plans.name })

    planMap.set(name, created)
    console.log(`Inserted ${name} plan`)
  }

  return planMap
}

async function ensureTargetCourier() {
  await db
    .insert(couriers)
    .values({
      id: TARGET_COURIER_ID,
      name: TARGET_COURIER_NAME,
      serviceProvider: TARGET_PROVIDER,
      businessType: ['b2c'],
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [couriers.id, couriers.serviceProvider],
      set: {
        name: TARGET_COURIER_NAME,
        businessType: ['b2c'],
        isEnabled: true,
        updatedAt: new Date(),
      },
    })
}

async function ensureZones() {
  for (const seed of zoneSeeds) {
    await db
      .insert(zones)
      .values({
        code: seed.code,
        name: seed.name,
        description: seed.description,
        region: seed.region,
        business_type: BUSINESS_TYPE,
        states: seed.states ?? [],
        metadata: seed.metadata ?? { source: 'choice-mee-image-rate-card' },
        created_at: new Date(),
        updated_at: new Date(),
      } as any)
      .onConflictDoUpdate({
        target: [zones.code, zones.business_type],
        set: {
          name: seed.name,
          description: seed.description,
          region: seed.region,
          states: seed.states ?? [],
          metadata: seed.metadata ?? { source: 'choice-mee-image-rate-card' },
          updated_at: new Date(),
        },
      })
  }

  return db
    .select({ id: zones.id, code: zones.code, name: zones.name })
    .from(zones)
    .where(sql`lower(trim(${zones.business_type})) = 'b2c'`)
}

async function purgeExistingTargetRates(planIds: string[], zoneIds: string[]) {
  if (!planIds.length || !zoneIds.length) return 0

  const existingRates = await db
    .select({ id: shippingRates.id })
    .from(shippingRates)
    .where(
      and(
        eq(shippingRates.business_type, 'b2c'),
        inArray(shippingRates.plan_id, planIds),
        inArray(shippingRates.zone_id, zoneIds),
        eq(shippingRates.courier_id, TARGET_COURIER_ID),
        sql`(
          lower(trim(coalesce(${shippingRates.service_provider}, ''))) = ${TARGET_PROVIDER}
          or (
            trim(coalesce(${shippingRates.service_provider}, '')) = ''
            and lower(trim(${shippingRates.courier_name})) like ${TARGET_LEGACY_COURIER_NAME_PATTERN}
          )
        )`,
        sql`lower(trim(${shippingRates.mode})) = ${TARGET_MODE_FILTER}`,
      ),
    )

  const rateIds = existingRates.map((row) => row.id)
  if (!rateIds.length) return 0

  await db.delete(shippingRateCodSlabs).where(inArray(shippingRateCodSlabs.shipping_rate_id, rateIds))
  await db.delete(shippingRateSlabs).where(inArray(shippingRateSlabs.shipping_rate_id, rateIds))
  await db.delete(shippingRates).where(inArray(shippingRates.id, rateIds))

  return rateIds.length
}

const isKashmirZone = (zone: { code: string; name: string }) =>
  zone.code.trim().toUpperCase() === 'KASHMIR' || zone.name.trim().toUpperCase() === 'KASHMIR'

async function purgeExpressKashmirRates(
  planIds: string[],
  zoneRows: { id: string; code: string; name: string }[],
) {
  if (!IS_EXPRESS_MODE || !planIds.length) return 0

  const kashmirZoneIds = zoneRows.filter(isKashmirZone).map((zone) => zone.id)
  if (!kashmirZoneIds.length) return 0

  const existingRates = await db
    .select({ id: shippingRates.id })
    .from(shippingRates)
    .where(
      and(
        eq(shippingRates.business_type, 'b2c'),
        inArray(shippingRates.plan_id, planIds),
        inArray(shippingRates.zone_id, kashmirZoneIds),
        eq(shippingRates.courier_id, TARGET_COURIER_ID),
        sql`(
          lower(trim(coalesce(${shippingRates.service_provider}, ''))) = ${TARGET_PROVIDER}
          or (
            trim(coalesce(${shippingRates.service_provider}, '')) = ''
            and lower(trim(${shippingRates.courier_name})) like ${TARGET_LEGACY_COURIER_NAME_PATTERN}
          )
        )`,
        sql`lower(trim(${shippingRates.mode})) in ('express', 'air')`,
      ),
    )

  const rateIds = existingRates.map((row) => row.id)
  if (!rateIds.length) return 0

  await db.delete(shippingRateCodSlabs).where(inArray(shippingRateCodSlabs.shipping_rate_id, rateIds))
  await db.delete(shippingRateSlabs).where(inArray(shippingRateSlabs.shipping_rate_id, rateIds))
  await db.delete(shippingRates).where(inArray(shippingRates.id, rateIds))

  return rateIds.length
}

async function normalizeLegacyBlankProviderRows(planIds: string[], zoneIds: string[]) {
  if (!planIds.length || !zoneIds.length) return { normalized: 0, removedDuplicates: 0 }

  const legacyRows = await db
    .select({
      id: shippingRates.id,
      plan_id: shippingRates.plan_id,
      zone_id: shippingRates.zone_id,
      type: shippingRates.type,
    })
    .from(shippingRates)
    .where(
      and(
        eq(shippingRates.business_type, 'b2c'),
        inArray(shippingRates.plan_id, planIds),
        inArray(shippingRates.zone_id, zoneIds),
        eq(shippingRates.courier_id, TARGET_COURIER_ID),
        sql`trim(coalesce(${shippingRates.service_provider}, '')) = ''`,
        sql`lower(trim(${shippingRates.courier_name})) like ${TARGET_LEGACY_COURIER_NAME_PATTERN}`,
        sql`lower(trim(${shippingRates.mode})) = ${TARGET_MODE_FILTER}`,
      ),
    )

  let normalized = 0
  let removedDuplicates = 0

  for (const row of legacyRows) {
    const [providerRow] = await db
      .select({ id: shippingRates.id })
      .from(shippingRates)
      .where(
        and(
          eq(shippingRates.business_type, 'b2c'),
          eq(shippingRates.plan_id, row.plan_id),
          eq(shippingRates.zone_id, row.zone_id),
          eq(shippingRates.courier_id, TARGET_COURIER_ID),
          eq(shippingRates.type, row.type),
          sql`lower(trim(${shippingRates.service_provider})) = ${TARGET_PROVIDER}`,
          sql`lower(trim(${shippingRates.mode})) = ${TARGET_MODE_FILTER}`,
        ),
      )
      .limit(1)

    if (providerRow) {
      await db.delete(shippingRateCodSlabs).where(eq(shippingRateCodSlabs.shipping_rate_id, row.id))
      await db.delete(shippingRateSlabs).where(eq(shippingRateSlabs.shipping_rate_id, row.id))
      await db.delete(shippingRates).where(eq(shippingRates.id, row.id))
      removedDuplicates += 1
      continue
    }

    await db
      .update(shippingRates)
      .set({
        courier_name: TARGET_COURIER_NAME,
        service_provider: TARGET_PROVIDER,
        mode: MODE,
        last_updated: new Date(),
      })
      .where(eq(shippingRates.id, row.id))
    normalized += 1
  }

  return { normalized, removedDuplicates }
}

async function insertRateCardSlabs(shippingRateId: string, slabs: RateSlab[]) {
  await db.insert(shippingRateSlabs).values(
    slabs.map((slab) => ({
      shipping_rate_id: shippingRateId,
      weight_from: kg(slab.weight_from),
      weight_to: kg(slab.weight_to),
      rate: money(slab.rate),
      extra_rate: slab.extra_rate === undefined ? null : money(slab.extra_rate),
      extra_weight_unit:
        slab.extra_weight_unit === undefined ? null : kg(slab.extra_weight_unit),
      created_at: new Date(),
      updated_at: new Date(),
    })),
  )
}

async function insertCodSlabs(shippingRateId: string) {
  await db.insert(shippingRateCodSlabs).values(
    codSlabs.map((slab) => ({
      shipping_rate_id: shippingRateId,
      amount_from: money(slab.amount_from),
      amount_to: slab.amount_to === null ? null : money(slab.amount_to),
      charge_type: slab.charge_type,
      charge_value: money(slab.charge_value),
      created_at: new Date(),
      updated_at: new Date(),
    })),
  )
}

async function seedRates(
  planMap: Map<string, { id: string; name: string }>,
  zoneRows: { id: string; code: string; name: string }[],
) {
  let inserted = 0
  let skippedExisting = 0
  let skippedKashmir = 0
  let skippedExpressPlan = 0

  for (const planRateCard of planRateCards) {
    const plan = planMap.get(planRateCard.planName)
    if (!plan) throw new Error(`${planRateCard.planName} plan is missing`)

    for (const zone of zoneRows) {
      const isKashmir = isKashmirZone(zone)
      if (IS_EXPRESS_MODE && isKashmir) {
        skippedKashmir += 2
        continue
      }
      if (IS_EXPRESS_MODE && !planRateCard.expressOutsideKashmir?.length) {
        skippedExpressPlan += 2
        continue
      }

      const slabs = IS_EXPRESS_MODE
        ? planRateCard.expressOutsideKashmir!
        : isKashmir
          ? planRateCard.kashmir
          : planRateCard.outsideKashmir
      const baseRate = slabs[0].rate

      for (const type of ['forward', 'rto'] as const) {
        const [existing] = await db
          .select({ id: shippingRates.id })
          .from(shippingRates)
          .where(
            and(
              eq(shippingRates.plan_id, plan.id),
              eq(shippingRates.business_type, 'b2c'),
              eq(shippingRates.zone_id, zone.id),
              eq(shippingRates.courier_id, TARGET_COURIER_ID),
              eq(shippingRates.type, type),
              sql`lower(trim(${shippingRates.service_provider})) = ${TARGET_PROVIDER}`,
              sql`lower(trim(${shippingRates.mode})) = ${TARGET_MODE_FILTER}`,
            ),
          )
          .limit(1)

        if (existing) {
          skippedExisting += 1
          continue
        }

        const [rateRow] = await db
          .insert(shippingRates)
          .values({
            id: randomUUID(),
            plan_id: plan.id,
            courier_id: TARGET_COURIER_ID,
            courier_name: TARGET_COURIER_NAME,
            service_provider: TARGET_PROVIDER,
            mode: MODE,
            business_type: 'b2c',
            min_weight: '0.50',
            zone_id: zone.id,
            type,
            rate: money(baseRate),
            cod_charges: '40.00',
            cod_percent: '2.00',
            other_charges: '0.00',
            created_at: new Date(),
            last_updated: new Date(),
          } as any)
          .returning({ id: shippingRates.id })

        await insertRateCardSlabs(rateRow.id, slabs)
        await insertCodSlabs(rateRow.id)
        inserted += 1
      }
    }
  }

  return { inserted, skippedExisting, skippedKashmir, skippedExpressPlan }
}

async function main() {
  try {
    const planMap = await ensurePlans()
    await ensureTargetCourier()
    const zoneRows = await ensureZones()
    const planIds = Array.from(planMap.values()).map((plan) => plan.id)
    const zoneIds = zoneRows.map((zone) => zone.id)
    const legacyCleanup = await normalizeLegacyBlankProviderRows(planIds, zoneIds)
    const removedDisallowedKashmir = await purgeExpressKashmirRates(planIds, zoneRows)
    const removed = forceReseed || IS_EXPRESS_MODE ? await purgeExistingTargetRates(planIds, zoneIds) : 0
    const { inserted, skippedExisting, skippedKashmir, skippedExpressPlan } = await seedRates(planMap, zoneRows)

    console.log(
      `Updated ${TARGET_COURIER_NAME} image rate card: removed ${removed} old rows, inserted ${inserted} plan forward/RTO rows, skipped ${skippedExisting} existing manual rows${
        skippedKashmir ? `, skipped ${skippedKashmir} Kashmir Express slots` : ''
      }${
        skippedExpressPlan ? `, skipped ${skippedExpressPlan} plan slots without Express pricing` : ''
      }.`,
    )
    if (removedDisallowedKashmir) {
      console.log(`Removed ${removedDisallowedKashmir} Kashmir Express row(s).`)
    }
    console.log(
      `Legacy blank-provider cleanup: normalized ${legacyCleanup.normalized}, removed ${legacyCleanup.removedDuplicates} duplicates.`,
    )
    if (IS_EXPRESS_MODE) {
      console.log('Kashmir Express rates were intentionally left empty.')
    } else if (!forceReseed) {
      console.log(`Existing ${TARGET_COURIER_NAME} rows were preserved so manual admin edits are not overwritten.`)
    }
    if (TARGET_MODE_FILTER === 'surface') {
      console.log('Express/Air rates were not changed.')
    }
  } catch (error) {
    console.error(`${TARGET_COURIER_NAME} B2C image rate card seed failed:`, error)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

main()
