import fs from 'node:fs'
import path from 'node:path'
import { and, eq } from 'drizzle-orm'
import Papa from 'papaparse'
import { db, pool } from '../models/client'
import { billingInvoices } from '../models/schema/billingInvoices'
import {
  buildSellerBillingCsv,
  getInvoiceShipmentRows,
} from '../models/services/billingCsv.service'
import { presignDownload, uploadBufferToR2 } from '../models/services/upload.service'
import { normalizeAwb } from '../utils/shipmentIdentity'
import { r2 } from '../config/r2Client'

/** Dry-run by default. Old R2 objects and invoice financial totals are retained. */
async function main() {
  const apply = process.argv.includes('--apply')
  const reportDir = path.resolve(process.env.EXPORT_BACKFILL_REPORT_DIR || 'tmp/export-backfill')
  fs.mkdirSync(reportDir, { recursive: true, mode: 0o700 })
  const reportPath = path.join(reportDir, `${Date.now()}-${apply ? 'apply' : 'audit'}.json`)
  const report: Record<string, any> = {
    apply,
    startedAt: new Date().toISOString(),
    repaired: 0,
    unchanged: 0,
    blocked: 0,
    records: [],
  }
  const save = () => fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), { mode: 0o600 })
  save()
  const invoices = await db.select().from(billingInvoices)
  for (const invoice of invoices) {
    try {
      const source = await getInvoiceShipmentRows(invoice)
      const canonical = buildSellerBillingCsv(source, invoice.sellerId)
      const urlResult = await presignDownload(invoice.csvUrl)
      const url = Array.isArray(urlResult) ? urlResult[0] : urlResult
      if (!url) throw new Error('Existing CSV cannot be downloaded')
      const response = await fetch(url, { signal: AbortSignal.timeout(20000) })
      if (!response.ok) throw new Error(`Existing CSV returned HTTP ${response.status}`)
      const oldCsv = await response.text()
      const parsed = Papa.parse<Record<string, string>>(oldCsv, {
        header: true,
        skipEmptyLines: true,
      })
      const seen = new Set<string>()
      let duplicates = 0
      const allowed = new Set(source.map((row) => normalizeAwb(row.awb_number)).filter(Boolean))
      let foreign = 0
      for (const row of parsed.data) {
        const awb = normalizeAwb(row.AWB || row['AWB Number'])
        if (awb && awb !== '-' && awb !== 'N/A') {
          if (seen.has(awb)) duplicates++
          seen.add(awb)
          if (!allowed.has(awb)) foreign++
        }
      }
      const record: Record<string, any> = {
        id: invoice.id,
        sellerId: invoice.sellerId,
        oldCsvKey: invoice.csvUrl,
        rowsBefore: parsed.data.length,
        rowsAfter: canonical.orders.length,
        duplicates,
        foreign,
        expectedTaxable: Number(invoice.taxableValue),
        csvTaxable: canonical.taxableValue,
      }
      if (oldCsv.replace(/^\uFEFF/, '').trim() === canonical.csv.replace(/^\uFEFF/, '').trim()) {
        report.unchanged++
        continue
      }
      if (
        !source.length ||
        Math.abs(Number(invoice.taxableValue || 0) - canonical.taxableValue) > 0.02
      ) {
        record.status = 'blocked-financial-review'
        report.blocked++
      } else if (!apply) record.status = 'would-repair'
      else {
        // Back up the full original CSV before publishing a new object.
        fs.writeFileSync(path.join(reportDir, `${invoice.id}-${Date.now()}-original.csv`), oldCsv, {
          mode: 0o600,
        })
        const upload = await uploadBufferToR2({
          buffer: Buffer.from(canonical.csv, 'utf8'),
          filename: `${invoice.invoiceNo}-seller-records.csv`,
          contentType: 'text/csv; charset=utf-8',
          userId: invoice.sellerId,
          folderKey: 'invoices',
        })
        record.newCsvKey = upload.key
        record.status = 'uploaded'
        report.records.push(record)
        save()
        const updated = await db
          .update(billingInvoices)
          .set({ csvUrl: upload.key, updatedAt: new Date() })
          .where(
            and(
              eq(billingInvoices.id, invoice.id),
              eq(billingInvoices.sellerId, invoice.sellerId),
              eq(billingInvoices.csvUrl, invoice.csvUrl),
            ),
          )
          .returning({ id: billingInvoices.id })
        if (!updated.length)
          throw new Error('Invoice changed concurrently; new CSV was not published')
        record.status = 'repaired'
        report.repaired++
        save()
        continue
      }
      report.records.push(record)
      save()
    } catch (error) {
      report.blocked++
      report.records.push({
        id: invoice.id,
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
      })
      save()
    }
  }
  report.completedAt = new Date().toISOString()
  save()
  console.log(
    JSON.stringify({
      reportPath,
      apply,
      checked: invoices.length,
      repaired: report.repaired,
      unchanged: report.unchanged,
      blocked: report.blocked,
      duplicateCsvFiles: report.records.filter((r: any) => r.duplicates > 0).length,
      foreignCsvFiles: report.records.filter((r: any) => r.foreign > 0).length,
    }),
  )
  if (report.blocked) process.exitCode = 2
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    void pool.end()
    r2.destroy()
    setTimeout(() => process.exit(process.exitCode || 0), 250)
  })
