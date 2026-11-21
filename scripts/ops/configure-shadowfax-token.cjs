// Explicit operator action: reads an existing production token from stdin, never logs it.
// Does not enable booking, change other couriers, or alter the runtime database URL.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { createHash } = require('node:crypto')
const { createRequire } = require('node:module')
const req = createRequire('/opt/choicemee/source/apps/backend/package.json')
Object.assign(process.env, req('dotenv').parse(fs.readFileSync('/opt/choicemee/shared/backend.env')))
const { Client } = req('pg')
const jwt = req('jsonwebtoken')
const client = new Client({ connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000, statement_timeout: 15000 })
const base = process.env.BASE_URL || 'https://api.choicemee.in'
assert.ok(['https://api.choicemee.in', 'http://127.0.0.1:5013'].includes(base))
const fingerprint = rows => createHash('sha256').update(JSON.stringify(rows)).digest('hex')
;(async () => {
  let productionToken = fs.readFileSync(0, 'utf8').trim().replace(/^Token\s+/i, '')
  assert.match(productionToken, /^[A-Za-z0-9_-]{20,255}$/)
  try {
    await client.connect()
    const { rows: [admin] } = await client.query("SELECT id,role FROM users WHERE role='admin' LIMIT 1")
    assert.ok(admin)
    const otherCredentials = async () => (await client.query("SELECT * FROM courier_credentials WHERE provider <> 'shadowfax' ORDER BY provider")).rows
    const preservedFields = async () => (await client.query("SELECT client_id,password,webhook_secret FROM courier_credentials WHERE provider='shadowfax'")).rows[0] || { client_id: '', password: '', webhook_secret: '' }
    const othersBefore = fingerprint(await otherCredentials())
    const preservedBefore = fingerprint(await preservedFields())
    const auth = jwt.sign({ sub: admin.id, role: admin.role }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '5m' })
    const response = await fetch(`${base}/api/admin/couriers/credentials/shadowfax`, {
      method: 'PUT', headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ productionToken }), signal: AbortSignal.timeout(30000),
    })
    assert.equal(response.status, 200, 'Token save request failed')
    const result = await response.json()
    assert.equal(result.success, true)
    assert.equal(JSON.stringify(result).includes(productionToken), false)
    const { rows: [saved] } = await client.query("SELECT api_key,api_base FROM courier_credentials WHERE provider='shadowfax'")
    assert.equal(saved.api_key, productionToken)
    assert.equal(saved.api_base, 'https://dale.shadowfax.in/api')
    productionToken = ''
    assert.equal(fingerprint(await otherCredentials()), othersBefore, 'Other courier credentials changed')
    assert.equal(fingerprint(await preservedFields()), preservedBefore, 'OAuth/callback configuration changed')
    const config = await fetch(`${base}/api/admin/couriers/shadowfax/configuration`, { headers: { Authorization: `Bearer ${auth}` }, signal: AbortSignal.timeout(30000) })
    assert.equal(config.status, 200)
    const { data } = await config.json()
    assert.equal(data.enabled, false)
    assert.equal(data.hasApiToken, true)
    const { rows: [catalog] } = await client.query('SELECT "isEnabled" AS enabled FROM couriers WHERE id=101 AND "serviceProvider"=$1', ['shadowfax'])
    assert.equal(catalog.enabled, false)
    console.log('PASS production token saved and redacted; other credentials, OAuth/callback settings and inactive booking preserved')
  } finally { productionToken = ''; void client.end().catch(() => {}) }
})().then(() => setTimeout(() => process.exit(0), 250)).catch(() => {
  console.error('Shadowfax token setup did not pass verification; inspect metadata without logging secrets.')
  setTimeout(() => process.exit(1), 250)
})
