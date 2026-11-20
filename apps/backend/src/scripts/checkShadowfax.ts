import assert from 'node:assert/strict'
import { ShadowfaxService, ShadowfaxError, shadowfaxBase, validateShadowfaxOrder } from '../models/services/couriers/shadowfax.service'
import { buildShadowfaxPayload, normalizeShadowfaxTracking, shadowfaxOrderId, shadowfaxStatus, shadowfaxWeightKg } from '../models/services/couriers/shadowfaxPayload'
import { getShadowfaxService, placeShadowfaxBooking } from '../models/services/shadowfaxIntegration.service'
import { pool } from '../models/client'

let checks = 0
const check = async (name: string, run: () => any) => { await run(); checks++; console.log(`PASS ${name}`) }
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
const params: any = {
  order_number: 'TEST-001', payment_type: 'prepaid', order_amount: 500,
  package_weight: 0.5, package_length: 20, package_breadth: 10, package_height: 10,
  consignee: { name: 'Test Buyer', phone: '9999999999', address: 'Test customer street', city: 'Delhi', state: 'Delhi', pincode: '110001' },
  pickup: { name: 'Warehouse contact', phone: '9888888888', address: 'Test warehouse street', city: 'Bangalore', state: 'Karnataka', pincode: '560001' },
  company: { name: 'Test seller' },
  order_items: [{ name: 'Test product', sku: 'SKU1', price: 500, qty: 1 }],
}
const payload = buildShadowfaxPayload(params, 'seller-one', 'forward')
const reversePayload = buildShadowfaxPayload({ ...params, payment_type: 'reverse', pickup: params.consignee, consignee: params.pickup }, 'seller-one', 'reverse')
const calls: any[] = []
let response: any = { message: 'Success', data: { awb_number: 'SF1234' } }
let transportFailure: any = null
const fake: any = { request: async (config: any) => {
  calls.push(config)
  if (transportFailure) throw transportFailure
  if (config.url.endsWith('/token/')) return { data: { access_token: 'test-bearer', expires_in: 3600 } }
  return { data: clone(response) }
} }
const service = new ShadowfaxService({ apiKey: 'test-token' }, fake)
const last = () => calls[calls.length - 1]

async function main() {
  await check('official host allowlist and staging default', () => {
    assert.equal(shadowfaxBase(), 'https://dale.staging.shadowfax.in/api')
    for (const url of ['http://dale.shadowfax.in/api', 'https://attacker.example/api', 'https://dale.shadowfax.in/api@attacker.example']) assert.throws(() => shadowfaxBase(url))
  })
  await check('seller-scoped stable order IDs and warehouse phone', () => {
    assert.notEqual(shadowfaxOrderId('a', '1'), shadowfaxOrderId('b', '1'))
    assert.equal(payload.pickup_details?.contact, '9888888888')
    assert.equal(payload.order_details.actual_weight, 0.5)
    assert.equal(shadowfaxWeightKg(500), 0.5)
    assert.equal(payload.order_details.volumetric_weight, 0.4)
    assert.equal(reversePayload.customer_details.contact, '9999999999')
    assert.equal(reversePayload.return_details.contact, '9888888888')
    assert.equal(reversePayload.sku_details?.[0].qc_required, false)
  })
  await check('prepaid/COD, high-value and empty-product validation', () => {
    validateShadowfaxOrder('forward', payload)
    const cod = buildShadowfaxPayload({ ...params, payment_type: 'cod' }, 'seller-one', 'forward')
    assert.equal(cod.order_details.cod_amount, 500)
    assert.throws(() => validateShadowfaxOrder('forward', { ...payload, product_details: [] }))
    assert.throws(() => buildShadowfaxPayload({ ...params, order_amount: 50000 }, 'seller-one', 'forward'))
    assert.throws(() => buildShadowfaxPayload({ ...params, consignee: { ...params.consignee, pincode: 'bad' } }, 'seller-one', 'forward'))
  })
  for (const direction of ['forward', 'reverse'] as const) {
    await check(`${direction}: booking endpoint, auth, timeout and redirects`, async () => {
      await service.placeOrder(direction, direction === 'forward' ? payload : reversePayload)
      assert.ok(last().url.endsWith(direction === 'forward' ? '/v3/clients/orders/' : '/v1/clients/pickup/orders/'))
      assert.equal(last().headers.Authorization, 'Token test-token')
      assert.equal(last().timeout, 20000)
      assert.equal(last().maxRedirects, 0)
    })
    await check(`${direction}: update and cancellation contract`, async () => {
      response = { message: 'Request accepted.' }
      await service.updateOrder(direction, { awb_number: 'SF1234', pickup_details: { contact: '9888888888' } })
      assert.ok(last().url.endsWith('/v3/clients/order_update/'))
      response = { responseCode: 200, responseMsg: 'Request has been marked as cancelled' }
      assert.equal((await service.cancelOrder(direction, 'SF1234')).success, true)
      assert.ok(last().url.endsWith(direction === 'forward' ? '/v3/clients/orders/cancel/' : '/v2/clients/requests/mark_cancel'))
    })
    await check(`${direction}: single and bulk tracking contract`, async () => {
      response = {}
      await service.trackOrder(direction, 'SF1234')
      assert.ok(last().url.endsWith(direction === 'forward' ? '/v4/clients/orders/SF1234/track/' : '/v4/clients/requests/SF1234'))
      await service.bulkTrack(direction, ['SF1234', 'SF1235'])
      assert.deepEqual(last().data, direction === 'forward' ? { awb_numbers: ['SF1234', 'SF1235'] } : { request_ids: ['SF1234', 'SF1235'] })
      assert.ok(last().url.endsWith(direction === 'forward' ? '/v4/clients/bulk_track/' : '/v4/clients/requests/bulk_query'))
    })
    await check(`${direction}: serviceability and rates include GST`, async () => {
      response = [{ code: 110001, services: ['Regular'] }]
      await service.serviceability(direction === 'forward' ? 'customer_delivery' : 'customer_pickup', ['110001'])
      assert.equal(last().params.pincodes, '110001')
      response = { message: 'Success', shipping_rate: '69.00', gst: '12.42' }
      const quote = await service.rate('560001', '110001', direction, 0.5)
      assert.equal(quote.total, 81.42)
      assert.equal(last().data.weight, 0.5)
      assert.equal(last().data.service, direction)
    })
    await check(`${direction}: POD and AWB generation`, async () => {
      response = { message: 'Success', pod_details: {} }
      await service.pod(['SF1234'])
      assert.ok(last().url.endsWith('/v1/clients/pod_details/'))
      assert.deepEqual(last().data, { awb_numbers: ['SF1234'] })
      response = { message: 'Success', awb_numbers: ['SF1234'] }
      await service.generateAwbs(direction, 1)
      assert.ok(last().url.endsWith(direction === 'forward' ? '/v3/clients/generate_marketplace_awb/' : '/v3/clients/orders/generate_awb/'))
    })
    response = { message: 'Success', data: { awb_number: 'SF1234' } }
  }
  await check('forward labels PDF and PRN', async () => {
    response = { message: 'Success', data: { label_url: 'https://example.test/label.pdf' } }
    for (const type of ['pdf', 'prn'] as const) {
      await service.label('SF1234', type)
      assert.ok(last().url.endsWith('/client/generate_label/'))
      assert.equal(last().data.file_type, type)
    }
  })
  await check('escalation categories discovered before submission', async () => {
    response = { message: 'Success', client_issue_category_mapping: { Delay: 1 } }
    await service.escalationCategories('SF1234')
    assert.equal(last().method, 'GET')
    await service.raiseEscalation('SF1234', 1, 'Test')
    assert.equal(last().method, 'POST')
    assert.equal(last().data.issue_category, 1)
    await assert.rejects(() => service.raiseEscalation('SF1234', 6), ShadowfaxError)
  })
  await check('fresh AWB async request and pending result', async () => {
    response = { status: 'SUCCESS', request_id: 1, delay_time: 120 }
    await service.requestFreshAwbs('forward', 2)
    assert.deepEqual(last().data, { awb_count: 2, request_type: 'fwd' })
    await service.requestFreshAwbs('reverse', 2)
    assert.equal(last().data.request_type, 'rev')
    response = { status: 'PENDING', retry_flag: true }
    assert.equal((await service.pollFreshAwbs(1)).retry_flag, true)
    assert.ok(last().url.endsWith('/v1/clients/awb/1/'))
  })
  await check('HTTP 200 business failure is not a booking', async () => {
    response = { message: 'Failure', errors: 'Unserviceable pincode' }
    await assert.rejects(() => service.placeOrder('forward', payload), (e: any) => e.statusCode === 422 && !e.ambiguous)
  })
  await check('flat reverse duplicate response preserves original AWB', async () => {
    response = { client_order_number: reversePayload.order_details.client_order_id, client_request_id: 'R1234', request_type: 'pickup', status: 'New' }
    assert.equal((await service.placeOrder('reverse', reversePayload)).data.awb_number, 'R1234')
  })
  await check('null quote is unavailable, not free shipping', async () => {
    response = { message: 'Rate not available for this origin and destination', shipping_rate: null, gst: null }
    assert.equal((await service.rate('560001', '110001', 'forward', 0.5)).total, null)
  })
  await check('batch limits, path injection and reverse status restrictions', async () => {
    await assert.rejects(async () => service.bulkTrack('forward', Array(51).fill('SF1234')))
    await assert.rejects(async () => service.pod(Array(101).fill('SF1234')))
    await assert.rejects(async () => service.trackOrder('forward', '../token'))
    await assert.rejects(async () => service.generateAwbs('reverse', 350001))
    await assert.rejects(async () => service.updateOrder('reverse', { awb_number: 'R1234', status_update: { status: 'rto' } }))
  })
  await check('all route legs and account-specific service tiers checked', async () => {
    const routeFake: any = { request: async (config: any) => ({ data: [{ code: Number(config.params.pincodes), services: ({ seller_pickup: ['Marketplace'], seller_delivery: ['RTS'], customer_delivery: ['Regular'], customer_pickup: ['Regular'] } as any)[config.params.service] }] }) }
    const routeService = new ShadowfaxService({ apiKey: 'test' }, routeFake)
    assert.equal(await routeService.checkRoute('forward', '560001', '110001'), true)
    const wrongTier = new ShadowfaxService({ apiKey: 'test' }, { request: async (config: any) => ({ data: [{ code: Number(config.params.pincodes), services: ['Surface'] }] }) } as any)
    assert.equal(await wrongTier.checkRoute('forward', '560001', '110001'), false)
  })
  await check('OAuth exchange cached across instances without mutation retries', async () => {
    response = {}
    const before = calls.filter(c => c.url.endsWith('/token/')).length
    const config = { clientId: 'test-client', password: 'test-secret' }
    await Promise.all([new ShadowfaxService(config, fake).authorization(), new ShadowfaxService(config, fake).authorization()])
    assert.equal(calls.filter(c => c.url.endsWith('/token/')).length - before, 1)
    transportFailure = { code: 'ETIMEDOUT', config: { headers: { Authorization: 'DO-NOT-LEAK' } } }
    const count = calls.length
    await assert.rejects(() => service.placeOrder('forward', payload), (e: any) => e.ambiguous && !JSON.stringify(e).includes('DO-NOT-LEAK'))
    assert.equal(calls.length - count, 1)
    transportFailure = null
  })
  await check('tracking contracts, latest event first and open-set statuses', () => {
    const tracked = normalizeShadowfaxTracking({ order_details: { status: 'delivered' }, tracking_details: [
      { status_id: 'picked', created: '2026-01-01T10:00:00Z' }, { status_id: 'delivered', created: '2026-01-02T10:00:00Z' },
    ] })
    assert.equal(tracked.status, 'delivered')
    assert.equal(tracked.history[0].status_code, 'delivered')
    assert.equal(shadowfaxStatus('rts_d', true), 'delivered')
    assert.equal(shadowfaxStatus('rts_d', false), 'rto_delivered')
    assert.equal(shadowfaxStatus('future_unknown_status'), null)
    assert.equal(normalizeShadowfaxTracking({ status: 'Bag In Transit', pickup_request_state_histories: [] }, true).status, 'in_transit')
  })
  await check('durable reservation replay, credential rotation and uncertain retry protection', async () => {
    let row: any = null
    let bookings = 0
    const storage = { query: async (sql: string, args: any[]) => {
      if (sql.startsWith('INSERT')) {
        if (row) return { rowCount: 0 }
        row = { seller_id: args[2], payload_hash: args[4], state: 'pending' }
        return { rowCount: 1 }
      }
      if (sql.startsWith('SELECT')) return { rows: [row] }
      if (sql.includes("state='confirmed'")) row = { ...row, state: 'confirmed', response: args[2] }
      if (sql.includes("state='uncertain'")) row.state = 'uncertain'
      if (sql.startsWith('DELETE')) row = null
      return { rowCount: 1 }
    } }
    const bookingService: any = { base: service.base, config: { apiKey: 'first' }, placeOrder: async () => { bookings++; return { data: { awb_number: 'SF1234' } } } }
    await placeShadowfaxBooking(bookingService, 'seller-one', 'forward', payload, storage)
    bookingService.config.apiKey = 'rotated'
    await placeShadowfaxBooking(bookingService, 'seller-one', 'forward', payload, storage)
    assert.equal(bookings, 1)
    row.state = 'uncertain'
    await assert.rejects(() => placeShadowfaxBooking(bookingService, 'seller-one', 'forward', payload, storage), (e: any) => e.statusCode === 409)
    assert.equal(bookings, 1)
    row = null
    bookingService.placeOrder = async () => { throw new ShadowfaxError('Timeout', 502, true) }
    await assert.rejects(() => placeShadowfaxBooking(bookingService, 'seller-one', 'reverse', reversePayload, storage))
    assert.equal(row.state, 'uncertain')
    row = null
    bookingService.placeOrder = async () => { throw new ShadowfaxError('Rejected', 422) }
    await assert.rejects(() => placeShadowfaxBooking(bookingService, 'seller-one', 'reverse', reversePayload, storage))
    assert.equal(row, null)
  })
  await check('disabled booking refuses before loading credentials or contacting carrier', async () => {
    delete process.env.SHADOWFAX_ENABLED
    await assert.rejects(() => getShadowfaxService(true), (e: any) => e.statusCode === 503)
  })
  console.log(`Shadowfax: ${checks} contract/safety groups passed. No live requests or bookings.`)
}
main().then(() => pool.end()).catch(async (error) => { console.error(error); await pool.end(); process.exitCode = 1 })
