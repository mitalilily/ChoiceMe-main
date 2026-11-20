// Isolated process: exercise the real rate service inside ONE rolled-back transaction.
// The QA plan is never committed or assigned to a seller. No carrier calls are made.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createRequire } = require('node:module')
const { randomUUID } = require('node:crypto')
const backend = process.env.CHOICEMEE_STAGED_BACKEND || '/opt/choicemee/source/apps/backend'
const req = createRequire(path.join(backend, 'package.json'))
Object.assign(process.env, req('dotenv').parse(fs.readFileSync('/opt/choicemee/shared/backend.env')))
process.env.NODE_ENV = 'production'
const clientModule = req(path.join(backend, 'dist/models/client'))
const { drizzle } = req('drizzle-orm/node-postgres')

;(async () => {
  const connection = await clientModule.pool.connect()
  const originalDb = clientModule.db
  let rolledBack = false
  try {
    await connection.query('BEGIN')
    await connection.query("SET LOCAL statement_timeout = '15s'")
    clientModule.db = drizzle(connection)
    const { updateShippingRate, getShippingRates, upsertShippingRate } = req(path.join(backend, 'dist/models/services/courierIntegration.service'))
    const { rows: [courier] } = await connection.query('SELECT "isEnabled" FROM couriers WHERE id=101 AND "serviceProvider"=$1', ['shadowfax'])
    assert.equal(courier.isEnabled, false)
    const { rows: [zone] } = await connection.query("SELECT id,code FROM zones WHERE business_type='b2c' LIMIT 1")
    assert.ok(zone)
    const plan = randomUUID()
    await connection.query('INSERT INTO plans(id,name,is_active) VALUES($1,$2,false)', [plan, 'Shadowfax rolled-back QA'])
    const payload = {
      courier_name: 'Shadowfax', service_provider: 'shadowfax', businessType: 'b2c', mode: 'surface',
      cod_charges: 40, cod_percent: 2, min_weight: 0,
      rates: { [zone.id]: { forward: 70, rto: 60 } },
      zone_slabs: { [zone.id]: { forward: [{ weight_from: 0, weight_to: 0.5, rate: 70 }], rto: [{ weight_from: 0, weight_to: 0.5, rate: 60 }] } },
      cod_slabs: [{ amount_from: 0, amount_to: null, charge_type: 'flat', charge_value: 40 }],
    }
    await updateShippingRate(101, payload, plan)
    const filters = { plan_id: plan, business_type: 'b2c', courier_name: ['Shadowfax'] }
    const visible = await getShippingRates(filters, { includeInactive: true })
    assert.equal(visible.length, 1, 'Admin must see the disabled courier rate card')
    assert.equal(visible[0].service_provider, 'shadowfax')
    assert.equal((await getShippingRates(filters)).length, 0, 'Inactive card must stay unavailable to sellers')
    await updateShippingRate(101, { ...payload, rates: { [zone.id]: { forward: 75, rto: 65 } }, zone_slabs: {}, cod_slabs: [] }, plan)
    const { rows: updated } = await connection.query('SELECT type,rate FROM shipping_rates WHERE plan_id=$1 ORDER BY type', [plan])
    assert.deepEqual(updated.map(row => [row.type, Number(row.rate)]), [['forward', 75], ['rto', 65]])
    await assert.rejects(updateShippingRate(101, { ...payload, businessType: 'b2b' }, plan), /B2C/)
    await assert.rejects(upsertShippingRate({ courier_id: '101', courier_name: 'Shadowfax', service_provider: 'shadowfax', plan_id: plan, mode: 'surface', business_type: 'b2b', rates: [] }), /B2C/)
    await connection.query('ROLLBACK')
    rolledBack = true
    const { rows: [remaining] } = await connection.query('SELECT count(*)::int AS count FROM plans WHERE id=$1', [plan])
    assert.equal(remaining.count, 0)
    console.log('PASS Shadowfax rate-card create, read, update, slab/COD paths, disabled visibility, B2B rejection and confirmed rollback')
  } finally {
    if (!rolledBack) await connection.query('ROLLBACK').catch(() => {})
    clientModule.db = originalDb
    connection.release()
    void clientModule.pool.end().catch(() => {})
  }
})().then(() => setTimeout(() => process.exit(0), 250)).catch(error => {
  console.error(error.message)
  setTimeout(() => process.exit(1), 250)
})
