// utils/emailSender.ts
import dotenv from 'dotenv'
import fs from 'fs'
import nodemailer from 'nodemailer'
import path from 'path'
import sgMail from '@sendgrid/mail'

// Load correct .env based on NODE_ENV
const resolveRuntimeEnv = () =>
  process.env.NODE_ENV ||
  (process.env.RAILWAY_ENVIRONMENT || process.env.RENDER || process.env.K_SERVICE
    ? 'production'
    : 'development')

const env = resolveRuntimeEnv()
const backendRoot = path.resolve(__dirname, '../..')
dotenv.config({ path: path.resolve(backendRoot, `.env.${env}`) })
dotenv.config({ path: path.resolve(backendRoot, '.env') })

const AUTH_CODE_LOGGING_ENABLED =
  process.env.EXPOSE_AUTH_CODES === 'true' || process.env.ALLOW_INLINE_OTP === 'true'

type EmailConfig = {
  senderFrom: string
  smtpUser: string
  smtpPassword: string
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
  sendGridApiKey: string
  sendGridFrom: string
  isGmail: boolean
  connectionTimeout: number
  greetingTimeout: number
  socketTimeout: number
}

type TransportCandidate = {
  name: string
  host: string
  port: number
  secure: boolean
  options: any
}

const trimEnv = (value?: string) => (value ?? '').trim()

const parseBooleanEnv = (value: string | undefined, fallback = false) => {
  const normalized = trimEnv(value).toLowerCase()
  if (!normalized) return fallback

  return ['true', '1', 'yes', 'on'].includes(normalized)
}

const parsePositiveIntEnv = (value: string | undefined, fallback: number) => {
  const parsed = Number(trimEnv(value))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const readEmailConfig = (): EmailConfig => {
  const configuredSendGridFrom = trimEnv(process.env.SENDGRID_FROM_EMAIL)
  const configuredFrom = trimEnv(process.env.EMAIL_FROM)
  const configuredUser = trimEnv(process.env.GOOGLE_SMTP_USER)
  const senderFrom = configuredSendGridFrom || configuredFrom || configuredUser
  const smtpUser = configuredUser || senderFrom
  const smtpPassword = trimEnv(process.env.GOOGLE_SMTP_PASSWORD)
  const smtpHost = trimEnv(process.env.SMTP_HOST)
  const smtpPort = parsePositiveIntEnv(process.env.SMTP_PORT, 587)
  const smtpSecure = parseBooleanEnv(process.env.SMTP_SECURE, smtpPort === 465)
  const sendGridApiKey =
    trimEnv(process.env.SENDGRID_API_KEY) ||
    trimEnv(process.env.TWILIO_SENDGRID_API_KEY) ||
    trimEnv(process.env.TWILLIO_SENDGRID_API_KEY)
  const sendGridFrom = configuredSendGridFrom || senderFrom
  const isGmail =
    /(^|\.)gmail\.com$/i.test(smtpHost) || /@gmail\.com$/i.test(smtpUser)

  return {
    senderFrom,
    smtpUser,
    smtpPassword,
    smtpHost,
    smtpPort,
    smtpSecure,
    sendGridApiKey,
    sendGridFrom,
    isGmail,
    connectionTimeout: parsePositiveIntEnv(process.env.SMTP_CONNECTION_TIMEOUT_MS, 10000),
    greetingTimeout: parsePositiveIntEnv(process.env.SMTP_GREETING_TIMEOUT_MS, 10000),
    socketTimeout: parsePositiveIntEnv(process.env.SMTP_SOCKET_TIMEOUT_MS, 30000),
  }
}

const maskEmailForLog = (email: string) => {
  const [localPart = '', domain = ''] = email.split('@')
  if (!localPart || !domain) return '[invalid-email]'

  const visibleLocal =
    localPart.length <= 2 ? `${localPart[0] ?? '*'}*` : `${localPart.slice(0, 2)}***`

  return `${visibleLocal}@${domain}`
}

const createPlainTextFallback = (htmlContent: string) =>
  htmlContent
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()

const escapeHtml = (unsafe: string) =>
  unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

const getFrontendBaseUrl = () => process.env.FRONTEND_URL?.trim() || 'http://localhost:5173'

type AttachmentInput = {
  /** local file path OR Buffer */
  path?: string
  buffer?: Buffer
  filename: string
  mimeType?: string
  cid?: string
}

export const isEmailDeliveryConfigured = () => {
  const config = readEmailConfig()
  return Boolean(
    config.senderFrom &&
      (config.sendGridApiKey || (config.smtpUser && config.smtpPassword)),
  )
}

export const getTransactionalFromAddress = () => readEmailConfig().senderFrom

export const logAuthCode = ({
  purpose,
  to,
  code,
}: {
  purpose: string
  to: string
  code: string
}) => {
  if (!AUTH_CODE_LOGGING_ENABLED) {
    console.warn('[Auth Code] Code logging suppressed because inline auth codes are disabled.', {
      purpose,
      to: maskEmailForLog(to),
    })
    return
  }

  console.log('[Auth Code Debug]', {
    purpose,
    to: maskEmailForLog(to),
    code,
  })
}

const assertEmailConfig = (config: EmailConfig) => {
  if (!config.senderFrom || !config.smtpUser) {
    throw new Error(
      'Email service is not configured. Missing EMAIL_FROM, SENDGRID_FROM_EMAIL, or GOOGLE_SMTP_USER.',
    )
  }

  if (!config.smtpPassword) {
    throw new Error('Email service is not configured. Missing GOOGLE_SMTP_PASSWORD.')
  }
}

const makeTransportCandidate = (
  config: EmailConfig,
  name: string,
  host: string,
  port: number,
  secure: boolean,
): TransportCandidate => ({
  name,
  host,
  port,
  secure,
  options: {
    host,
    port,
    secure,
    requireTLS: !secure,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPassword,
    },
    connectionTimeout: config.connectionTimeout,
    greetingTimeout: config.greetingTimeout,
    socketTimeout: config.socketTimeout,
    tls: {
      servername: host,
      minVersion: 'TLSv1.2',
    },
  },
})

const addTransportCandidate = (
  candidates: TransportCandidate[],
  candidate: TransportCandidate,
) => {
  const alreadyAdded = candidates.some(
    (item) => item.host === candidate.host && item.port === candidate.port && item.secure === candidate.secure,
  )

  if (!alreadyAdded) candidates.push(candidate)
}

const buildTransportCandidates = (config: EmailConfig) => {
  assertEmailConfig(config)

  const candidates: TransportCandidate[] = []
  const configuredHost = config.smtpHost || 'smtp.gmail.com'

  if (config.isGmail) {
    addTransportCandidate(
      candidates,
      makeTransportCandidate(config, 'gmail-smtps', 'smtp.gmail.com', 465, true),
    )

    if (parseBooleanEnv(process.env.SMTP_ENABLE_GMAIL_STARTTLS_FALLBACK, false)) {
      addTransportCandidate(
        candidates,
        makeTransportCandidate(
          config,
          config.smtpHost ? 'configured-smtp' : 'gmail-starttls-fallback',
          configuredHost,
          config.smtpPort,
          config.smtpSecure,
        ),
      )
      addTransportCandidate(
        candidates,
        makeTransportCandidate(config, 'gmail-starttls-fallback', 'smtp.gmail.com', 587, false),
      )
    }

    return candidates
  }

  addTransportCandidate(
    candidates,
    makeTransportCandidate(
      config,
      config.smtpHost ? 'configured-smtp' : 'gmail-smtps',
      configuredHost,
      config.smtpPort,
      config.smtpSecure,
    ),
  )

  return candidates
}

const isRetryableSmtpConnectionError = (error: unknown) => {
  const smtpError = error as { code?: string; command?: string }
  const retryableCodes = new Set([
    'ETIMEDOUT',
    'ECONNECTION',
    'ESOCKET',
    'ECONNRESET',
    'ECONNREFUSED',
    'EHOSTUNREACH',
    'ENETUNREACH',
  ])

  return retryableCodes.has(smtpError.code || '') || smtpError.command === 'CONN'
}

export const verifyEmailTransport = async () => {
  const config = readEmailConfig()
  const candidates = buildTransportCandidates(config)
  let lastError: unknown

  for (const [index, candidate] of candidates.entries()) {
    const transporter = nodemailer.createTransport(candidate.options)

    try {
      console.log('[Email] Verifying transporter', {
        transport: candidate.name,
        host: candidate.host,
        port: candidate.port,
        secure: candidate.secure,
        from: config.senderFrom,
      })
      await transporter.verify()
      console.log('[Email] Transporter verified', {
        transport: candidate.name,
        host: candidate.host,
        port: candidate.port,
        secure: candidate.secure,
      })
      return {
        transport: candidate.name,
        host: candidate.host,
        port: candidate.port,
        secure: candidate.secure,
      }
    } catch (error) {
      lastError = error
      console.error('[Email] Transporter verification failed', {
        transport: candidate.name,
        host: candidate.host,
        port: candidate.port,
        secure: candidate.secure,
        error,
      })

      if (index < candidates.length - 1 && isRetryableSmtpConnectionError(error)) {
        console.warn('[Email] Trying fallback SMTP transporter after connection failure', {
          failedTransport: candidate.name,
          nextTransport: candidates[index + 1].name,
        })
        continue
      }

      throw error
    } finally {
      transporter.close()
    }
  }

  throw lastError
}

/**
 * Low-level sendEmail supporting optional attachments
 */
const sendEmail = async (
  to: string,
  subject: string,
  htmlContent: string,
  attachments?: AttachmentInput[],
  textContent?: string,
  messageId?: string,
) => {
  const config = readEmailConfig()
  const maskedRecipient = maskEmailForLog(to)
  const text = textContent || createPlainTextFallback(htmlContent)
  const resolvedAttachments = attachments?.length
    ? await Promise.all(
        attachments.map(async (a) => {
          let buffer: Buffer
          if (a.buffer) buffer = a.buffer
          else if (a.path) buffer = fs.readFileSync(a.path)
          else throw new Error('Attachment must have path or buffer')

          return {
            filename: a.filename,
            content: buffer,
            contentType: a.mimeType,
            cid: a.cid,
            contentDisposition: a.cid ? 'inline' : undefined,
          }
        }),
      )
    : undefined

  if (config.sendGridApiKey) {
    try {
      sgMail.setApiKey(config.sendGridApiKey)
      console.log('[Email] Sending email', {
        transport: 'sendgrid',
        to: maskedRecipient,
        subject,
        attachments: resolvedAttachments?.length ?? 0,
      })

      const [response] = await sgMail.send({
        to,
        from: {
          email: config.sendGridFrom,
          name: 'ChoiceMee Logistics',
        },
        replyTo: config.sendGridFrom,
        subject,
        text,
        html: htmlContent,
        headers: {
          'X-ChoiceMee-Message-Type': 'transactional',
          'X-ChoiceMee-Mailer': 'choiceme-backend',
          ...(messageId ? { 'X-ChoiceMee-Delivery-Id': messageId } : {}),
        },
        attachments: resolvedAttachments?.map((attachment) => ({
          filename: attachment.filename,
          content: attachment.content.toString('base64'),
          type: attachment.contentType,
          disposition: attachment.cid ? 'inline' : 'attachment',
          contentId: attachment.cid,
        })),
      } as any)

      console.log('[Email] Email accepted by SendGrid', {
        transport: 'sendgrid',
        to: maskedRecipient,
        statusCode: response.statusCode,
        messageId: response.headers?.['x-message-id'],
      })
      return response
    } catch (error) {
      console.error('[Email] SendGrid delivery failed', {
        transport: 'sendgrid',
        to: maskedRecipient,
        subject,
        error,
      })

      if (!config.smtpUser || !config.smtpPassword) {
        throw new Error('Email delivery failed through SendGrid')
      }

      console.warn('[Email] Falling back to SMTP after SendGrid failure', {
        to: maskedRecipient,
        subject,
      })
    }
  }

  const mailOptions: any = {
    from: `"ChoiceMee Logistics" <${config.senderFrom}>`,
    sender: config.senderFrom,
    replyTo: config.senderFrom,
    to,
    subject,
    text,
    html: htmlContent,
    headers: {
      'X-ChoiceMee-Message-Type': 'transactional',
      'X-ChoiceMee-Mailer': 'choiceme-backend',
      ...(messageId ? { 'X-ChoiceMee-Delivery-Id': messageId } : {}),
    },
    ...(messageId ? { messageId } : {}),
  }

  if (resolvedAttachments?.length) {
    mailOptions.attachments = resolvedAttachments
  }

  const candidates = buildTransportCandidates(config)
  let lastError: unknown

  for (const [index, candidate] of candidates.entries()) {
    const transporter = nodemailer.createTransport(candidate.options)

    try {
      console.log('[Email] Sending email', {
        transport: candidate.name,
        host: candidate.host,
        port: candidate.port,
        secure: candidate.secure,
        to: maskedRecipient,
        subject,
        attachments: attachments?.length ?? 0,
      })
      const info = await transporter.sendMail(mailOptions)
      console.log('[Email] Email sent successfully', {
        transport: candidate.name,
        to: maskedRecipient,
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected,
        response: info.response,
      })
      return info
    } catch (error) {
      lastError = error
      console.error('[Email] Error sending email', {
        transport: candidate.name,
        host: candidate.host,
        port: candidate.port,
        secure: candidate.secure,
        to: maskedRecipient,
        subject,
        error,
      })

      if (index < candidates.length - 1 && isRetryableSmtpConnectionError(error)) {
        console.warn('[Email] Retrying email with fallback SMTP transporter', {
          failedTransport: candidate.name,
          nextTransport: candidates[index + 1].name,
        })
        continue
      }

      throw error
    } finally {
      transporter.close()
    }
  }

  throw lastError
}

export type ShipmentStatusEmailStage =
  | 'booked'
  | 'manifested'
  | 'picked_up'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'ndr'
  | 'failed'

export type ShipmentOrderLike = {
  orderNumber?: string | null
  order_number?: string | null
  orderDate?: string | Date | null
  order_date?: string | Date | null
  created_at?: string | Date | null
  updated_at?: string | Date | null
  orderName?: string | null
  order_name?: string | null
  name?: string | null
  title?: string | null
  buyer_name?: string | null
  buyer_phone?: string | null
  address?: string | null
  addressLine1?: string | null
  delivery_address?: string | null
  buyer_address?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  pincode?: string | null
  courier_partner?: string | null
  courier_name?: string | null
  service_type?: string | null
  partner_name?: string | null
  logistics_partner?: string | null
  partner_display_name?: string | null
  order_status?: string | null
  order_amount?: number | string | null
  shipping_charges?: number | string | null
  prepaid_amount?: number | string | null
  cod_charges?: number | string | null
  delivery_message?: string | null
  email?: string | null
  buyer_email?: string | null
  buyerEmail?: string | null
  consignee_email?: string | null
  consigneeEmail?: string | null
  customer_email?: string | null
  customerEmail?: string | null
  products?: unknown
  order_items?: unknown
  packages?: unknown
  shipping_mode?: string | null
  companyLogoUrl?: string | null
  profilePicture?: string | null
}

const firstString = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    const trimmed = String(value || '').trim()
    if (trimmed) return trimmed
  }

  return ''
}

const extractItemLabel = (value: unknown) => {
  const items = Array.isArray(value) ? value : []
  for (const item of items) {
    if (!item || typeof item !== 'object') continue
    const candidate = firstString(
      (item as Record<string, unknown>).order_name as string | null | undefined,
      (item as Record<string, unknown>).orderName as string | null | undefined,
      (item as Record<string, unknown>).name as string | null | undefined,
      (item as Record<string, unknown>).productName as string | null | undefined,
      (item as Record<string, unknown>).box_name as string | null | undefined,
      (item as Record<string, unknown>).boxName as string | null | undefined,
      (item as Record<string, unknown>).title as string | null | undefined,
      (item as Record<string, unknown>).label as string | null | undefined,
      (item as Record<string, unknown>).itemName as string | null | undefined,
    )

    if (candidate) return candidate
  }

  return ''
}

export const resolveShipmentOrderLabel = (order?: ShipmentOrderLike | null) => {
  if (!order) return ''

  return firstString(
    order.orderName,
    order.order_name,
    order.name,
    order.title,
    extractItemLabel(order.products),
    extractItemLabel(order.order_items),
    extractItemLabel(order.packages),
    order.orderNumber,
    order.order_number,
  )
}

const normalizeShipmentStatusText = (value?: string | null) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')

const formatDisplayDateTime = (value?: string | Date | null) => {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).trim()

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

const formatDisplayDate = (value?: string | Date | null) => {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).trim()

  const day = new Intl.DateTimeFormat('en-GB', { day: '2-digit' }).format(date)
  const month = new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(date)
  const year = new Intl.DateTimeFormat('en-GB', { year: 'numeric' }).format(date)

  return `${day}-${month}-${year}`
}

const formatCurrency = (value?: unknown) => {
  if (value === undefined || value === null || value === '') return ''
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return String(value).trim()

  return `Rs. ${numeric.toLocaleString('en-IN', {
    minimumFractionDigits: Number.isInteger(numeric) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`
}

const formatEmailCurrency = (value?: unknown) => {
  if (value === undefined || value === null || value === '') return ''
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return String(value).trim()

  return `₹ ${numeric.toFixed(2)}`
}

const firstText = (...values: Array<unknown>) => {
  for (const value of values) {
    const text = String(value ?? '').trim()
    if (text) return text
  }

  return ''
}

const getShipmentStatusPresentation = (stage: ShipmentStatusEmailStage) => {
  switch (stage) {
    case 'booked':
      return {
        badge: 'Manifest',
        badgeBg: '#F97316',
        badgeFg: '#FFFFFF',
        actionText: 'Manifest successfully',
        progressIndex: 0,
      }
    case 'manifested':
      return {
        badge: 'Manifest',
        badgeBg: '#F97316',
        badgeFg: '#FFFFFF',
        actionText: 'Manifest successfully',
        progressIndex: 0,
      }
    case 'picked_up':
      return {
        badge: 'Pickup Successfully',
        badgeBg: '#F97316',
        badgeFg: '#FFFFFF',
        actionText: 'Pickup Successfully',
        progressIndex: 1,
      }
    case 'in_transit':
      return {
        badge: 'In Transit',
        badgeBg: '#F97316',
        badgeFg: '#FFFFFF',
        actionText: 'In Transit',
        progressIndex: 2,
      }
    case 'out_for_delivery':
      return {
        badge: 'Out for delivery',
        badgeBg: '#F97316',
        badgeFg: '#FFFFFF',
        actionText: 'Out for delivery successfully',
        progressIndex: 2,
      }
    case 'delivered':
      return {
        badge: 'Delivered successfully',
        badgeBg: '#F97316',
        badgeFg: '#FFFFFF',
        actionText: 'Delivered successfully',
        progressIndex: 3,
      }
    case 'ndr':
      return {
        badge: 'Delivery Failed (NDR)',
        badgeBg: '#F97316',
        badgeFg: '#FFFFFF',
        actionText: 'Delivery Failed (NDR)',
        progressIndex: 3,
      }
    case 'failed':
    default:
      return {
        badge: 'Delivery Failed (NDR)',
        badgeBg: '#F97316',
        badgeFg: '#FFFFFF',
        actionText: 'Delivery Failed (NDR)',
        progressIndex: 3,
      }
  }
}

const getChoiceMeeEmailLogoCid = () => 'choiceme-shipment-logo'

const getChoiceMeeEmailLogoPathCandidates = () => {
  const configuredPath = trimEnv(process.env.SHIPMENT_EMAIL_LOGO_PATH)

  return [
    configuredPath,
    path.resolve(backendRoot, '../client/public/brand/shipment-email-logo.png'),
    path.resolve(backendRoot, 'client/public/brand/shipment-email-logo.png'),
    path.resolve(process.cwd(), 'apps/client/public/brand/shipment-email-logo.png'),
    path.resolve(process.cwd(), 'client/public/brand/shipment-email-logo.png'),
  ].filter(Boolean)
}

const resolveChoiceMeeEmailLogoAttachment = (): AttachmentInput | undefined => {
  for (const candidate of getChoiceMeeEmailLogoPathCandidates()) {
    if (!candidate) continue

    if (fs.existsSync(candidate)) {
      return {
        path: candidate,
        filename: 'shipment-email-logo.png',
        mimeType: 'image/png',
        cid: getChoiceMeeEmailLogoCid(),
      }
    }
  }

  console.warn('[Email] Shipment logo asset not found on disk; falling back to hosted logo URL', {
    candidates: getChoiceMeeEmailLogoPathCandidates(),
  })

  return undefined
}

const getChoiceMeeEmailLogoSrc = () => {
  const frontendBaseUrl = getFrontendBaseUrl().replace(/\/$/, '')
  const cacheVersion = process.env.SHIPMENT_EMAIL_LOGO_VERSION?.trim() || '20260622-hd2'
  const cacheSuffix = frontendBaseUrl.startsWith('file:')
    ? ''
    : `?v=${encodeURIComponent(cacheVersion)}`

  return `${frontendBaseUrl}/brand/shipment-email-logo.png${cacheSuffix}`
}

const buildChoiceMeeEmailLogo = (src: string) => `
  <img class="cm-logo" src="${escapeHtml(
    src,
  )}" width="250" alt="ChoiceMee Logistics" style="display:block;width:250px;max-width:250px;height:auto;margin:0;border:0;outline:none;text-decoration:none;background:transparent;-ms-interpolation-mode:bicubic;" />
`

const buildShipmentProgressMarkup = (accentColor = '#4EA3F1') => {
  const iconColor = '#FFFFFF'
  const stepFill = accentColor
  const connectorColor = accentColor

  const icon = (svg: string, transform: string) => `
    <g transform="${transform}" fill="none" stroke="${iconColor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      ${svg}
    </g>
  `

  return `
    <svg width="272" height="72" viewBox="0 0 272 72" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Shipment progress">
      <line x1="42" y1="36" x2="230" y2="36" stroke="${connectorColor}" stroke-width="4" stroke-linecap="round"/>
      <circle cx="42" cy="36" r="17" fill="${stepFill}"/>
      <circle cx="104" cy="36" r="17" fill="${stepFill}"/>
      <circle cx="166" cy="36" r="17" fill="${stepFill}"/>
      <circle cx="228" cy="36" r="17" fill="${stepFill}"/>
      ${icon(`
        <rect x="13" y="10" width="12" height="14" rx="1.5"/>
        <path d="M16 14h6"/>
        <path d="M16 18h6"/>
        <path d="M16 22h4"/>
      `, 'translate(29 22)')}
      ${icon(`
        <path d="M11 11l7-4 7 4-7 4-7-4z"/>
        <path d="M11 11v7l7 4 7-4v-7"/>
        <path d="M18 15v7"/>
      `, 'translate(91 21)')}
      ${icon(`
        <path d="M8 19h16"/>
        <path d="M10 19v-6l4-4h6l4 4v6"/>
        <path d="M14 19v-5h4v5"/>
        <path d="M7 15h3"/>
        <path d="M21 15h-3"/>
        <path d="M10 13h1"/>
        <path d="M18 13h1"/>
      `, 'translate(153 20)')}
      ${icon(`
        <path d="M8 14l10-7 10 7"/>
        <path d="M10 13v9h16v-9"/>
        <path d="M14 22v-6h4v6"/>
      `, 'translate(216 20)')}
    </svg>
  `
}

const buildShipmentFooterIcons = () => {
  const icons = [
    {
      title: 'Facebook',
      svg: `<path d="M11 3.5h2.4c.3 0 .6.3.6.6v2.2h-1.5c-.6 0-.9.3-.9.9v1.7H14l-.3 2.1h-1.5V18h-2.5v-7.1H8v-2.1h1.7V7c0-1.7 1-3.5 3.3-3.5Z"/>`,
    },
    {
      title: 'LinkedIn',
      svg: `<path d="M4.5 6.8h2.4V18H4.5V6.8Zm1.2-5.1A1.4 1.4 0 1 1 4.3 3.1a1.4 1.4 0 0 1 1.4-1.4ZM9.1 6.8h2.3v1.5h.1c.3-.7 1.2-1.8 2.7-1.8 2.9 0 3.4 1.9 3.4 4.4V18h-2.4v-5.4c0-1.3 0-3-1.8-3-1.8 0-2.1 1.4-2.1 2.9V18H9.1V6.8Z"/>`,
    },
    {
      title: 'Instagram',
      svg: `<path d="M8 3.4h8c2.5 0 4.6 2.1 4.6 4.6v8c0 2.5-2.1 4.6-4.6 4.6H8c-2.5 0-4.6-2.1-4.6-4.6V8c0-2.5 2.1-4.6 4.6-4.6Zm0 1.8A2.8 2.8 0 0 0 5.2 8v8A2.8 2.8 0 0 0 8 18.8h8a2.8 2.8 0 0 0 2.8-2.8V8A2.8 2.8 0 0 0 16 5.2H8Zm4 2.1A4.7 4.7 0 1 1 7.3 12a4.7 4.7 0 0 1 4.7-4.7Zm0 1.8A2.9 2.9 0 1 0 14.9 12 2.9 2.9 0 0 0 12 9.1Zm5.1-3.2a1.1 1.1 0 1 1-1.1 1.1 1.1 1.1 0 0 1 1.1-1.1Z"/>`,
    },
    {
      title: 'Twitter',
      svg: `<path d="M18.5 7.1c.9-.6 1.4-1.3 1.7-2.3-.8.5-1.6.8-2.5 1 .1-.2.1-.5.1-.8 0-1.6-1.3-3-3-3-1.7 0-3 1.3-3 3 0 .2 0 .5.1.7-2.5-.1-4.8-1.3-6.3-3.3-.3.5-.5 1.1-.5 1.8 0 1.2.6 2.3 1.6 2.9-.6 0-1.1-.2-1.7-.4 0 1.8 1.2 3.3 2.9 3.7-.3.1-.6.1-1 .1-.2 0-.4 0-.6-.1.4 1.5 1.7 2.6 3.4 2.7A6.1 6.1 0 0 1 3 16.1 8.5 8.5 0 0 0 7.8 17.5c5.7 0 8.8-4.7 8.8-8.8v-.4c.6-.4 1.2-.9 1.7-1.5-.6.2-1.2.4-1.8.3Z"/>`,
    },
  ]

  return icons
    .map(
      (icon) => `
        <span title="${escapeHtml(icon.title)}" style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:999px;border:1px solid rgba(255,255,255,0.12);background:#4a4a4a;color:#c9c9c9;margin:0 3px;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="#c9c9c9" aria-hidden="true">${icon.svg}</svg>
        </span>
      `,
    )
    .join('')
}

const buildShipmentProductRows = (order?: ShipmentOrderLike | null) => {
  const rawItems = Array.isArray(order?.products)
    ? order?.products
    : Array.isArray(order?.order_items)
      ? order?.order_items
      : Array.isArray(order?.packages)
        ? order?.packages
        : []

  return rawItems
    .slice(0, 3)
    .map((item) => {
      if (!item || typeof item !== 'object') return null

      const row = item as Record<string, unknown>
      return {
        name: firstText(
          row.productName,
          row.order_name,
          row.orderName,
          row.name,
          row.title,
          row.label,
          row.itemName,
          row.boxName,
        ),
        qty: firstText(row.quantity, row.qty, row.count) || '1',
        amount: firstText(row.price, row.amount, row.total, row.rate, row.subtotal),
      }
    })
    .filter((row): row is { name: string; qty: string; amount: string } => Boolean(row?.name))
}

const buildShipmentAmountLines = (order?: ShipmentOrderLike | null) => {
  if (!order) return []

  return [
    { label: 'Order Total', value: formatCurrency((order as Record<string, unknown>).order_amount) },
    {
      label: 'COD Charges',
      value: formatCurrency((order as Record<string, unknown>).cod_charges),
    },
    {
      label: 'Prepaid Amount',
      value: formatCurrency((order as Record<string, unknown>).prepaid_amount),
    },
    {
      label: 'Shipping Charges',
      value: formatCurrency((order as Record<string, unknown>).shipping_charges),
    },
  ].filter((row) => Boolean(row.value))
}

const formatShipmentDetailRows = (rows: Array<{ label: string; value?: string | null }>) => {
  const visibleRows = rows
    .map((row) => ({
      label: row.label,
      value: String(row.value || '').trim(),
    }))
    .filter((row) => row.value)

  if (!visibleRows.length) {
    return { html: '', text: '' }
  }

  return {
    html: `
      <div style="margin:18px 0 0;padding:16px;border:1px solid #e5e7eb;border-radius:10px;background:#f9fafb;">
        ${visibleRows
          .map(
            (row) => `
              <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#111827;">
                <strong>${escapeHtml(row.label)}:</strong> ${escapeHtml(row.value)}
              </p>
            `,
          )
          .join('')}
      </div>
    `,
    text: visibleRows.map((row) => `${row.label}: ${row.value}`).join('\n'),
  }
}

export const buildShipmentStatusEmailContent = (opts: {
  to: string
  awbNumber: string
  orderNumber?: string | null
  orderLabel?: string | null
  stage: ShipmentStatusEmailStage
  sellerName?: string | null
  sellerLogoUrl?: string | null
  brandLogoSrc?: string | null
  orderDetails?: ShipmentOrderLike | null
}) => {
  const { awbNumber, orderNumber, orderLabel, stage, sellerName, orderDetails } = opts
  const orderRecord = (orderDetails || {}) as Record<string, any>
  const safeAwb = escapeHtml(String(awbNumber || '').trim())
  const normalizedOrderNumber = String(orderNumber || '').trim()
  const orderNumberDisplay = normalizedOrderNumber ? `#${normalizedOrderNumber.replace(/^#/, '')}` : safeAwb
  const safeOrderNumber = escapeHtml(normalizedOrderNumber)
  const safeOrderLabel = escapeHtml(String(orderLabel || '').trim())
  const sellerDisplayName = firstText(sellerName, 'ChoiceMee')
  const logoSrc = firstText(opts.brandLogoSrc, getChoiceMeeEmailLogoSrc())
  const stageMeta = getShipmentStatusPresentation(stage)
  const rawStatusLabel = normalizeShipmentStatusText(orderRecord.order_status as string | undefined)
  const orderPlacedOn = formatDisplayDateTime(orderRecord.created_at as string | Date | null | undefined)
  const orderPlacedOnFallback = formatDisplayDate(orderRecord.order_date as string | Date | null | undefined)
  const orderPlacedValue = firstText(orderPlacedOn, orderPlacedOnFallback)
  const courierName = firstText(
    orderRecord.courier_partner,
    orderRecord.courier_name,
    orderRecord.integration_type,
    'Courier',
  )
  const introPartnerName = firstText(
    orderRecord.service_type,
    orderRecord.partner_name,
    orderRecord.logistics_partner,
    orderRecord.partner_display_name,
    courierName,
  )
  const footerTeamName = 'ChoiceMee Logistics'
  const visibleStatus = firstText(rawStatusLabel, stageMeta.badge)
  const trackingLink = `${getFrontendBaseUrl().replace(/\/$/, '')}/tracking?awb=${encodeURIComponent(
    String(awbNumber || '').trim(),
  )}`
  const productRows = buildShipmentProductRows(orderDetails)
  const amountLines = buildShipmentAmountLines(orderDetails)
  const primaryProduct = productRows[0]
  const productName = firstText(primaryProduct?.name, safeOrderLabel, 'Product')
  const productQty = firstText(primaryProduct?.qty, '1')
  const productPrice = firstText(
    formatEmailCurrency(orderRecord.order_amount),
    formatEmailCurrency(primaryProduct?.amount),
  )
  const orderTotalValue = firstText(formatEmailCurrency(orderRecord.order_amount), productPrice)
  const amountPaidValue = firstText(formatEmailCurrency(orderRecord.prepaid_amount), orderTotalValue)
  const explicitCustomerName = firstText(
    orderRecord.buyer_name,
    orderRecord.consignee_name,
    orderRecord.customer_name,
    orderRecord.name,
  )
  const customerName = firstText(
    explicitCustomerName,
    safeOrderLabel,
    sellerDisplayName,
    'the customer',
  )
  const stateCountryLine = [orderRecord.state, orderRecord.country]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(', ')
  const customerAddressLines = [
    firstText(
      orderRecord.address,
      orderRecord.addressLine1,
      orderRecord.delivery_address,
      orderRecord.buyer_address,
    ),
    firstText(orderRecord.addressLine2, orderRecord.address_line_2),
    firstText(orderRecord.city),
    stateCountryLine && firstText(orderRecord.pincode) ? `${stateCountryLine},` : stateCountryLine,
    firstText(orderRecord.pincode),
  ].filter(Boolean)
  const contactNumber = firstText(
    orderRecord.buyer_phone,
    orderRecord.consignee_phone,
    orderRecord.customer_phone,
    orderRecord.phone,
  )
  if (!explicitCustomerName || customerAddressLines.length < 3 || !contactNumber) {
    throw new Error(
      'Shipment email requires complete consignee details: name, address, city/state/pincode, and contact number.',
    )
  }
  const consigneeDetailsHtml = `
    <div style="font-size:15px;line-height:1.2;color:#111111;font-weight:800;margin:0 0 10px;">Delivery Address</div>
    <div style="font-size:12.5px;line-height:1.25;color:#111111;font-weight:800;margin:0 0 4px;">${escapeHtml(
      customerName,
    )}</div>
    ${customerAddressLines
      .map(
        (line) => `
          <div class="cm-address-line" style="max-width:220px;font-size:12.5px;line-height:1.23;color:#111111;font-weight:700;margin:0 0 2px;word-break:break-word;">${escapeHtml(
            line,
          )}</div>
        `,
      )
      .join('')}
    ${
      contactNumber
        ? `<div style="margin-top:46px;font-size:12.5px;line-height:1.25;color:#111111;font-weight:800;word-break:break-word;">Contact Number&nbsp;&nbsp;<span style="font-weight:800;">${escapeHtml(
            contactNumber,
          )}</span></div>`
        : ''
    }
  `
  const introSentence = `Hello ${sellerDisplayName}, Your order ${
    orderNumberDisplay || safeOrderNumber || safeAwb
  } has been ${stageMeta.actionText} to ${customerName}.`
  const introHtml = `
    <div style="max-width:390px;font-size:12.5px;line-height:1.33;color:#171717;font-weight:600;">
      Your order <strong>${escapeHtml(orderNumberDisplay || safeOrderNumber || safeAwb)}</strong> has been <strong>${escapeHtml(
        stageMeta.actionText,
      )}</strong> to <strong>${escapeHtml(customerName)}</strong>.
    </div>
  `
  const orderPlacedCaption = firstText(
    formatDisplayDate(orderRecord.created_at as string | Date | null | undefined),
    orderPlacedOnFallback,
  )
  const amountLineDiscount = '₹ 0.0'
  const headline = `Order ${orderNumberDisplay || safeOrderNumber || safeAwb} is now ${stageMeta.badge}!`
  const productRowsHtml =
    primaryProduct || productName
      ? `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>
            <td class="cm-copy" valign="top" style="padding:0 0 4px 0;width:53%;">
              <div style="font-size:12.5px;line-height:1.5;color:#111111;">
                <strong style="font-size:12.5px;">Product Name:</strong>
                <span class="cm-green" style="color:#1f8a34;font-weight:700;padding-left:6px;">${escapeHtml(
                  productName,
                )}</span>
              </div>
            </td>
            <td class="cm-copy" valign="top" align="left" style="padding:0 0 4px 36px;width:47%;">
              <div style="font-size:12.5px;line-height:1.68;color:#111111;font-weight:700;">Qty: ${escapeHtml(
                productQty,
              )}&nbsp;&nbsp; Price:&nbsp; ${escapeHtml(productPrice)}</div>
              <div style="font-size:12.5px;line-height:1.68;color:#111111;font-weight:700;">Discount:&nbsp; ${escapeHtml(
                amountLineDiscount,
              )}</div>
              <div style="font-size:12.5px;line-height:1.68;color:#111111;font-weight:700;">Subtotal:&nbsp; ${escapeHtml(
                orderTotalValue,
              )}</div>
            </td>
          </tr>
        </table>
      `
      : ''
  const mobileProductRowsHtml = productRows.length
    ? `
        <div style="border-top:1px solid #ececec;padding-top:12px;">
          ${productRows
            .map(
              (row) => `
                <div style="padding:8px 0;border-bottom:1px solid #ececec;">
                  <div style="font-size:12.5px;line-height:1.5;color:#111111;">
                    <strong style="font-size:12.5px;">Product Name:</strong>
                    <span class="cm-green" style="color:#1f8a34;font-weight:700;padding-left:6px;">${escapeHtml(
                      row.name,
                    )}</span>
                  </div>
                  <div style="font-size:12.5px;line-height:1.68;color:#111111;font-weight:700;margin-top:2px;">
                    Qty: ${escapeHtml(row.qty)}${row.amount ? `&nbsp;&nbsp; Price:&nbsp; ${escapeHtml(row.amount)}` : ''}
                  </div>
                </div>
              `,
            )
            .join('')}
        </div>
      `
    : ''
  const mobileShippingHtml = `
    <div style="border-top:1px solid #ececec;padding-top:18px;">
      <div style="font-size:15px;font-weight:800;color:#111111;margin-bottom:8px;">Shipping Details</div>
      <div style="font-size:12.5px;line-height:1.55;color:#111111;">
        <div style="margin-bottom:2px;"><strong>Courier Name:</strong> <span class="cm-green" style="color:#1f8a34;font-weight:700;">${escapeHtml(
          courierName,
        )}</span></div>
        <div><strong>AWB number:</strong> <span class="cm-green" style="color:#1f8a34;font-weight:700;">${escapeHtml(
          safeAwb,
        )}</span></div>
      </div>
      <div style="margin-top:14px;font-size:12.5px;line-height:1.7;color:#111111;font-weight:700;">Item(s) total : ${escapeHtml(
        orderTotalValue,
      )}</div>
      <div style="font-size:12.5px;line-height:1.7;color:#111111;font-weight:700;">Amount paid : ${escapeHtml(
        amountPaidValue,
      )}</div>
    </div>
  `
  const mobileRegardsHtml = `
    <div style="padding:22px 0 12px;">
      <div class="cm-copy" style="font-size:12.5px;line-height:1.55;color:#111111;margin:0 0 2px;">Regards,</div>
      <div class="cm-copy" style="font-size:12.5px;line-height:1.55;color:#111111;font-weight:700;">Team ${escapeHtml(
        footerTeamName,
      )}!</div>
    </div>
  `
  const mobileHeaderHtml = `
    <div style="padding:0 0 10px;">
      <div style="line-height:0;margin:0 0 10px;">${buildChoiceMeeEmailLogo(logoSrc)}</div>
      <div style="display:inline-block;background:#ef6a1d;color:#ffffff;font-size:10px;line-height:1;padding:8px 12px;border-radius:999px;font-weight:700;white-space:nowrap;margin:0 0 10px;">${escapeHtml(
        stageMeta.badge,
      )}</div>
      <div style="font-size:12.5px;line-height:1.33;color:#171717;font-weight:600;margin:0 0 6px;">Hello ${escapeHtml(
        sellerDisplayName,
      )},</div>
      ${introHtml}
      <div style="font-size:11.5px;line-height:1.35;color:#5f6977;font-weight:700;margin-top:10px;white-space:nowrap;">Order placed on <span>${escapeHtml(
        orderPlacedCaption || '',
      )}</span></div>
      <div style="font-size:11.5px;line-height:1.35;color:#5f6977;font-weight:700;white-space:nowrap;">Order ID&nbsp; <span class="cm-green" style="color:#1f8a34;font-weight:700;">${escapeHtml(
        normalizedOrderNumber || safeOrderNumber || safeAwb,
      )}</span></div>
    </div>
  `
  const darkModeStyles = `
    <meta name="color-scheme" content="light only">
    <meta name="supported-color-schemes" content="light">
    <style>
      :root {
        color-scheme: light only;
        supported-color-schemes: light;
      }
      .cm-page {
        width: 100% !important;
        max-width: 640px !important;
        min-width: 0 !important;
        overflow-x: hidden !important;
        overflow-y: visible !important;
        -webkit-overflow-scrolling: touch !important;
        scrollbar-color: #94a3b8 #f5f5ed;
        scrollbar-width: thin;
      }
      .cm-page::-webkit-scrollbar { height: 8px; }
      .cm-page::-webkit-scrollbar-track { background: #f5f5ed; }
      .cm-page::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 999px; }
      .cm-shell { width: 100% !important; max-width: 640px !important; min-width: 0 !important; }
      .cm-logo-wrap { background: transparent !important; }
      .cm-logo { width: 250px !important; max-width: 250px !important; height: auto !important; margin: 0 !important; background: transparent !important; }
      .cm-panel { table-layout: fixed !important; }
      @media only screen and (max-width: 520px) {
        .cm-page { padding: 6px !important; }
        .cm-page, .cm-page *, .cm-shell, .cm-shell *, .cm-mobile-stack, .cm-mobile-stack * {
          box-sizing: border-box !important;
        }
        .cm-shell {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          border-radius: 16px !important;
          border: 2px solid #c8d1dd !important;
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08) !important;
        }
        .cm-header, .cm-intro, .cm-panel-wrap, .cm-product, .cm-shipping, .cm-regards {
          display: none !important;
        }
        .cm-mobile-stack {
          display: block !important;
          padding: 0 0 10px !important;
        }
        .cm-header { padding: 10px 12px 12px 12px !important; }
        .cm-header table, .cm-panel table, .cm-product table, .cm-shipping table {
          display: block !important;
          width: 100% !important;
        }
        .cm-header tr, .cm-panel tr, .cm-product tr, .cm-shipping tr {
          display: block !important;
          width: 100% !important;
        }
        .cm-header td {
          display: block !important;
          width: 100% !important;
          max-width: 100% !important;
          padding-left: 0 !important;
          padding-right: 0 !important;
          text-align: left !important;
        }
        .cm-header td:last-child { padding-top: 10px !important; }
        .cm-logo-wrap { width: 100% !important; }
        .cm-logo { width: 150px !important; max-width: 150px !important; margin: 0 !important; }
        .cm-badge { font-size: 10px !important; padding: 8px 12px !important; float: none !important; }
        .cm-intro { padding: 10px 12px 0 !important; }
        .cm-intro table { display: block !important; width: 100% !important; }
        .cm-intro td { display: block !important; width: 100% !important; max-width: 100% !important; padding-left: 0 !important; padding-right: 0 !important; text-align: left !important; }
        .cm-intro-left, .cm-intro-right, .cm-shipping-left, .cm-shipping-right, .cm-address-left, .cm-address-right {
          width: 100% !important;
          max-width: 100% !important;
          word-break: break-word !important;
          white-space: normal !important;
        }
        .cm-mobile-card {
          border: 2px solid #c8d1dd !important;
          border-radius: 8px !important;
          background: #fbfbfb !important;
          overflow: hidden !important;
        }
        .cm-intro-right { padding-top: 10px !important; }
        .cm-panel-wrap { padding: 12px !important; }
        .cm-panel { width: 100% !important; table-layout: auto !important; }
        .cm-address-left { padding: 12px 12px 10px 12px !important; border-bottom: 1px solid #edf0f4 !important; }
        .cm-address-line { max-width: 100% !important; }
        .cm-product { padding: 0 12px !important; }
        .cm-product td { display: block !important; width: 100% !important; max-width: 100% !important; padding-left: 0 !important; padding-right: 0 !important; font-size: 11px !important; line-height: 1.45 !important; white-space: normal !important; }
        .cm-shipping { padding: 0 12px !important; }
        .cm-shipping > div { padding-top: 22px !important; }
        .cm-shipping-right { padding-top: 10px !important; }
        .cm-regards { padding: 18px 12px 12px !important; }
      }
      @media (prefers-color-scheme: dark) {
        .cm-page, .cm-shell { background: #ffffff !important; color: #111111 !important; }
        .cm-header { background: #ffffff !important; }
        .cm-logo-wrap, .cm-logo { background: transparent !important; }
        .cm-header { border-bottom-color: transparent !important; }
        .cm-panel { background: #fbfbfb !important; border-color: #dce1e8 !important; }
        .cm-divider > div { border-top-color: #ececec !important; }
        .cm-copy, .cm-copy *, .cm-intro-left, .cm-intro-left *, .cm-address-line, .cm-shipping, .cm-shipping *, .cm-regards, .cm-regards * { color: #111111 !important; }
        .cm-meta, .cm-meta div { color: #3c4654 !important; }
        .cm-green { color: #087b2d !important; }
        .cm-badge { background: #ef6a1d !important; color: #ffffff !important; }
        .cm-footer { background: #2b2b2b !important; }
      }
      [data-ogsc] .cm-page, [data-ogsc] .cm-shell, [data-ogsb] .cm-page, [data-ogsb] .cm-shell { background: #ffffff !important; color: #111111 !important; }
      [data-ogsc] .cm-header, [data-ogsb] .cm-header { background: #ffffff !important; }
      [data-ogsc] .cm-logo-wrap, [data-ogsc] .cm-logo, [data-ogsb] .cm-logo-wrap, [data-ogsb] .cm-logo { background: transparent !important; }
      [data-ogsc] .cm-panel, [data-ogsb] .cm-panel { background: #fbfbfb !important; border-color: #dce1e8 !important; }
      [data-ogsc] .cm-copy, [data-ogsc] .cm-copy *, [data-ogsc] .cm-intro-left, [data-ogsc] .cm-intro-left *, [data-ogsc] .cm-address-line, [data-ogsc] .cm-shipping, [data-ogsc] .cm-shipping *, [data-ogsc] .cm-regards, [data-ogsc] .cm-regards *, [data-ogsb] .cm-copy, [data-ogsb] .cm-copy *, [data-ogsb] .cm-intro-left, [data-ogsb] .cm-intro-left *, [data-ogsb] .cm-address-line, [data-ogsb] .cm-shipping, [data-ogsb] .cm-shipping *, [data-ogsb] .cm-regards, [data-ogsb] .cm-regards * { color: #111111 !important; }
      [data-ogsc] .cm-meta, [data-ogsc] .cm-meta div, [data-ogsb] .cm-meta, [data-ogsb] .cm-meta div { color: #3c4654 !important; }
      [data-ogsc] .cm-green, [data-ogsb] .cm-green { color: #087b2d !important; }
    </style>
  `
  const html = `
    ${darkModeStyles}
    <div class="cm-page" style="width:100%;max-width:640px;min-width:0;margin:0 auto;padding:12px;background:#f5f1e7;overflow-x:hidden;overflow-y:visible;-webkit-overflow-scrolling:touch;scrollbar-color:#94a3b8 #f5f5ed;scrollbar-width:thin;">
      <div class="cm-shell" style="width:100%;max-width:640px;min-width:0;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;box-shadow:0 10px 24px rgba(15,23,42,0.08);overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#111111;">
        <div class="cm-header" style="padding:11px 24px 17px 30px;background:#f5f5ed;border-bottom:1px solid #e8e0cf;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <tr>
              <td class="cm-logo-wrap" valign="middle" style="width:68%;padding:0;line-height:0;background:transparent;">
                ${buildChoiceMeeEmailLogo(logoSrc)}
              </td>
              <td valign="top" align="right" style="width:32%;padding-top:15px;">
                <span class="cm-badge" style="display:inline-block;background:#ef6a1d;color:#ffffff;font-size:12px;line-height:1;padding:11px 21px;border-radius:999px;font-weight:700;white-space:nowrap;">${escapeHtml(
                  stageMeta.badge,
                )}</span>
              </td>
            </tr>
          </table>
        </div>

        <div class="cm-intro" style="padding:8px 20px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <tr>
              <td class="cm-intro-left cm-copy" valign="top" style="width:66%;padding-right:10px;">
                <div style="max-width:390px;font-size:12.5px;font-weight:700;line-height:1.3;color:#171717;margin:0 0 4px;">Hello ${escapeHtml(
                  sellerDisplayName,
                )} ,</div>
                ${introHtml}
              </td>
              <td class="cm-intro-right cm-meta" valign="top" align="right" style="width:34%;word-break:break-word;">
                <div style="font-size:11.5px;line-height:1.35;color:#5f6977;text-align:right;font-weight:700;white-space:nowrap;">Order placed on <span>${escapeHtml(
                  orderPlacedCaption || '',
                )}</span></div>
                <div style="font-size:11.5px;line-height:1.35;color:#5f6977;text-align:right;font-weight:700;white-space:nowrap;">Order ID&nbsp; <span class="cm-green" style="color:#1f8a34;font-weight:700;">${escapeHtml(
                  normalizedOrderNumber || safeOrderNumber || safeAwb,
                )}</span></div>
              </td>
            </tr>
          </table>
        </div>

        <div class="cm-panel-wrap" style="padding:25px 25px 12px 19px;">
          <table class="cm-panel" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #dce1e8;border-radius:2px;background:#fbfbfb;table-layout:fixed;">
            <tr>
              <td class="cm-address-left cm-copy" valign="top" style="width:52%;padding:15px 16px 23px 16px;">
                ${consigneeDetailsHtml}
              </td>
            </tr>
          </table>
        </div>

        <div class="cm-mobile-stack" style="display:none;">
          <div style="padding:0 12px 0;">
            <div class="cm-mobile-card" style="border:2px solid #c8d1dd;border-radius:8px;background:#fbfbfb;overflow:hidden;">
              <div style="padding:12px 12px 10px;">
                ${mobileHeaderHtml}
              </div>
              <div style="border-top:1px solid #edf0f4;padding:12px 12px 0;">
                ${consigneeDetailsHtml}
              </div>
              <div style="border-top:1px solid #edf0f4;padding:12px 12px 0;">
                ${mobileProductRowsHtml}
                ${mobileShippingHtml}
                ${mobileRegardsHtml}
              </div>
            </div>
          </div>
        </div>

        <div class="cm-product" style="padding:0 32px 0;">
          ${productRowsHtml}
        </div>

        <div class="cm-shipping cm-divider" style="padding:0 32px 0;">
          <div style="border-top:1px solid #ececec;padding-top:40px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <tr>
              <td class="cm-shipping-left cm-copy" style="padding-top:0;vertical-align:top;width:50%;">
                <div style="font-size:15px;font-weight:800;color:#111111;margin-bottom:9px;">Shipping Details</div>
                <div style="font-size:12.5px;line-height:1.45;color:#111111;">
                  <strong>Courier Name:</strong> <span class="cm-green" style="color:#1f8a34;font-weight:700;">${escapeHtml(
                    courierName,
                  )}</span><br/>
                  <strong>AWB number:</strong> <span class="cm-green" style="color:#1f8a34;font-weight:700;">${escapeHtml(
                    safeAwb,
                  )}</span>
                </div>
              </td>
              <td class="cm-shipping-right cm-copy" align="left" style="padding-top:0;padding-left:53px;vertical-align:top;width:50%;">
                <div style="font-size:12.5px;line-height:1.7;color:#111111;font-weight:700;">Item(s) total : ${escapeHtml(
                  orderTotalValue,
                )}</div>
                <div style="font-size:12.5px;line-height:1.7;color:#111111;font-weight:700;">Amount paid : ${escapeHtml(
                  amountPaidValue,
                )}</div>
              </td>
            </tr>
          </table>
          </div>
        </div>

        <div class="cm-regards" style="padding:28px 32px 15px;">
          <div class="cm-copy" style="font-size:12.5px;line-height:1.55;color:#111111;margin:0 0 2px;">Regards,</div>
          <div class="cm-copy" style="font-size:12.5px;line-height:1.55;color:#111111;font-weight:700;">Team ${escapeHtml(
            footerTeamName,
          )}!</div>
        </div>

        <div class="cm-footer-shell">
          <div class="cm-footer" style="background:#2b2b2b;padding:13px 0 13px;text-align:center;">
            ${buildShipmentFooterIcons()}
          </div>
        </div>
      </div>
    </div>
  `

  const plainTextParts = [
    headline,
    `Hello ${sellerDisplayName},`,
    introSentence,
    orderPlacedValue ? `Order placed on: ${orderPlacedValue}` : '',
    `Order ID: ${normalizedOrderNumber || safeOrderNumber || safeAwb}`,
    `AWB Number: ${awbNumber}`,
    'Delivery Address:',
    `Name: ${customerName}`,
    ...customerAddressLines.map((line) => `Address: ${line}`),
    contactNumber ? `Contact Number: ${contactNumber}` : '',
    ...productRows.map((row) => `Product: ${row.name} | Qty: ${row.qty}${row.amount ? ` | Price: ${row.amount}` : ''}`),
    ...amountLines.map((row) => `${row.label}: ${row.value}`),
    `Courier Name: ${courierName}`,
    `Tracking Link: ${trackingLink}`,
    'Regards, Team ChoiceMee Logistics!',
  ].filter(Boolean)

  return {
    html,
    text: plainTextParts.join('\n'),
    subject: headline,
  }
}

export const sendShipmentStatusEmail = async (opts: {
  to: string
  awbNumber: string
  orderNumber?: string | null
  orderLabel?: string | null
  stage: ShipmentStatusEmailStage
  sellerName?: string | null
  sellerLogoUrl?: string | null
  orderDetails?: ShipmentOrderLike | null
  messageId?: string
}) => {
  const logoAttachment = resolveChoiceMeeEmailLogoAttachment()
  const content = buildShipmentStatusEmailContent({
    ...opts,
    brandLogoSrc: logoAttachment ? `cid:${getChoiceMeeEmailLogoCid()}` : getChoiceMeeEmailLogoSrc(),
  })
  await sendEmail(
    opts.to,
    content.subject,
    content.html,
    logoAttachment ? [logoAttachment] : undefined,
    content.text,
    opts.messageId,
  )
}

export const sendSmtpTestEmail = async (to?: string) => {
  const config = readEmailConfig()
  const recipient = to || config.senderFrom

  await sendEmail(
    recipient,
    'ChoiceMee Logistics SMTP test',
    `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937">
        <h2 style="margin:0 0 12px;color:#0D1B4D">SMTP delivery is working</h2>
        <p>This is a production mailer test from ChoiceMee Logistics.</p>
      </div>
    `,
    undefined,
    'SMTP delivery is working. This is a production mailer test from ChoiceMee Logistics.',
  )
}

// Login / verification Email for OTP-based auth
export const sendVerificationEmail = async (to: string, token: string) => {
  console.log('[Auth Email] Preparing verification email', {
    to: maskEmailForLog(to),
    tokenLength: token.length,
  })

  if (!isEmailDeliveryConfigured()) {
    throw new Error('Email service is not configured. Missing SendGrid API key or SMTP credentials.')
  }

  const html = `
    <div style="margin:0; padding:24px 12px; background:#f4f1ed;">
      <div style="
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
        max-width: 620px;
        margin: 0 auto;
        background: #fffdf9;
        border: 1px solid #eadfd4;
        border-radius: 24px;
        overflow: hidden;
        box-shadow: 0 18px 40px rgba(23,19,16,0.08);
        color: #171310;
      ">
        <div style="
          padding: 26px 28px 18px;
          background: linear-gradient(135deg, #0D1B4D 0%, #18346F 58%, #FF8A28 100%);
          color: #ffffff;
        ">
          <div style="
            display:inline-block;
            padding:6px 12px;
            border-radius:999px;
            background:rgba(255,138,40,0.24);
            font-size:12px;
            font-weight:700;
            letter-spacing:0.08em;
            text-transform:uppercase;
          ">
            ChoiceMee
          </div>

          <h1 style="margin:18px 0 8px; font-size:28px; line-height:1.2; font-weight:800;">
            Your sign-in code is ready
          </h1>

          <p style="margin:0; font-size:14px; line-height:1.7; color:rgba(255,255,255,0.82);">
            Use the verification code below to securely continue your login.
          </p>
        </div>

        <div style="padding:28px;">
          <div style="
            border:1px solid #eadfd4;
            border-radius:20px;
            background:linear-gradient(180deg, #fff 0%, #fbf5ef 100%);
            padding:22px;
            text-align:center;
          ">
            <p style="
              margin:0 0 10px;
              font-size:12px;
              font-weight:700;
              letter-spacing:0.12em;
              text-transform:uppercase;
              color:#8a6f5a;
            ">
              Verification Code
            </p>

            <div style="
              display:inline-block;
              padding:16px 24px;
              border-radius:16px;
              background:#171310;
              color:#ffffff;
              font-size:30px;
              line-height:1;
              font-weight:800;
              letter-spacing:8px;
            ">
              ${token}
            </div>

            <p style="margin:14px 0 0; font-size:13px; color:#6a5e59; line-height:1.6;">
              This code expires in <strong style="color:#171310;">6 minutes</strong>.
            </p>
          </div>

          <div style="
            margin-top:18px;
            padding:18px 20px;
            border-radius:18px;
            background:#f6efe7;
            border:1px solid #eadfd4;
          ">
            <p style="margin:0 0 8px; font-size:14px; font-weight:700; color:#171310;">
              Didn&apos;t request this?
            </p>
            <p style="margin:0; font-size:13px; line-height:1.7; color:#6a5e59;">
              You can safely ignore this email. Your account stays protected unless this code is entered.
            </p>
          </div>

          <div style="margin-top:22px; padding-top:18px; border-top:1px solid #eadfd4;">
            <p style="margin:0; font-size:12px; line-height:1.7; color:#8c7b70;">
              Sent by ChoiceMee Logistics
            </p>
            <p style="margin:4px 0 0; font-size:12px; line-height:1.7; color:#a19185;">
              Â© ${new Date().getFullYear()} ChoiceMee Logistics. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  `

  await sendEmail(
    to,
    'Your ChoiceMee Logistics verification code',
    html,
    undefined,
    `Your ChoiceMee Logistics verification code is ${token}. It expires in 5 minutes. If you did not request this code, you can ignore this email.`,
  )
  return { delivered: true }
}

export const sendPasswordResetEmail = async (to: string, token: string) => {
  console.log('[Auth Email] Preparing password reset email', {
    to: maskEmailForLog(to),
    tokenLength: token.length,
  })

  if (!isEmailDeliveryConfigured()) {
    throw new Error('Email service is not configured. Missing SendGrid API key or SMTP credentials.')
  }

  const resetUrl = `${getFrontendBaseUrl()}/reset-password?email=${encodeURIComponent(to)}&token=${encodeURIComponent(token)}`

  const html = `
    <div style="margin:0; padding:24px 12px; background:#f4f1ed;">
      <div style="
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
        max-width: 620px;
        margin: 0 auto;
        background: #fffdf9;
        border: 1px solid #eadfd4;
        border-radius: 24px;
        overflow: hidden;
        box-shadow: 0 18px 40px rgba(23,19,16,0.08);
        color: #171310;
      ">
        <div style="
          padding: 26px 28px 18px;
          background: linear-gradient(135deg, #0D1B4D 0%, #18346F 58%, #FF8A28 100%);
          color: #ffffff;
        ">
          <div style="
            display:inline-block;
            padding:6px 12px;
            border-radius:999px;
            background:rgba(255,138,40,0.24);
            font-size:12px;
            font-weight:700;
            letter-spacing:0.08em;
            text-transform:uppercase;
          ">
            ChoiceMee
          </div>

          <h1 style="margin:18px 0 8px; font-size:28px; line-height:1.2; font-weight:800;">
            Reset your password
          </h1>

          <p style="margin:0; font-size:14px; line-height:1.7; color:rgba(255,255,255,0.82);">
            We received a request to reset the password for your ChoiceMee account.
          </p>
        </div>

        <div style="padding:28px;">
          <div style="
            border:1px solid #eadfd4;
            border-radius:20px;
            background:linear-gradient(180deg, #fff 0%, #fbf5ef 100%);
            padding:22px;
            text-align:center;
          ">
            <p style="
              margin:0 0 10px;
              font-size:12px;
              font-weight:700;
              letter-spacing:0.12em;
              text-transform:uppercase;
              color:#8a6f5a;
            ">
              Reset Code
            </p>

            <div style="
              display:inline-block;
              padding:16px 24px;
              border-radius:16px;
              background:#171310;
              color:#ffffff;
              font-size:30px;
              line-height:1;
              font-weight:800;
              letter-spacing:8px;
            ">
              ${token}
            </div>

            <p style="margin:14px 0 0; font-size:13px; color:#6a5e59; line-height:1.6;">
              This reset code expires in <strong style="color:#171310;">15 minutes</strong>.
            </p>
          </div>

          <div style="margin-top:18px; text-align:center;">
            <a href="${resetUrl}" style="
              display:inline-block;
              padding:14px 24px;
              border-radius:999px;
              background:#0D1B4D;
              color:#fff;
              font-size:15px;
              font-weight:700;
              text-decoration:none;
            ">
              Reset Password
            </a>
          </div>

          <div style="
            margin-top:18px;
            padding:18px 20px;
            border-radius:18px;
            background:#f6efe7;
            border:1px solid #eadfd4;
          ">
            <p style="margin:0 0 8px; font-size:14px; font-weight:700; color:#171310;">
              Didn&apos;t request this?
            </p>
            <p style="margin:0; font-size:13px; line-height:1.7; color:#6a5e59;">
              You can safely ignore this email. Your current password stays active until you change it.
            </p>
          </div>

          <div style="margin-top:22px; padding-top:18px; border-top:1px solid #eadfd4;">
            <p style="margin:0; font-size:12px; line-height:1.7; color:#8c7b70;">
              Sent by ChoiceMee Logistics
            </p>
            <p style="margin:4px 0 0; font-size:12px; line-height:1.7; color:#a19185;">
              © ${new Date().getFullYear()} ChoiceMee Logistics. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  `

  await sendEmail(
    to,
    'Reset your ChoiceMee password',
    html,
    undefined,
    `Reset your ChoiceMee password using this code: ${token}. It expires in 15 minutes. Open ${resetUrl} to continue. If you did not request this, ignore this email.`,
  )
  return { delivered: true, resetUrl }
}

// Employee Credentials Email
export const sendEmployeeCredentials = async (
  to: string,
  email: string,
  password: string,
  createdBy: string, // name or email of the seller/admin
) => {
  const html = `
    <div style="font-family: 'Segoe UI', Roboto, Arial, sans-serif; max-width: 600px; margin: auto; padding: 32px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #fafafa;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #1e293b; margin: 0;">Welcome to <span style="color:#2563eb;">ChoiceMee Logistics</span> ðŸš€</h2>
        <p style="font-size: 15px; color: #64748b; margin-top: 8px;">Your employee account has been created successfully.</p>
      </div>

      <div style="background: #fff; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb;">
        <p style="font-size: 16px; color: #334155; margin: 0 0 12px 0;">
          An account has been created for you by <strong>${createdBy}</strong>.
        </p>
        <p style="font-size: 16px; color: #334155; margin: 0 0 12px 0;">Here are your login credentials:</p>
        <table style="width: 100%; font-size: 15px; color: #1e293b; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px; font-weight: bold; width: 40%;">Email</td>
            <td style="padding: 8px; background: #f9fafb; border-radius: 4px;">${email}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold;">Password</td>
            <td style="padding: 8px; background: #f9fafb; border-radius: 4px;">${password}</td>
          </tr>
        </table>
      </div>

      <p style="font-size: 14px; color: #64748b; margin-top: 28px; text-align: center;">
        You can now log in to your ChoiceMee Logistics account using these credentials.<br/>
        If you face any issues, please contact your administrator.
      </p>

      <div style="text-align: center; margin-top: 32px; font-size: 13px; color: #94a3b8;">
        â€” The ChoiceMee Logistics Team
      </div>
    </div>
  `

  await sendEmail(to, 'Your ChoiceMee Logistics Employee Account', html)
}
export const sendTempPasswordEmail = async (to: string, tempPassword: string) => {
  const safePassword = escapeHtml(tempPassword)

  const html = `
    <div style="font-family: 'Segoe UI', Roboto, Arial, sans-serif; max-width:600px; margin:auto; padding:32px; border:1px solid #e5e7eb; border-radius:12px; background-color:#f9fafb;">
      <div style="text-align:center; margin-bottom:24px;">
        <h2 style="color:#1e293b; margin:0;">ChoiceMee Logistics Account Password Reset</h2>
        <p style="font-size:15px; color:#64748b; margin-top:8px;">
          Your account password has been reset by our team.
        </p>
      </div>

      <div style="background:#fff; padding:20px; border-radius:8px; border:1px solid #e5e7eb; text-align:center;">
        <p style="font-size:16px; color:#334155; margin-bottom:16px;">
          Here is your temporary password:
        </p>
        <span style="display:inline-block; padding:12px 24px; font-size:20px; font-weight:bold; color:#ffffff; background-color:#2563eb; border-radius:6px; letter-spacing:1px;">
          ${safePassword}
        </span>
        <p style="font-size:14px; color:#64748b; margin-top:16px;">
          Use this password to log in and change it immediately.
        </p>
      </div>

      <p style="font-size:13px; color:#94a3b8; margin-top:28px; text-align:center;">
        If you did not request this, please contact our support immediately.<br/>
        â€” The ChoiceMee Logistics Team
      </p>
    </div>
  `

  await sendEmail(to, 'Your Temporary ChoiceMee Logistics Password', html)
}

export const sendInvoiceReadyEmail = async (opts: {
  to: string
  sellerName?: string
  invoiceNo: string
  periodStart: string // e.g. '01 Sep 2025'
  periodEnd: string
  totalAmount: string | number
  pdfUrl?: string // optional public url or local path
  csvUrl?: string // optional public url or local path
  attachFiles?: boolean // default false for production
  preferSignedUrls?: boolean // if true, treat pdfUrl/csvUrl as download links
}) => {
  const {
    to,
    sellerName,
    invoiceNo,
    periodStart,
    periodEnd,
    totalAmount,
    pdfUrl,
    csvUrl,
    attachFiles = false,
    preferSignedUrls = false,
  } = opts

  const safeSeller = sellerName ? sellerName : 'Seller'

  const html = `
  <div style="font-family: Arial, sans-serif; max-width:700px; margin:auto; padding:24px; color:#111">
    <h2 style="margin-bottom: 8px;">Your invoice is ready â€” ${invoiceNo}</h2>
    <p style="color:#555; margin-top:0;">Hello ${safeSeller},</p>
    <p style="color:#555">Your invoice for the period <strong>${periodStart}</strong> â€” <strong>${periodEnd}</strong> has been generated.</p>

    <table style="width:100%; margin-top:12px; border-collapse: collapse;">
      <tr>
        <td style="padding:8px; font-weight:600; width:40%;">Invoice No</td>
        <td style="padding:8px;">${invoiceNo}</td>
      </tr>
      <tr>
        <td style="padding:8px; font-weight:600;">Period</td>
        <td style="padding:8px;">${periodStart} â€” ${periodEnd}</td>
      </tr>
      <tr>
        <td style="padding:8px; font-weight:600;">Amount (GST inclusive)</td>
        <td style="padding:8px;">â‚¹${Number(totalAmount).toFixed(2)}</td>
      </tr>
    </table>

    <div style="margin-top:16px;">
  ${
    preferSignedUrls && (pdfUrl || csvUrl)
      ? `<p style="margin-bottom:8px;">Download files:</p>
       ${pdfUrl ? `<p><a href="${pdfUrl}">Download PDF Invoice</a></p>` : ''}
       ${csvUrl ? `<p><a href="${csvUrl}">Download CSV breakdown</a></p>` : ''}`
      : `<p style="color:#555; margin-bottom:8px;">You can download the invoice files attached to this email.</p>`
  }
    </div>

    <p style="color:#777; margin-top:20px; font-size:13px;">
      If you have any questions or dispute an item on the invoice, please contact support or use the â€œraise disputeâ€ option in your seller dashboard.
    </p>

    <div style="margin-top:22px; font-size:12px; color:#999;">
      â€” ChoiceMee Logistics Team
    </div>
  </div>
  `

  // If attachFiles true and pdfUrl/csvUrl point to local files, attach them
  let attachments: AttachmentInput[] | undefined = undefined
  if (attachFiles) {
    attachments = []
    if (pdfUrl && !preferSignedUrls) {
      if (fs.existsSync(pdfUrl)) {
        attachments.push({ path: pdfUrl, filename: `${invoiceNo}.pdf` })
      }
    }
    if (csvUrl && !preferSignedUrls) {
      if (fs.existsSync(csvUrl)) {
        attachments.push({ path: csvUrl, filename: `${invoiceNo}.csv` })
      }
    }
  }

  await sendEmail(to, `Your Invoice ${invoiceNo} is ready`, html, attachments)
}

export const sendInvoiceReminderEmail = async (opts: {
  to: string
  invoiceNo: string
  amount: number | string
  pdfUrl?: string
  csvUrl?: string
}) => {
  const { to, invoiceNo, amount, pdfUrl, csvUrl } = opts

  const html = `
  <div style="font-family: Arial, sans-serif; max-width:700px; margin:auto; padding:24px; color:#111">
    <h2 style="margin-bottom: 8px; color: #dc2626;">Payment Reminder â€” Invoice ${invoiceNo}</h2>
    <p style="color:#555; margin-top:0;">Hello,</p>
    <p style="color:#555">This is a friendly reminder that your invoice <strong>${invoiceNo}</strong> with an outstanding amount of <strong>â‚¹${Number(
    amount,
  ).toFixed(2)}</strong> is still pending payment.</p>

    <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; font-weight: 600; color: #991b1b;">Outstanding Amount: â‚¹${Number(
        amount,
      ).toFixed(2)}</p>
    </div>

    <div style="margin-top:16px;">
      ${
        pdfUrl || csvUrl
          ? `<p style="margin-bottom:8px;">Access your invoice:</p>
       ${
         pdfUrl
           ? `<p><a href="${pdfUrl}" style="color: #2563eb; text-decoration: underline;">Download PDF Invoice</a></p>`
           : ''
       }
       ${
         csvUrl
           ? `<p><a href="${csvUrl}" style="color: #2563eb; text-decoration: underline;">Download CSV breakdown</a></p>`
           : ''
       }`
          : ''
      }
    </div>

    <p style="color:#777; margin-top:20px; font-size:13px;">
      Please make the payment at your earliest convenience. If you have already made the payment, please ignore this reminder.
    </p>

    <p style="color:#777; margin-top:16px; font-size:13px;">
      If you have any questions or need assistance, please contact our support team.
    </p>

    <div style="margin-top:22px; font-size:12px; color:#999;">
      â€” ChoiceMee Logistics Team
    </div>
  </div>
  `

  await sendEmail(to, `Payment Reminder: Invoice ${invoiceNo}`, html)
}

export const sendCodRemittanceSettledEmail = async (opts: {
  to: string
  sellerName?: string
  amount: number | string
  orderNumber?: string | null
  awbNumber?: string | null
  settledAt?: Date | string | null
  utrNumber?: string | null
}) => {
  const { to, sellerName, amount, orderNumber, awbNumber, settledAt, utrNumber } = opts
  const safeSellerName = escapeHtml(sellerName || 'Seller')
  const numericAmount = Number(amount)
  const amountText = Number.isFinite(numericAmount)
    ? numericAmount.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : String(amount)
  const safeAmountText = escapeHtml(amountText)
  const safeOrderNumber = escapeHtml(String(orderNumber || '').trim())
  const safeAwbNumber = escapeHtml(String(awbNumber || '').trim())
  const safeUtrNumber = escapeHtml(String(utrNumber || '').trim())
  const settledDateText = settledAt ? formatDisplayDateTime(settledAt) : formatDisplayDateTime(new Date())
  const safeSettledDateText = escapeHtml(settledDateText)
  const referenceRows = [
    safeOrderNumber ? ['Order Number', safeOrderNumber] : null,
    safeAwbNumber ? ['AWB Number', safeAwbNumber] : null,
    safeUtrNumber ? ['UTR / Reference', safeUtrNumber] : null,
    safeSettledDateText ? ['Processed On', safeSettledDateText] : null,
  ].filter(Boolean) as string[][]

  const html = `
    <div style="margin:0; padding:24px 12px; background:#f4f7fb;">
      <div style="
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
        max-width: 620px;
        margin: 0 auto;
        background: #ffffff;
        border: 1px solid #dbe4f0;
        border-radius: 18px;
        overflow: hidden;
        color: #102033;
      ">
        <div style="padding: 24px 28px; background:#0D3B8E; color:#ffffff;">
          <p style="margin:0; font-size:12px; letter-spacing:0.08em; text-transform:uppercase; font-weight:700;">
            ChoiceMee Logistics
          </p>
          <h1 style="margin:12px 0 0; font-size:24px; line-height:1.25;">
            COD remittance processed
          </h1>
        </div>

        <div style="padding:28px;">
          <p style="margin:0 0 14px; font-size:15px; line-height:1.7; color:#334155;">
            Dear ${safeSellerName},
          </p>
          <p style="margin:0 0 18px; font-size:15px; line-height:1.7; color:#334155;">
            Greetings from ChoiceMee Logistics.
          </p>
          <p style="margin:0 0 18px; font-size:15px; line-height:1.7; color:#334155;">
            We have processed your COD remittance of
            <strong style="color:#0D3B8E;">&#8377;${safeAmountText}</strong>
            to your registered bank account.
          </p>

          <div style="
            margin: 22px 0;
            padding: 18px 20px;
            border-radius: 14px;
            background: #f0f6ff;
            border: 1px solid #c7dcfb;
          ">
            <p style="margin:0; font-size:14px; line-height:1.7; color:#24415f;">
              The amount is expected to reflect in your bank account within the next
              <strong>4 hours</strong>. If it is not received within this timeframe,
              please contact ChoiceMee Support for assistance.
            </p>
          </div>

          ${
            referenceRows.length
              ? `<table style="width:100%; border-collapse:collapse; margin:0 0 20px;">
                  ${referenceRows
                    .map(
                      ([label, value]) => `
                        <tr>
                          <td style="padding:9px 0; font-size:13px; color:#64748b; border-bottom:1px solid #edf2f7; width:42%;">
                            ${label}
                          </td>
                          <td style="padding:9px 0; font-size:13px; color:#102033; border-bottom:1px solid #edf2f7; font-weight:700;">
                            ${value}
                          </td>
                        </tr>
                      `,
                    )
                    .join('')}
                </table>`
              : ''
          }

          <p style="margin:22px 0 0; font-size:15px; line-height:1.7; color:#334155;">
            Regards,<br/>
            <strong>Team ChoiceMee</strong>
          </p>
        </div>
      </div>
    </div>
  `

  const text = [
    `Dear ${sellerName || 'Seller'},`,
    '',
    'Greetings from ChoiceMee Logistics.',
    '',
    `We have processed your COD remittance of Rs. ${amountText} to your registered bank account.`,
    '',
    'The amount is expected to reflect in your bank account within the next 4 hours. If it is not received within this timeframe, please contact ChoiceMee Support for assistance.',
    '',
    orderNumber ? `Order Number: ${orderNumber}` : '',
    awbNumber ? `AWB Number: ${awbNumber}` : '',
    utrNumber ? `UTR / Reference: ${utrNumber}` : '',
    settledDateText ? `Processed On: ${settledDateText}` : '',
    '',
    'Regards,',
    'Team ChoiceMee',
  ]
    .filter((line, index, lines) => line || lines[index - 1])
    .join('\n')

  await sendEmail(to, 'Your COD remittance has been processed', html, undefined, text)
}

export const sendKycStatusEmail = async (opts: {
  to: string
  userName?: string
  status: 'verified' | 'rejected'
  reason?: string
}) => {
  const { to, userName, status, reason } = opts
  const safeName = userName || 'Merchant'
  const isApproved = status === 'verified'
  const subject = isApproved ? 'Your KYC has been approved' : 'Your KYC has been rejected'

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 10px;">
      <h2 style="margin: 0 0 10px 0; color: ${isApproved ? '#166534' : '#991b1b'};">
        ${isApproved ? 'KYC Approved' : 'KYC Rejected'}
      </h2>
      <p style="margin: 0 0 12px 0; color: #374151;">Hello ${safeName},</p>
      <p style="margin: 0 0 14px 0; color: #374151;">
        Your KYC verification status has been updated to:
        <strong>${isApproved ? 'Approved' : 'Rejected'}</strong>.
      </p>
      ${
        !isApproved && reason
          ? `<div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 12px; margin: 14px 0; border-radius: 6px;">
               <p style="margin: 0; color: #7f1d1d;"><strong>Reason:</strong> ${escapeHtml(reason)}</p>
             </div>`
          : ''
      }
      <p style="margin: 14px 0 0 0; color: #6b7280; font-size: 13px;">
        If you need help, please contact support from your dashboard.
      </p>
      <p style="margin: 20px 0 0 0; color: #9ca3af; font-size: 12px;">â€” ChoiceMee Logistics Team</p>
    </div>
  `

  await sendEmail(to, subject, html)
}
