import { randomUUID } from 'crypto'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { db, pool } from '../models/client'
import { couriers } from '../models/schema/couriers'
import { plans } from '../models/schema/plans'
import { shippingRates } from '../models/schema/shippingRates'
import { zones } from '../models/schema/zones'

const DELIVERY_ONE_PROVIDER = 'deliveryone'

type CourierSeed = {
  id: number
  name: string
  mode: 'Air' | 'Surface'
  extraForward: number
  extraRto: number
}

type ZoneSeed = {
  code: string
  name: string
  description: string
  region: string
}

const courierSeeds: CourierSeed[] = [
  {
    id: 100,
    name: 'Delivery One Express',
    mode: 'Air',
    extraForward: 20,
    extraRto: 10,
  },
  {
    id: 99,
    name: 'Delivery One Surface',
    mode: 'Surface',
    extraForward: 5,
    extraRto: 5,
  },
]

const zoneSeeds: ZoneSeed[] = [
  {
    code: 'METRO_TO_METRO',
    name: 'Metro to Metro',
    description: 'Shipments between major metros across the network.',
    region: 'Metro to Metro',
  },
  {
    code: 'ROI',
    name: 'Rest of India',
    description: 'Shipments that traverse the rest of India.',
    region: 'Rest of India',
  },
  {
    code: 'SPECIAL_ZONE',
    name: 'Special Zone',
    description: 'Special zones that need extra handling.',
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

const forwardRateGuide: Record<string, number> = {
  METRO_TO_METRO: 145,
  ROI: 150,
  SPECIAL_ZONE: 180,
  WITHIN_CITY: 110,
  WITHIN_REGION: 130,
  WITHIN_STATE: 140,
}

const rtoRateGuide: Record<string, number> = {
  METRO_TO_METRO: 95,
  ROI: 90,
  SPECIAL_ZONE: 110,
  WITHIN_CITY: 70,
  WITHIN_REGION: 80,
  WITHIN_STATE: 85,
}

async function ensureBasicPlan() {
  const [existing] = await db.select().from(plans).where(eq(plans.name, 'Basic')).limit(1)
  if (existing) return existing

  const [plan] = await db
    .insert(plans)
    .values({
      id: randomUUID(),
      name: 'Basic',
      description: 'Default B2C plan',
      is_active: true,
    } as any)
    .returning()

  console.log('Inserted Basic plan')
  return plan
}

async function upsertDeliveryOneCouriers() {
  for (const courier of courierSeeds) {
    await db
      .insert(couriers)
      .values({
        id: courier.id,
        name: courier.name,
        serviceProvider: DELIVERY_ONE_PROVIDER,
        businessType: ['b2c'],
        isEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .onConflictDoUpdate({
        target: [couriers.id, couriers.serviceProvider],
        set: {
          name: courier.name,
          businessType: ['b2c'],
          isEnabled: true,
          updatedAt: new Date(),
        },
      })

    console.log(`Ensured ${courier.name} (${courier.id})`)
  }
}

async function upsertZones() {
  const rows: { id: string; code: string }[] = []

  for (const seed of zoneSeeds) {
    const [zone] = await db
      .insert(zones)
      .values({
        code: seed.code,
        name: seed.name,
        description: seed.description,
        region: seed.region,
        business_type: 'B2C',
        metadata: { source: 'delivery-one-seed' },
        states: [],
        created_at: new Date(),
        updated_at: new Date(),
      } as any)
      .onConflictDoUpdate({
        target: [zones.code, zones.business_type],
        set: {
          name: seed.name,
          description: seed.description,
          region: seed.region,
          updated_at: new Date(),
        },
      })
      .returning()

    rows.push({ id: zone.id, code: zone.code })
  }

  return rows
}

async function purgeExistingDeliveryOneRates() {
  await db
    .delete(shippingRates)
    .where(
      and(
        eq(shippingRates.business_type, 'b2c'),
        inArray(
          shippingRates.courier_id,
          courierSeeds.map((courier) => courier.id),
        ),
        eq(sql`LOWER(${shippingRates.service_provider})`, DELIVERY_ONE_PROVIDER),
      ),
    )

  console.log('Removed existing Delivery One B2C rates')
}

async function seedRates(planId: string, zoneRows: { id: string; code: string }[]) {
  const rateRecords = zoneRows.flatMap((zone) => {
    const baseForward = forwardRateGuide[zone.code] ?? 150
    const baseRto = rtoRateGuide[zone.code] ?? 90

    return courierSeeds.flatMap((courier) => [
      {
        id: randomUUID(),
        plan_id: planId,
        courier_id: courier.id,
        courier_name: courier.name,
        service_provider: DELIVERY_ONE_PROVIDER,
        mode: courier.mode,
        business_type: 'b2c',
        min_weight: '0.50',
        zone_id: zone.id,
        type: 'forward',
        rate: (baseForward + courier.extraForward).toFixed(2),
        cod_charges: '45.00',
        cod_percent: '1.50',
        other_charges: '18.00',
        created_at: new Date(),
        last_updated: new Date(),
      },
      {
        id: randomUUID(),
        plan_id: planId,
        courier_id: courier.id,
        courier_name: courier.name,
        service_provider: DELIVERY_ONE_PROVIDER,
        mode: courier.mode,
        business_type: 'b2c',
        min_weight: '0.50',
        zone_id: zone.id,
        type: 'rto',
        rate: (baseRto + courier.extraRto).toFixed(2),
        cod_charges: '45.00',
        cod_percent: '1.50',
        other_charges: '18.00',
        created_at: new Date(),
        last_updated: new Date(),
      },
    ])
  })

  if (!rateRecords.length) {
    console.warn('No Delivery One rates to seed')
    return
  }

  await db.insert(shippingRates).values(rateRecords as any)
  console.log(`Inserted ${rateRecords.length} Delivery One B2C rate rows`)
}

async function main() {
  try {
    const plan = await ensureBasicPlan()
    await upsertDeliveryOneCouriers()
    const zoneRows = await upsertZones()
    await purgeExistingDeliveryOneRates()
    await seedRates(plan.id, zoneRows)
    console.log('Delivery One B2C couriers and rate card seeded')
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error('Delivery One rate card seed failed:', error)
  process.exit(1)
})
