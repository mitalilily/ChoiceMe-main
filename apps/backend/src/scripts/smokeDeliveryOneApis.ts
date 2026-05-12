import { DeliveryOneService } from '../models/services/couriers/deliveryone.service'

type SmokeResult = {
  name: string
  ok: boolean
  countedAsReached: boolean
  status: string | number
  message?: string
  keys?: string[]
}

const boolEnv = (value: unknown) =>
  ['1', 'true', 'yes', 'y'].includes(String(value || '').trim().toLowerCase())

const stamp = Date.now()
const apiBase =
  process.env.DELIVERY_ONE_SMOKE_API_BASE ||
  process.env.DELIVERY_ONE_API_BASE ||
  process.env.DELIVERYONE_API_BASE ||
  'https://staging-express.delhivery.com'
const apiKey =
  process.env.DELIVERY_ONE_SMOKE_API_KEY ||
  process.env.DELIVERY_ONE_API_KEY ||
  process.env.DELIVERYONE_API_KEY ||
  'XXXXXXXXXXXXXXXXX'
const includeMutations = boolEnv(process.env.DELIVERY_ONE_SMOKE_MUTATIONS)
const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]

process.env.DELIVERY_ONE_API_BASE = apiBase
process.env.DELIVERY_ONE_API_KEY = apiKey
process.env.DELIVERY_ONE_FORCE_ENV_CONFIG = 'true'
DeliveryOneService.clearCachedConfig()

const svc = new DeliveryOneService()
const shipment: any = {
  order_number: `DO-SMOKE-${stamp}`,
  order_amount: 499,
  payment_type: 'prepaid',
  courier_id: 'deliveryone',
  pickup_location_alias: 'registered_wh_name',
  pickup: {
    warehouse_name: 'registered_wh_name',
    name: 'ChoiceMe',
    phone: '9999999999',
    address: 'HUDA Market, Gurugram, Haryana',
    address_2: '',
    city: 'Gurugram',
    state: 'Haryana',
    pincode: '122001',
    country: 'India',
  },
  consignee: {
    name: 'Consignee name',
    phone: '9999999999',
    address: 'Huda Market, Haryana',
    city: 'Gurugram',
    state: 'Haryana',
    pincode: '110042',
    country: 'India',
  },
  order_items: [{ name: 'T-shirt', qty: 1, hsn: '6109' }],
  package_weight: 500,
  package_length: 10,
  package_breadth: 10,
  package_height: 10,
  shipping_mode: 'Surface',
}

const safeTests: Array<[string, () => Promise<any>]> = [
  ['b2c-pincode', () => svc.checkPincodeServiceability('194103')],
  [
    'pair-serviceability',
    () =>
      svc.checkPairServiceability({
        originPincode: '122001',
        destinationPincode: '110042',
        paymentType: 'prepaid',
      }),
  ],
  ['heavy-pincode', () => svc.checkHeavyPincodeServiceability('400086')],
  [
    'shipping-cost',
    () =>
      svc.calculateShippingCost({
        md: 'E',
        ss: 'Delivered',
        d_pin: '110053',
        o_pin: '110042',
        cgm: 10,
        pt: 'Pre-paid',
      }),
  ],
  ['shipment-track', () => svc.trackShipment({ waybill: '111111111111' })],
  [
    'shipping-label',
    () => svc.generateLabel({ waybill: '111111111111', pdf: true, pdf_size: '4R' }),
  ],
]

const mutationTests: Array<[string, () => Promise<any>]> = [
  ['fetch-waybill-single', () => svc.fetchWaybills(1)],
  ['fetch-waybill-bulk', () => svc.fetchWaybills(5)],
  [
    'warehouse-create',
    () =>
      svc.createWarehouse({
        phone: '9999999999',
        city: 'Kota',
        name: 'test_name',
        pin: '110042',
        address: 'address',
        country: 'India',
        email: 'abc@gmail.com',
        registered_name: 'registered_account_name',
        return_address: 'return_address',
        return_pin: '110042',
        return_city: 'Kota',
        return_state: 'Delhi',
        return_country: 'India',
      }),
  ],
  [
    'warehouse-update',
    () =>
      svc.updateWarehouse({
        name: 'registered_wh_name',
        phone: '9988998899',
        address: 'HUDA Market, Gurugram, Haryana - 122001',
        pin: '122001',
      }),
  ],
  ['shipment-create-sps', () => svc.createShipment(shipment)],
  [
    'shipment-create-mps',
    () =>
      svc.createShipment({
        ...shipment,
        order_number: `DO-MPS-${stamp}`,
        mps: true,
        boxes: [
          { waybill: '111111111111', weight: 100 },
          { waybill: '222222222222', weight: 100 },
        ],
      } as any),
  ],
  [
    'shipment-edit',
    () =>
      svc.editShipment({
        waybill: '111111111111',
        name: 'Updated Consignee',
        phone: '9999999999',
        add: 'Updated address',
        gm: 100,
      }),
  ],
  ['shipment-cancel', () => svc.cancelShipment('111111111111')],
  [
    'ewaybill-update',
    () =>
      svc.updateEWaybill({
        waybill: '111111111111',
        dcn: 'INV-001',
        ewbn: '123456789012',
      }),
  ],
  [
    'pickup-request',
    () =>
      svc.createPickupRequest({
        pickup_time: '11:00:00',
        pickup_date: tomorrow,
        pickup_location: 'registered_wh_name',
        expected_package_count: 1,
      }),
  ],
]

const localValidationPatterns = [
  /\bis required\b/i,
  /\bmust be\b/i,
  /provide at least/i,
  /cannot be more/i,
  /supports up to/i,
]

const countedAsProviderReached = (status: string | number, message = '') => {
  if (status === 'success') return true
  if (status === 'unknown') return false

  return !localValidationPatterns.some((pattern) => pattern.test(message))
}

async function runSmoke() {
  const tests = includeMutations ? [...safeTests, ...mutationTests] : safeTests
  const results: SmokeResult[] = []

  for (const [name, run] of tests) {
    try {
      const value = await run()
      results.push({
        name,
        ok: true,
        countedAsReached: true,
        status: 'success',
        keys: value && typeof value === 'object' ? Object.keys(value).slice(0, 8) : [],
      })
    } catch (err: any) {
      const status = err.statusCode || err.status || err.response?.status || 'unknown'
      const message = err.message || 'Unknown error'

      results.push({
        name,
        ok: false,
        countedAsReached: countedAsProviderReached(status, message),
        status,
        message,
      })
    }
  }

  const unexpected = results.filter((result) => !result.countedAsReached)

  console.log(
    JSON.stringify(
      {
        apiBase,
        mode: includeMutations ? 'full' : 'safe',
        total: results.length,
        reachedOrSucceeded: results.length - unexpected.length,
        unexpectedFailures: unexpected.length,
        results,
      },
      null,
      2,
    ),
  )

  if (unexpected.length) process.exit(1)
}

runSmoke().catch((error) => {
  console.error(error)
  process.exit(1)
})
