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
    assert.equal(typeof data.hasApiToken, 'boolean')
    assert.equal(data.hasOAuthCredentials, false)
    assert.equal('apiKey' in data, false)
    assert.equal('password' in data, false)
    assert.equal('webhookSecret' in data, false)
    const unavailable = await request('/api/admin/couriers/shadowfax/forward/track', admin, 'POST', { awbNumber: 'SFTEST123' })
    assert.equal(unavailable.status, data.hasApiToken || data.hasOAuthCredentials ? 404 : 503, 'Unknown order must fail locally without a carrier call')
    const callback = await request('/api/webhooks/shadowfax', null, 'POST', { awb_number: 'SFTEST123' })
    assert.equal(callback.status, 503, 'Unconfigured callbacks must not accept events')
    const credentialRoute = '/api/admin/couriers/credentials/shadowfax'
    assert.equal((await request(credentialRoute, null, 'PUT', { productionToken: 'invalid' })).status, 401)
    assert.equal((await request(credentialRoute, seller, 'PUT', { productionToken: 'invalid' })).status, 403)
    assert.equal((await request(credentialRoute, admin, 'PUT', { productionToken: 'invalid' })).status, 400)
    assert.equal((await request(credentialRoute, admin, 'PUT', { productionToken: 'test-production-token-12345', enabled: true })).status, 400)
    const metadata = await request('/api/admin/couriers/credentials', admin)
    assert.equal(metadata.status, 200)
    const { data: credentials } = await metadata.json()
    assert.equal(credentials.shadowfax.hasApiToken, data.hasApiToken)
    for (const secret of ['apiKey', 'productionToken', 'password', 'webhookSecret']) assert.equal(secret in credentials.shadowfax, false)
    for (const businessType of ['b2c', 'b2b']) {
      const catalogResponse = await request(`/api/couriers/full-list?businessType=${businessType}`, admin)
      assert.equal(catalogResponse.status, 200)
      const catalogData = await catalogResponse.json()
      const rows = Array.isArray(catalogData) ? catalogData : catalogData.data
      assert.ok(Array.isArray(rows), 'Catalog response must contain an array')
      assert.equal(rows.some(row => Number(row.id) === 101 && row.serviceProvider === 'shadowfax'), businessType === 'b2c')
    }
    const ratesRoute = '/api/admin/couriers/shipping-rates?businessType=b2c'
    assert.equal((await request(ratesRoute)).status, 401)
    assert.equal((await request(ratesRoute, seller)).status, 403)
    assert.equal((await request(ratesRoute, admin)).status, 200)
    const { rows: [catalog] } = await client.query('SELECT "isEnabled" AS enabled FROM couriers WHERE id=101 AND "serviceProvider"=$1', ['shadowfax'])
    assert.equal(catalog.enabled, false)
    const { rows: [counts] } = await client.query(`SELECT
      (SELECT count(*)::int FROM choicemee_shadowfax_bookings) AS bookings,
      (SELECT count(*)::int FROM choicemee_shadowfax_callbacks) AS callbacks`)
    assert.deepEqual(counts, { bookings: 0, callbacks: 0 })
    console.log('PASS Shadowfax token-only validation, authorization, redacted metadata, B2C catalog, B2B exclusion, rate access, inactive gate and empty journals')
  } finally { void client.end().catch(() => {}) }
})().then(() => setTimeout(() => process.exit(0), 250)).catch(error => {
  console.error(error.message)
  setTimeout(() => process.exit(1), 250)
})
