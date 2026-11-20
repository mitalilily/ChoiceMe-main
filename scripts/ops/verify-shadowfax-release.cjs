// Read-only production/candidate verification. No external courier calls or test bookings.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { createRequire } = require('node:module')
const req = createRequire('/opt/choicemee/source/apps/backend/package.json')
Object.assign(process.env, req('dotenv').parse(fs.readFileSync('/opt/choicemee/shared/backend.env')))
const { Client } = req('pg')
const jwt = req('jsonwebtoken')
const base = process.env.BASE_URL || 'https://api.choicemee.in'
const client = new Client({ connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000, statement_timeout: 15000 })
;(async () => {
  try {
    await client.connect()
    const result = await client.query("SELECT id,role FROM users WHERE role IN ('admin','customer','user') ORDER BY \"createdAt\" ASC")
    const admin = result.rows.find(row => row.role === 'admin')
    const seller = result.rows.find(row => row.role === 'customer' || row.role === 'user')
    assert.ok(admin && seller)
    const request = async (route, user, method = 'GET', body) => {
      const headers = { 'Content-Type': 'application/json' }
      if (user) headers.Authorization = `Bearer ${jwt.sign({ sub: user.id, role: user.role }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '5m' })}`
      return fetch(`${base}${route}`, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) })
    }
    const route = '/api/admin/couriers/shadowfax/configuration'
    assert.equal((await request(route)).status, 401)
    assert.equal((await request(route, seller)).status, 403)
    const config = await request(route, admin)
    assert.equal(config.status, 200)
    const { data } = await config.json()
    assert.equal(data.enabled, false, 'Shadowfax must remain inactive for this release')
    assert.equal(data.hasApiToken, false)
    assert.equal(data.hasOAuthCredentials, false)
    assert.equal('apiKey' in data, false)
    assert.equal('password' in data, false)
    assert.equal('webhookSecret' in data, false)
    const unavailable = await request('/api/admin/couriers/shadowfax/forward/track', admin, 'POST', { awbNumber: 'SFTEST123' })
    assert.equal(unavailable.status, 503, 'Unconfigured carrier must fail closed')
    const callback = await request('/api/webhooks/shadowfax', null, 'POST', { awb_number: 'SFTEST123' })
    assert.equal(callback.status, 503, 'Unconfigured callbacks must not accept events')
    const { rows: [catalog] } = await client.query('SELECT "isEnabled" AS enabled FROM couriers WHERE id=101 AND "serviceProvider"=$1', ['shadowfax'])
    assert.equal(catalog.enabled, false)
    const { rows: [counts] } = await client.query(`SELECT
      (SELECT count(*)::int FROM choicemee_shadowfax_bookings) AS bookings,
      (SELECT count(*)::int FROM choicemee_shadowfax_callbacks) AS callbacks`)
    assert.deepEqual(counts, { bookings: 0, callbacks: 0 })
    console.log('PASS Shadowfax admin authorization, seller rejection, secret redaction, inactive gate, callback gate and empty journals')
  } finally { await client.end() }
})().then(() => process.exit(0)).catch(error => { console.error(error.message); process.exit(1) })
