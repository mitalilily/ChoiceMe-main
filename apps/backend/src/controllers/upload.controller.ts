import axios from 'axios'
import path from 'path'
import { Request, Response } from 'express'
import { PDFDocument } from 'pdf-lib'
import {
  presignDownload,
  presignUpload,
  uploadBufferToR2,
} from '../models/services/upload.service'

const sanitizeFileName = (value: string) =>
  value
    .replace(/\\/g, '/')
    .split('/')
    .pop()
    ?.replace(/[\r\n"]/g, '')
    .trim()

const inferFileName = (source: string, fallback = 'document.pdf') => {
  try {
    const pathname = new URL(source).pathname
    const fileName = sanitizeFileName(path.basename(pathname))
    return fileName || fallback
  } catch {
    const fileName = sanitizeFileName(path.basename(source))
    return fileName || fallback
  }
}

const inferContentType = (fileName: string) => {
  const ext = path.extname(fileName).toLowerCase()

  switch (ext) {
    case '.pdf':
      return 'application/pdf'
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.webp':
      return 'image/webp'
    case '.csv':
      return 'text/csv; charset=utf-8'
    default:
      return 'application/octet-stream'
  }
}

type BulkMergeEntry = {
  url?: string
  fileName?: string
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

export const createPresignedUrl = async (
  req: any,
  res: Response
): Promise<any> => {
  const { filename, contentType, folder } = req.body;
  const { sub } = req?.user;

  if (!filename || !contentType) {
    return res.status(400).json({ message: "filename & contentType required" });
  }

  try {
    const data = await presignUpload({
      filename,
      contentType,
      userId: sub,
      folderKey: folder,
    });
    return res.status(200).json(data);
  } catch (err) {
    console.error("Presign error:", err);
    return res.status(500).json({ message: "Failed to presign URL" });
  }
};

export const uploadFile = async (req: any, res: Response): Promise<any> => {
  const file = req.file;
  const { sub } = req?.user ?? {};
  const folder = req.body?.folder || req.body?.folderKey;

  if (!file || !sub) {
    return res.status(400).json({ message: "Authenticated file upload requires a file." });
  }

  try {
    const data = await uploadBufferToR2({
      buffer: file.buffer,
      filename: file.originalname,
      contentType: file.mimetype || "application/octet-stream",
      userId: sub,
      folderKey: folder,
    });

    return res.status(200).json(data);
  } catch (err) {
    console.error("Upload proxy error:", err);
    return res.status(500).json({ message: "Failed to upload file" });
  }
};

export const getPresignedDownloadUrl = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { keys } = req.body;

    // Validate payload
    if (!keys || (typeof keys !== "string" && !Array.isArray(keys))) {
      return res
        .status(400)
        .json({ message: "'keys' must be a string or string[]" });
    }

    // Generate signed URL(s)
    const result = await presignDownload(keys);

    // Handle missing files (NoSuchKey)
    if (Array.isArray(keys)) {
      // For arrays, filter out null values and return with status info
      const urls = Array.isArray(result) ? result : [];
      const missingFiles = urls.map((url, index) => url === null ? keys[index] : null).filter(Boolean);
      
      if (missingFiles.length > 0) {
        console.warn(`⚠️ Some files not found in storage:`, missingFiles);
      }
      
      // Return urls array (may contain null values for missing files)
      return res.status(200).json({ urls });
    } else {
      // For single key, return 404 if file doesn't exist
      if (!result || result === null) {
        return res.status(404).json({ 
          message: "File not found in storage",
          key: keys 
        });
      }
      return res.status(200).json({ url: result as string });
    }
  } catch (error) {
    console.error("Presign download failed:", error);
    return res
      .status(500)
      .json({ message: "Failed to generate download URL(s)" });
  }
};

export const proxyDocumentDownload = async (req: Request, res: Response): Promise<any> => {
  const source = typeof req.body?.source === 'string' ? req.body.source.trim() : ''
  const requestedDisposition = req.body?.disposition === 'inline' ? 'inline' : 'attachment'
  const requestedDownloadName =
    typeof req.body?.downloadName === 'string' ? req.body.downloadName.trim() : ''
  const requestedContentType =
    typeof req.body?.contentType === 'string' ? req.body.contentType.trim() : ''

  if (!source) {
    return res.status(400).json({ message: 'source is required' })
  }

  try {
    const resolvedSource = await presignDownload(source)
    const sourceUrl = Array.isArray(resolvedSource) ? resolvedSource[0] : resolvedSource

    if (!sourceUrl || typeof sourceUrl !== 'string') {
      return res.status(404).json({ message: 'File not found' })
    }

    const fileName = requestedDownloadName || inferFileName(sourceUrl, inferFileName(source))
    const upstream = await axios.get(sourceUrl, {
      responseType: 'arraybuffer',
      timeout: 60000,
      validateStatus: (status) => status >= 200 && status < 300,
    })

    const upstreamContentType =
      typeof upstream.headers?.['content-type'] === 'string' ? upstream.headers['content-type'] : ''
    const contentType = upstreamContentType || requestedContentType || inferContentType(fileName)

    res.setHeader('Content-Type', contentType)
    res.setHeader(
      'Content-Disposition',
      `${requestedDisposition}; filename="${fileName.replace(/"/g, '\\"')}"`,
    )
    res.setHeader('Cache-Control', 'private, no-store, max-age=0, must-revalidate')

    return res.status(200).send(Buffer.from(upstream.data))
  } catch (err: any) {
    console.error('Document proxy download failed:', {
      source,
      message: err?.message || err,
      status: err?.response?.status || null,
    })
    return res.status(500).json({ message: 'Failed to download document' })
  }
}

export const mergePdfDocuments = async (req: Request, res: Response): Promise<any> => {
  const entries = Array.isArray(req.body?.entries) ? (req.body.entries as BulkMergeEntry[]) : []
  const requestedDisposition = req.body?.disposition === 'inline' ? 'inline' : 'attachment'
  const requestedFileName =
    typeof req.body?.fileName === 'string' ? req.body.fileName.trim() : 'documents.pdf'
  const layout = req.body?.layout === 'a4_4up' ? 'a4_4up' : 'single'

  if (!entries.length) {
    return res.status(400).json({ message: 'entries are required' })
  }

  try {
    const mergedPdf = await PDFDocument.create()
    let currentA4Page: ReturnType<PDFDocument['addPage']> | null = null
    let currentA4Cell = 0
    let downloadedCount = 0
    let skippedCount = 0

    for (const entry of entries) {
      const source = typeof entry?.url === 'string' ? entry.url.trim() : ''
      if (!source) {
        skippedCount += 1
        continue
      }

      try {
        const upstream = await axios.get(source, {
          responseType: 'arraybuffer',
          timeout: 60000,
          validateStatus: (status) => status >= 200 && status < 300,
        })

        const pdfBytes = Buffer.from(upstream.data)
        const sourcePdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })

        if (layout === 'a4_4up') {
          for (const sourcePageIndex of sourcePdf.getPageIndices()) {
            if (!currentA4Page || currentA4Cell === 4) {
              currentA4Page = mergedPdf.addPage([A4_PAGE.width, A4_PAGE.height])
              currentA4Cell = 0
            }

            await drawPageOnA4Cell(
              mergedPdf,
              sourcePdf,
              sourcePageIndex,
              currentA4Page,
              currentA4Cell,
            )
            currentA4Cell += 1
          }
        } else {
          const pages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices())
          pages.forEach((page) => mergedPdf.addPage(page))
        }

        downloadedCount += 1
      } catch (error) {
        skippedCount += 1
      }
    }

    const mergedBytes = await mergedPdf.save()
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader(
      'Content-Disposition',
      `${requestedDisposition}; filename="${requestedFileName.replace(/"/g, '\\"')}"`,
    )
    res.setHeader('Cache-Control', 'private, no-store, max-age=0, must-revalidate')
    res.setHeader('X-Downloaded-Count', String(downloadedCount))
    res.setHeader('X-Skipped-Count', String(skippedCount))
    return res.status(200).send(Buffer.from(mergedBytes))
  } catch (err: any) {
    console.error('Bulk PDF merge failed:', {
      message: err?.message || err,
    })
    return res.status(500).json({ message: 'Failed to merge documents' })
  }
}
