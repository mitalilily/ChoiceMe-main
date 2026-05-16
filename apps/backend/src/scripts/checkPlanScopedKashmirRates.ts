import { randomUUID } from 'crypto'
import { inArray } from 'drizzle-orm'
import { db, pool } from '../models/client'
import { plans } from '../models/schema/plans'
import { userPlans } from '../models/schema/userPlans'
import { users } from '../models/schema/users'
import { computeB2CFreightForOrder } from '../models/services/shiprocket.service'

type PlanRow = {
  id: string
  name: string
}

const money = (value: unknown) => Number(value ?? 0).toFixed(2)

async function getRequiredPlans() {
  const planRows = await db.select({ id: plans.id, name: plans.name }).from(plans)
  const basic = planRows.find((plan) => plan.name?.toLowerCase() === 'basic')
  const premium = planRows.find((plan) => plan.name?.toLowerCase() === 'premium')

  if (!basic || !premium) {
    throw new Error('Basic and Premium plans must exist before running this check.')
  }

  return { basic, premium } as { basic: PlanRow; premium: PlanRow }
}

async function createPlanUser(plan: PlanRow) {
  const userId = randomUUID()
  const email = `plan-rate-check-${plan.name.toLowerCase()}-${Date.now()}-${userId.slice(0, 8)}@example.test`

  await db.insert(users).values({
    id: userId,
    email,
    emailVerified: true,
    accountVerified: true,
    role: 'customer',
  })

  await db.insert(userPlans).values({
    userId,
    plan_id: plan.id,
    is_active: true,
  })

  return userId
}

async function quoteFor(userId: string, originPincode: string, destinationPincode: string) {
  return computeB2CFreightForOrder({
    userId,
    courierId: 100,
    serviceProvider: 'delhivery',
    mode: 'surface',
    paymentType: 'prepaid',
    codChargeBasis: 0,
    originPincode,
    destinationPincode,
    weightG: 500,
    lengthCm: 10,
    breadthCm: 10,
    heightCm: 10,
  })
}

function assertFreight(label: string, actual: number, expected: number) {
  if (Number(actual) !== expected) {
    throw new Error(`${label}: expected ${expected}, received ${actual}`)
  }
}

async function main() {
  const { basic, premium } = await getRequiredPlans()
  const createdUserIds: string[] = []

  try {
    const basicUserId = await createPlanUser(basic)
    const premiumUserId = await createPlanUser(premium)
    createdUserIds.push(basicUserId, premiumUserId)

    const [basicKashmir, basicOutside, premiumKashmir, premiumOutside] = await Promise.all([
      quoteFor(basicUserId, '193123', '110001'),
      quoteFor(basicUserId, '110001', '110001'),
      quoteFor(premiumUserId, '193123', '110001'),
      quoteFor(premiumUserId, '110001', '110001'),
    ])

    assertFreight('Basic Kashmir surface forward', basicKashmir.freight, 185)
    assertFreight('Basic outside-Kashmir surface forward', basicOutside.freight, 155)
    assertFreight('Premium Kashmir surface forward', premiumKashmir.freight, 165)
    assertFreight('Premium outside-Kashmir surface forward', premiumOutside.freight, 135)

    console.log('Plan-scoped Kashmir rate check')
    console.log(`Basic plan (${basic.id})`)
    console.log(`  Kashmir 193123 -> 110001: freight ${money(basicKashmir.freight)}, zone ${basicKashmir.zone_id}`)
    console.log(`  Outside 110001 -> 110001: freight ${money(basicOutside.freight)}, zone ${basicOutside.zone_id}`)
    console.log(`Premium plan (${premium.id})`)
    console.log(`  Kashmir 193123 -> 110001: freight ${money(premiumKashmir.freight)}, zone ${premiumKashmir.zone_id}`)
    console.log(`  Outside 110001 -> 110001: freight ${money(premiumOutside.freight)}, zone ${premiumOutside.zone_id}`)
    console.log('PASS: assigned users only received their active plan rates.')
  } finally {
    if (createdUserIds.length) {
      await db.delete(users).where(inArray(users.id, createdUserIds))
    }
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

