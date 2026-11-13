import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { uniqueShipments } from '../utils/shipmentIdentity'
import { buildSellerBillingCsv } from '../models/services/billingCsv.service'
import { buildShipmentLabelPdfBuffer } from '../models/services/choicemeLabel.service'

async function main() {
  const seller = 'seller-a'
  const records = [
    {
      id: 'old',
      user_id: seller,
      awb_number: ' 00123 ',
      freight_charges: 45,
      cod_charges: 0,
      updated_at: '2026-11-01',
      type: 'b2c',
    },
    {
      id: 'latest',
      user_id: seller,
      awb_number: '00123',
      freight_charges: 45,
      cod_charges: 0,
      updated_at: '2026-11-02',
      type: 'b2c',
    },
    { id: 'other-seller', user_id: 'seller-b', awb_number: '00123', type: 'b2c' },
    { id: 'draft1', user_id: seller, awb_number: null, type: 'b2c' },
    { id: 'draft2', user_id: seller, awb_number: '', type: 'b2c' },
  ]
  const unique = uniqueShipments(records)
  assert.equal(unique.length, 4)
  assert.equal(
    unique.find((row) => row.user_id === seller && row.awb_number === '00123')?.id,
    'latest',
  )
  assert.throws(() => uniqueShipments(records, seller), /requested seller/)
  const billing = buildSellerBillingCsv(
    records.filter((row) => row.user_id === seller),
    seller,
  )
  assert.equal(billing.orders.length, 3)
  assert.equal(billing.taxableValue, 45)
  assert.match(billing.csv, /Seller ID/)
  assert.equal((billing.csv.match(/00123/g) ?? []).length, 1)

  const outputDir = path.resolve(process.cwd(), '../../tmp/pdfs')
  await fs.mkdir(outputDir, { recursive: true })
  const base = {
    order: {
      order_number: 'QA-ORDER-001',
      awb_number: '001234567890',
      payment_type: 'cod',
      shipping_mode: 'surface',
      weight: 500,
      length: 10,
      breadth: 10,
      height: 10,
      order_amount: 599,
      shipping_charges: 50,
    },
    sellerName: 'Sample seller',
    sellerLogoDataUrl: null,
    sellerAddressLines: ['Warehouse 500, Industrial Area', 'Delhi, Delhi - 110001'],
    sellerContact: '9999900500',
    customerName: 'Sample customer',
    customerPhone: '9999900001',
    customerAddressLines: ['House 12, Sample Street', 'Srinagar, Jammu and Kashmir - 190001'],
    orderDate: '13 Nov 2026',
    invoiceNo: 'QA-INV-001',
    paymentMethod: 'COD',
    paymentColor: '#111111',
    normalizedItems: Array.from({ length: 3 }, (_, index) => ({
      productId: `SKU-${index + 1}`,
      productName: 'Sample garment for verification',
      unitPrice: 199,
      quantity: 1,
      lineTotal: 199,
    })),
    footerUrl: 'https://choicemee.in',
  }
  for (const variant of [
    {
      name: 'label-note-enabled',
      noteEnabled: true,
      labelNote: 'Please check the package seal before accepting delivery.',
    },
    {
      name: 'label-note-disabled',
      noteEnabled: false,
      labelNote: 'This hidden note must never appear.',
    },
    {
      name: 'label-note-long',
      noteEnabled: true,
      labelNote:
        'Please keep this parcel dry and handle it with care. Contact the warehouse for any delivery questions. '
          .repeat(3)
          .slice(0, 240),
    },
  ]) {
    const pdf = await buildShipmentLabelPdfBuffer({
      ...base,
      preferences: { ...variant, maxItems: 3, charLimit: 25 },
    })
    await fs.writeFile(path.join(outputDir, `${variant.name}.pdf`), pdf)
    console.log('LABEL_FIXTURE', variant.name, pdf.length)
  }
  console.log(
    'PASS: seller-aware shipment identity, blank-AWB drafts, leading zeros, billing totals and label fixtures',
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
