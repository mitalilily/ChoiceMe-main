// Read-only production audit. Run from apps/backend with runtime env loaded.
const fs = require('node:fs')
const { createRequire } = require('node:module')
const req = createRequire(process.cwd() + '/package.json')
const envFile = process.env.BACKEND_ENV_FILE || '/opt/choicemee/shared/backend.env'
Object.assign(process.env, req('dotenv').parse(fs.readFileSync(envFile)))
const { pool } = req('./dist/models/client')
const { presignDownload } = req('./dist/models/services/upload.service')
const Papa = req('papaparse')

;(async () => {
  let bad = 0,
    failed = 0
  try {
    const invoices = (await pool.query('SELECT id,seller_id,csv_url FROM "billingInvoices"')).rows
    const rows = (
      await pool.query(
        "SELECT user_id,upper(trim(awb_number)) awb FROM b2c_orders WHERE nullif(trim(awb_number),'') IS NOT NULL UNION ALL SELECT user_id,upper(trim(awb_number)) FROM b2b_orders WHERE nullif(trim(awb_number),'') IS NOT NULL",
      )
    ).rows
    const owners = new Map()
    for (const row of rows) {
      if (!owners.has(row.awb)) owners.set(row.awb, new Set())
      owners.get(row.awb).add(row.user_id)
    }
    for (let i = 0; i < invoices.length; i += 4) {
      await Promise.all(
        invoices.slice(i, i + 4).map(async (invoice) => {
          try {
            const urls = await presignDownload(invoice.csv_url)
            const response = await fetch(Array.isArray(urls) ? urls[0] : urls, {
              signal: AbortSignal.timeout(15000),
            })
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            const parsed = Papa.parse(await response.text(), { header: true, skipEmptyLines: true })
            const seen = new Set()
            let duplicates = 0,
              foreign = 0
            for (const row of parsed.data) {
              const awb = String(row.AWB || row['AWB Number'] || '')
                .trim()
                .toUpperCase()
              if (!awb || awb === '-' || awb === 'N/A') continue
              if (seen.has(awb)) duplicates++
              seen.add(awb)
              if (owners.has(awb) && !owners.get(awb).has(invoice.seller_id)) foreign++
            }
            if (duplicates || foreign) {
              bad++
              console.log(
                'BAD_INVOICE',
                JSON.stringify({ id: invoice.id, rows: parsed.data.length, duplicates, foreign }),
              )
            }
          } catch (error) {
            failed++
            console.log('CSV_AUDIT_FAILED', invoice.id, error.message)
          }
        }),
      )
      console.log('AUDIT_PROGRESS', Math.min(i + 4, invoices.length), '/', invoices.length)
    }
    console.log('CSV_AUDIT_SUMMARY', JSON.stringify({ checked: invoices.length, bad, failed }))
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
})()
