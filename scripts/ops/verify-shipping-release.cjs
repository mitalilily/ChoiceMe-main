// Run on the VPS using its existing environment. Tokens remain in process memory.
const assert = require('node:assert/strict')
const { createRequire } = require('node:module')
const fs = require('node:fs')
const req = createRequire('/opt/choicemee/source/apps/backend/package.json')
Object.assign(
  process.env,
  req('dotenv').parse(fs.readFileSync('/opt/choicemee/shared/backend.env')),
)
const { Client } = req('pg')
const jwt = req('jsonwebtoken')
const base = process.env.BASE_URL || 'https://api.choicemee.in'
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
  statement_timeout: 15000,
})

;(async () => {
  try {
    await client.connect()
    const sellers = (
      await client.query(
        'SELECT user_id,count(*)::int AS count FROM b2c_orders GROUP BY user_id ORDER BY count(*) DESC LIMIT 2',
      )
    ).rows
    assert.ok(sellers.length > 0)
    for (const seller of sellers) {
      const token = jwt.sign(
        { sub: seller.user_id, role: 'user' },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: '5m' },
      )
      const get = async (route) => {
        const response = await fetch(`${base}/api${route}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(30000),
        })
        assert.equal(response.status, 200, route)
        return response.json()
      }
      const exported = await get('/orders/export?scope=all')
      const unique = new Set()
      for (const order of exported.orders) {
        assert.equal(order.user_id, seller.user_id)
        const key = String(order.awb_number || '')
          .trim()
          .toUpperCase()
        if (key) {
          assert.equal(unique.has(key), false, 'Repeated seller AWB')
          unique.add(key)
        }
        assert.equal('courier_cost' in order, false)
      }
      const warehouses = await get('/pickup-addresses?page=1&limit=500&isPickupEnabled=active')
      assert.equal(warehouses.data.length, Math.min(500, warehouses.totalCount))
      const prefs = await get('/label-preference')
      assert.equal(typeof prefs.note_enabled, 'boolean')
      assert.equal(typeof prefs.label_note, 'string')
      console.log(
        JSON.stringify({
          authenticatedSeller: 'pass',
          exported: exported.orders.length,
          warehouses: warehouses.data.length,
          labelPreferences: 'pass',
        }),
      )
    }
    const response = await fetch(`${base}/api/orders/export?scope=all`)
    assert.equal(response.status, 401)
    console.log(
      'PASS authenticated exports, seller isolation, warehouse completeness, label preferences and unauthenticated rejection',
    )
  } finally {
    void client.end()
  }
})().then(() => setTimeout(() => process.exit(0), 250)).catch((error) => {
  console.error(error)
  setTimeout(() => process.exit(1), 250)
})
