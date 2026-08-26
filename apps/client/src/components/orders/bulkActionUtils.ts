import { saveAs } from 'file-saver'
import { PDFDocument } from 'pdf-lib'
import {
  downloadDocumentThroughProxy,
  mergePdfDocumentsThroughProxy,
} from '../../api/upload.api'

export type DocumentType = 'label' | 'invoice' | 'manifest'

export type BulkOrderDocumentShape = {
  id: string | number
  type?: 'b2c' | 'b2b'
  order_number?: string | null
  awb_number?: string | null
  order_status?: string | null
  integration_type?: string | null
  courier_partner?: string | null
  label?: string | null
  label_key?: string | null
  label_url?: string | null
  manifest?: string | null
  manifest_key?: string | null
  manifest_url?: string | null
  invoice_link?: string | null
  invoice_key?: string | null
  invoice_url?: string | null
}

export type DocumentEntry = {
  key?: string | null
  url?: string | null
  fileName: string
}

export type ResolvedDocumentEntry = DocumentEntry & {
  url: string
}

export type MergedPdfLayout = 'single' | 'a4_4up'

export type LabelGenerationFailure<T extends BulkOrderDocumentShape> = {
  order: T
  error: unknown
}

export {
  BULK_MANIFEST_LIMIT,
  getB2CManifestIdentifier,
  getB2CManifestProvider,
  isB2CCancelledStatus,
  isB2CManifestEligible,
} from './b2c/orderActionRules'

type ApiLikeError = {
  code?: string
  request?: unknown
  response?: {
    data?: {
      message?: string
      error?: string
    }
  }
  message?: string
}

export const isHttpUrl = (value?: string | null) => typeof value === 'string' && /^https?:\/\//i.test(value)

const trimStoredValue = (value?: string | null) => String(value || '').trim()

const pickStoredKey = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    const trimmed = trimStoredValue(value)
    if (trimmed && !isHttpUrl(trimmed)) {
      return trimmed
    }
  }
  return null
}

const pickStoredUrl = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    const trimmed = trimStoredValue(value)
    if (isHttpUrl(trimmed)) {
      return trimmed
    }
  }
  return null
}

const sanitizeFileNameSegment = (value: string) =>
  value
    .trim()
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

const getFileExtension = (value?: string | null) => {
  if (!value) return '.pdf'

  const path = isHttpUrl(value)
    ? (() => {
        try {
          return new URL(value).pathname
        } catch {
          return value
        }
      })()
    : value

  const match = path.match(/\.[a-z0-9]+$/i)
  return match?.[0] || '.pdf'
}

const triggerBrowserDownload = (url: string, fileName: string) => {
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.target = '_blank'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export const downloadFile = async (url: string, fileName: string) => {
  try {
    const blob = await downloadDocumentThroughProxy(url, {
      downloadName: fileName,
      disposition: 'attachment',
    })
    saveAs(blob, fileName)
  } catch (error) {
    console.warn('Falling back to browser download for bulk file:', error)
    triggerBrowserDownload(url, fileName)
  }
}

const A4_PAGE = { width: 595.28, height: 841.89 }
const A4_4UP_MARGIN = 18
const A4_4UP_GUTTER = 8

const drawPageOnA4Cell = async (
  targetPdf: PDFDocument,
  sourcePdf: PDFDocument,
  sourcePageIndex: number,
  targetPage: ReturnType<PDFDocument['addPage']>,
  cellIndex: number,
) => {
  const embeddedPage = await targetPdf.embedPage(sourcePdf.getPage(sourcePageIndex))
  const cellWidth = (A4_PAGE.width - A4_4UP_MARGIN * 2 - A4_4UP_GUTTER) / 2
  const cellHeight = (A4_PAGE.height - A4_4UP_MARGIN * 2 - A4_4UP_GUTTER) / 2
  const column = cellIndex % 2
  const row = Math.floor(cellIndex / 2)
  const scale = Math.min(cellWidth / embeddedPage.width, cellHeight / embeddedPage.height)
  const drawWidth = embeddedPage.width * scale
  const drawHeight = embeddedPage.height * scale
  const x = A4_4UP_MARGIN + column * (cellWidth + A4_4UP_GUTTER) + (cellWidth - drawWidth) / 2
  const y =
    A4_PAGE.height -
    A4_4UP_MARGIN -
    (row + 1) * cellHeight -
    row * A4_4UP_GUTTER +
    (cellHeight - drawHeight) / 2

  targetPage.drawPage(embeddedPage, {
    x,
    y,
    width: drawWidth,
    height: drawHeight,
  })
}

export const downloadMergedPdf = async (
  entries: ResolvedDocumentEntry[],
  fileName: string,
  options?: { layout?: MergedPdfLayout },
) => {
  const layout = options?.layout ?? 'single'

  try {
    const mergeResponse = await mergePdfDocumentsThroughProxy(
      entries.map((entry) => ({ url: entry.url, fileName: entry.fileName })),
      {
        fileName,
        layout,
      },
    )
    saveAs(mergeResponse.blob, fileName)
    return {
      downloadedCount: mergeResponse.downloadedCount,
      skippedCount: mergeResponse.skippedCount,
    }
  } catch (error) {
    console.warn('Falling back to local PDF merge for bulk download:', error)
  }

  const mergedPdf = await PDFDocument.create()
  let downloadedCount = 0
  let skippedCount = 0
  let currentA4Page: ReturnType<PDFDocument['addPage']> | null = null
  let currentA4Cell = 0

  for (const entry of entries) {
    try {
      const blob = await downloadDocumentThroughProxy(entry.url, {
        downloadName: entry.fileName,
        disposition: 'inline',
        contentType: 'application/pdf',
      })
      const pdfBytes = await blob.arrayBuffer()
      const sourcePdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })

      if (layout === 'a4_4up') {
        for (const sourcePageIndex of sourcePdf.getPageIndices()) {
          if (!currentA4Page || currentA4Cell === 4) {
            currentA4Page = mergedPdf.addPage([A4_PAGE.width, A4_PAGE.height])
            currentA4Cell = 0
          }

          await drawPageOnA4Cell(mergedPdf, sourcePdf, sourcePageIndex, currentA4Page, currentA4Cell)
          currentA4Cell += 1
        }
      } else {
        const pages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices())
        pages.forEach((page) => mergedPdf.addPage(page))
      }

      downloadedCount += 1
    } catch (error) {
      console.warn(`Skipping PDF while preparing ${fileName}:`, entry.fileName, error)
      skippedCount += 1
    }
  }

  if (!downloadedCount) {
    return { downloadedCount, skippedCount }
  }

  const mergedBytes = await mergedPdf.save()
  saveAs(new Blob([mergedBytes], { type: 'application/pdf' }), fileName)

  return { downloadedCount, skippedCount }
}

export const openFileInNewTab = async (url: string, fileName: string) => {
  const tab = window.open('', '_blank', 'noopener,noreferrer')
  try {
    const blob = await downloadDocumentThroughProxy(url, {
      downloadName: fileName,
      disposition: 'inline',
    })

    const objectUrl = URL.createObjectURL(blob)

    if (tab) {
      tab.location.href = objectUrl
    } else {
      const link = document.createElement('a')
      link.href = objectUrl
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }

    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
  } catch (error) {
    if (tab) {
      tab.close()
    }
    throw error
  }
}

export const getDocumentReference = (order: BulkOrderDocumentShape, type: DocumentType) => {
  if (type === 'label') {
    return {
      key: pickStoredKey(order.label_key, order.label),
      url: pickStoredUrl(order.label_url, order.label_key, order.label),
    }
  }

  if (type === 'manifest') {
    return {
      key: pickStoredKey(order.manifest_key, order.manifest),
      url: pickStoredUrl(order.manifest_url, order.manifest_key, order.manifest),
    }
  }

  return {
    key: pickStoredKey(order.invoice_key, order.invoice_link),
    url: pickStoredUrl(order.invoice_url, order.invoice_key, order.invoice_link),
  }
}

export const generateMissingLabels = async <T extends BulkOrderDocumentShape>(
  orders: T[],
  generateLabel: (order: T) => Promise<string | null | undefined>,
  concurrency = 4,
) => {
  const preparedOrders = [...orders]
  const missingLabels = orders
    .map((order, index) => ({ order, index }))
    .filter(({ order }) => {
      const { key, url } = getDocumentReference(order, 'label')
      return !key && !url
    })
  const failures: Array<LabelGenerationFailure<T>> = []
  let generatedCount = 0
  let cursor = 0

  const worker = async () => {
    while (cursor < missingLabels.length) {
      const current = missingLabels[cursor]
      cursor += 1
      if (!current) continue

      try {
        const label = String((await generateLabel(current.order)) || '').trim()
        if (!label) throw new Error('The label service did not return a label file.')

        preparedOrders[current.index] = {
          ...current.order,
          label,
          label_key: label,
        }
        generatedCount += 1
      } catch (error) {
        failures.push({ order: current.order, error })
      }
    }
  }

  const workerCount = Math.min(Math.max(1, concurrency), missingLabels.length)
  await Promise.all(Array.from({ length: workerCount }, () => worker()))

  return { preparedOrders, generatedCount, failures }
}

export const getDownloadFileName = (
  order: BulkOrderDocumentShape,
  type: DocumentType,
  source?: string | null,
) => {
  const baseName =
    sanitizeFileNameSegment(
      String(order.order_number || order.awb_number || `${order.type || 'order'}-${order.id}`),
    ) || `order-${order.id}`

  return `${baseName}-${type}${getFileExtension(source)}`
}

export const getActionableErrorMessage = (error: unknown, fallback: string) => {
  const apiError = error as ApiLikeError
  const rawMessage = typeof apiError?.message === 'string' ? apiError.message.trim() : ''
  const responseMessage = apiError?.response?.data?.message
  const responseError = apiError?.response?.data?.error

  if (typeof responseMessage === 'string' && responseMessage.trim()) {
    return responseMessage.trim()
  }

  if (typeof responseError === 'string' && responseError.trim()) {
    return responseError.trim()
  }

  if (apiError?.code === 'ECONNABORTED' || /timeout/i.test(rawMessage)) {
    return 'The request is taking longer than expected. Please try again shortly.'
  }

  if (!apiError?.response && (/network error/i.test(rawMessage) || /failed to fetch/i.test(rawMessage))) {
    return 'Could not reach the server. Please check your connection and try again.'
  }

  return (
    rawMessage ||
    fallback
  )
}

export const summarizeOrderNumbers = (
  values: Array<string | number>,
  maxVisible = 5,
) => {
  const normalized = values.map((value) => String(value)).filter(Boolean)
  if (normalized.length <= maxVisible) return normalized.join(', ')

  const visible = normalized.slice(0, maxVisible).join(', ')
  return `${visible} +${normalized.length - maxVisible} more`
}

export const summarizeMessages = (
  values: Array<string | number>,
  maxVisible = 2,
) => {
  const normalized = values.map((value) => String(value).trim()).filter(Boolean)
  if (normalized.length === 0) return ''
  if (normalized.length <= maxVisible) return normalized.join(' ')

  return `${normalized.slice(0, maxVisible).join(' ')} +${normalized.length - maxVisible} more issue(s).`
}
