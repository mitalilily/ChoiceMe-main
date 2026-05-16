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

type QuoteParams = {
  userId: string
  originPincode: string
  destinationPincode: string
  mode: 'air' | 'surface'
  weightKg: number
  paymentType?: 'cod' | 'prepaid'
  codChargeBasis?: number
}

const weights = [0.5, 1, 2, 3, 4, 5, 6]

async function quoteFor({
  userId,
  originPincode,
  destinationPincode,
  mode,
  weightKg,
  paymentType = 'prepaid',
  codChargeBasis = 0,
}: QuoteParams) {
  return computeB2CFreightForOrder({
    userId,
    courierId: mode === 'air' ? 99 : 100,
    serviceProvider: 'delhivery',
    mode,
    paymentType,
    codChargeBasis,
    originPincode,
    destinationPincode,
    weightG: Math.round(weightKg * 1000),
    lengthCm: 1,
    breadthCm: 1,
    heightCm: 1,
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

    const groups = [
      {
        label: 'Basic within Kashmir surface',
        userId: basicUserId,
        originPincode: '193123',
        destinationPincode: '110001',
        mode: 'surface' as const,
        expected: [80, 100, 150, 200, 230, 260, 280],
      },
      {
        label: 'Premium within Kashmir surface',
        userId: premiumUserId,
        originPincode: '193123',
        destinationPincode: '110001',
        mode: 'surface' as const,
        expected: [70, 85, 115, 165, 200, 225, 250],
      },
      {
        label: 'Basic outside Kashmir surface',
        userId: basicUserId,
        originPincode: '110001',
        destinationPincode: '400001',
        mode: 'surface' as const,
        expected: [95, 140, 195, 260, 320, 380, 430],
      },
      {
        label: 'Premium outside Kashmir surface',
        userId: premiumUserId,
        originPincode: '110001',
        destinationPincode: '400001',
        mode: 'surface' as const,
        expected: [85, 115, 180, 250, 300, 360, 400],
      },
      {
        label: 'Basic outside Kashmir express',
        userId: basicUserId,
        originPincode: '110001',
        destinationPincode: '400001',
        mode: 'air' as const,
        expected: [110, 150, 230, 300, 400, 500, 550],
      },
      {
        label: 'Premium outside Kashmir express',
        userId: premiumUserId,
        originPincode: '110001',
        destinationPincode: '400001',
        mode: 'air' as const,
        expected: [110, 150, 230, 300, 400, 500, 550],
      },
    ]

    const outputRows: string[] = []
    for (const group of groups) {
      const quotes = await Promise.all(
        weights.map((weightKg) =>
          quoteFor({
            userId: group.userId,
            originPincode: group.originPincode,
            destinationPincode: group.destinationPincode,
            mode: group.mode,
            weightKg,
          }),
        ),
      )

      quotes.forEach((quote, index) => {
        assertFreight(`${group.label} ${weights[index]}kg`, quote.freight, group.expected[index])
      })

      outputRows.push(
        `${group.label}: ${quotes
          .map((quote, index) => `${weights[index]}kg=${money(quote.freight)}`)
          .join(', ')}`,
      )
    }

    const codChecks = await Promise.all(
      [1999, 2000, 2500].map((basis) =>
        quoteFor({
          userId: basicUserId,
          originPincode: '110001',
          destinationPincode: '400001',
          mode: 'surface',
          weightKg: 0.5,
          paymentType: 'cod',
          codChargeBasis: basis,
        }),
      ),
    )
    const expectedCod = [40, 40, 50]
    codChecks.forEach((quote, index) => {
      if (Number(quote.cod_charges) !== expectedCod[index]) {
        throw new Error(
          `COD basis ${[1999, 2000, 2500][index]}: expected ${expectedCod[index]}, received ${quote.cod_charges}`,
        )
      }
    })

    console.log('Plan-scoped image rate card check')
    console.log(`Basic plan (${basic.id})`)
    console.log(`Premium plan (${premium.id})`)
    for (const row of outputRows) {
      console.log(`  ${row}`)
    }
    console.log(
      `  COD slabs: 1999=${money(codChecks[0].cod_charges)}, 2000=${money(codChecks[1].cod_charges)}, 2500=${money(codChecks[2].cod_charges)}`,
    )
    console.log('PASS: image rates were created and assigned users only received their active plan rates.')
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
