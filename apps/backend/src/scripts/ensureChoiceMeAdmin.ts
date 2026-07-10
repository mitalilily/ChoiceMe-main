import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { db, pool } from '../models/client'
import { users } from '../models/schema/users'

const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || 'admin@choiceme.com')
  .trim()
  .toLowerCase()
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || '')

const validateCredentials = () => {
  if (!ADMIN_EMAIL || !ADMIN_EMAIL.includes('@')) {
    throw new Error('ADMIN_EMAIL must be a valid email address')
  }

  if (
    ADMIN_PASSWORD.length < 8 ||
    !/[a-z]/.test(ADMIN_PASSWORD) ||
    !/[A-Z]/.test(ADMIN_PASSWORD) ||
    !/\d/.test(ADMIN_PASSWORD)
  ) {
    throw new Error(
      'ADMIN_PASSWORD must be at least 8 characters and include upper, lower, and number',
    )
  }
}

async function ensureChoiceMeAdmin() {
  validateCredentials()
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10)
  const [existing] = await db.select().from(users).where(eq(users.email, ADMIN_EMAIL))

  if (existing) {
    await db
      .update(users)
      .set({
        passwordHash,
        role: 'admin',
        emailVerified: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id))

    console.log(`Updated admin credentials for ${ADMIN_EMAIL}`)
  } else {
    await db.insert(users).values({
      id: uuidv4(),
      email: ADMIN_EMAIL,
      passwordHash,
      role: 'admin',
      emailVerified: true,
      phoneVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    console.log(`Created admin user ${ADMIN_EMAIL}`)
  }

  console.log(`ChoiceMee admin is ready: ${ADMIN_EMAIL}`)
}

ensureChoiceMeAdmin()
  .catch((error) => {
    console.error('Failed to ensure ChoiceMe admin:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
