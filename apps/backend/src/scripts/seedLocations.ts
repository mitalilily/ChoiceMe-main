// src/scripts/seedLocations.ts
import fs from 'fs'
import path from 'path'
import XLSX from 'xlsx'
import { db } from '../models/client'
import { locations } from '../schema/schema'

const DATA_DIR = path.resolve('src/scripts/data')
const CHUNK_SIZE = 1000

type Row = {
  pincode: string
  city: string
  state: string
  country: string
  tags: string[]
}

function normalize(x: any): string {
  return (x ?? '').toString().trim()
}

function locationKey(row: Pick<Row, 'pincode' | 'city' | 'state'>): string {
  return `${row.pincode}|${row.city.toLowerCase()}|${row.state.toLowerCase()}`
}

const SPECIAL_ZONE_STATES = new Set(
  [
    'Arunachal Pradesh',
    'Assam',
    'Manipur',
    'Meghalaya',
    'Mizoram',
    'Nagaland',
    'Tripura',
  ].map((s) => s.toLowerCase()),
)

function mapRow(raw: Record<string, any>): Row | null {
  const pincode = normalize(raw.Pincode)
  if (!pincode || !/^\d{6}$/.test(pincode)) return null

  const state = normalize(raw.HubState)
  const city = normalize(raw.BillingCity)
  const billingZone = normalize(raw.BillingZone)
  const cityType = normalize(raw['City Type'])

  const tags: string[] = []
  if (billingZone) tags.push(billingZone.toLowerCase())
  if (cityType) tags.push(cityType.toLowerCase())
  if (state && SPECIAL_ZONE_STATES.has(state.toLowerCase())) {
    tags.push('special_zone')
  }

  return { pincode, city, state, country: 'India', tags }
}

async function insertBatch(rows: Row[]) {
  if (!rows.length) return

  await db.insert(locations).values(
    rows.map((row) => ({
      pincode: row.pincode,
      city: row.city,
      state: row.state,
      country: row.country,
      tags: row.tags,
      created_at: new Date(),
    })),
  )

  console.log(`Inserted ${rows.length} rows`)
}

async function importXlsx(filename: string) {
  const fullPath = path.join(DATA_DIR, filename)
  if (!fs.existsSync(fullPath)) {
    console.error('File not found:', fullPath)
    return
  }

  console.log('Reading XLSX:', fullPath)

  const workbook = XLSX.readFile(fullPath)
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const jsonRows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

  console.log('Total rows parsed:', jsonRows.length)

  const existingRows = await db
    .select({
      pincode: locations.pincode,
      city: locations.city,
      state: locations.state,
    })
    .from(locations)
  const existingKeys = new Set(existingRows.map(locationKey))

  let batch: Row[] = []
  let inserted = 0
  let skipped = 0

  for (const raw of jsonRows) {
    const mapped = mapRow(raw)
    if (!mapped) continue

    const key = locationKey(mapped)
    if (existingKeys.has(key)) {
      skipped++
      continue
    }

    existingKeys.add(key)
    batch.push(mapped)

    if (batch.length >= CHUNK_SIZE) {
      await insertBatch(batch)
      inserted += batch.length
      console.log(`Processed ${inserted} new rows`)
      batch = []
    }
  }

  if (batch.length) {
    await insertBatch(batch)
    inserted += batch.length
  }

  console.log(`Import finished. Inserted: ${inserted}, skipped existing: ${skipped}`)
}

;(async () => {
  const filename = process.argv[2]
  if (!filename) {
    console.error('Usage: node dist/scripts/seedLocations.js <file.xlsx>')
    process.exit(1)
  }

  try {
    await importXlsx(filename)
  } catch (err) {
    console.error('Import failed:', (err as Error).message)
    process.exitCode = 1
  }
})()
